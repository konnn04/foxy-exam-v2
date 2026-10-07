<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\EditOpLog;
use App\Models\ExamAttempt;
use App\Models\Violation;
use App\Support\Risk;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * POST /api/internal/v1/events/bulk — the ONLY write path of the realtime plane into the core.
 *
 * The worker sends one condensed batch per second (hundreds of events) and retries on failure, so the
 * endpoint is idempotent (client_event_id) and tolerant: an invalid or unknown item is skipped and counted,
 * it never fails the whole batch (a 4xx would park the batch in the dead-letter stream).
 */
class EventsController extends Controller
{
    private const VIOLATION_TYPES = [
        'BULK_PASTE', 'SYNTHETIC_INPUT', 'TAB_SWITCH', 'WINDOW_LOST_FOCUS', 'DEVTOOLS_OPENED',
        'MULTIPLE_KEYBOARDS', 'FACE_MISMATCH', 'MULTIPLE_PEOPLE', 'NO_FACE_DETECTED', 'PROHIBITED_DEVICE',
        'BANNED_APP', 'MULTIPLE_MONITORS', 'DEVICE_CHANGED', 'SYSTEM_SHORTCUT', 'APP_NOT_ALLOWED',
        'LOOKING_AWAY', 'FACE_TOO_FAR', 'CAMERA_LOST', 'SCREEN_SHARE_STOPPED', 'OFFLINE_TOO_LONG',
    ];
    private const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batch_id' => ['nullable', 'string', 'max:100'],
            'violations' => ['nullable', 'array', 'max:2000'],
            'oplogs' => ['nullable', 'array', 'max:2000'],
            'heartbeats' => ['nullable', 'array', 'max:5000'],
        ]);

        $violations = $data['violations'] ?? [];
        $oplogs = $data['oplogs'] ?? [];
        $heartbeats = $data['heartbeats'] ?? [];

        $attemptIds = collect([...$violations, ...$oplogs, ...$heartbeats])->pluck('attempt_id')->filter()->unique()->map(fn ($i) => (int) $i)->all();
        $attempts = ExamAttempt::whereIn('id', $attemptIds)->get()->keyBy('id');

        $stats = ['violations' => 0, 'oplogs' => 0, 'heartbeats' => 0, 'duplicates' => 0, 'skipped' => 0];
        $points = []; // attempt id => risk points to add

        DB::transaction(function () use ($violations, $oplogs, $heartbeats, $attempts, &$stats, &$points) {
            $seen = array_fill_keys(
                Violation::withoutGlobalScopes()->whereIn('client_event_id', $this->clientIds($violations, $oplogs))->pluck('client_event_id')->all(),
                true,
            );
            $seenOps = array_fill_keys(
                EditOpLog::whereIn('client_event_id', collect($oplogs)->pluck('client_event_id')->filter()->all())->pluck('client_event_id')->all(),
                true,
            );

            foreach ($violations as $v) {
                $cid = (string) ($v['client_event_id'] ?? '');
                $attempt = $attempts->get((int) ($v['attempt_id'] ?? 0));
                if (!$attempt || $cid === '' || !in_array($v['violation_type'] ?? null, self::VIOLATION_TYPES, true) || !in_array($v['severity'] ?? null, self::SEVERITIES, true)) {
                    $stats['skipped']++;
                    continue;
                }
                if (isset($seen[$cid])) {
                    $stats['duplicates']++;
                    continue;
                }
                $seen[$cid] = true;
                Violation::create([
                    'exam_attempt_id' => $attempt->id,
                    'violation_type' => $v['violation_type'],
                    'severity' => $v['severity'],
                    'details' => $v['details'] ?? [],
                    'evidence_id' => $v['evidence_id'] ?? null,
                    'client_event_id' => $cid,
                    'timestamp' => $this->at($v['occurred_at'] ?? null),
                ]);
                $points[$attempt->id] = ($points[$attempt->id] ?? 0) + Risk::weight($v['severity']);
                $stats['violations']++;
            }

            foreach ($oplogs as $o) {
                $cid = (string) ($o['client_event_id'] ?? '');
                $attempt = $attempts->get((int) ($o['attempt_id'] ?? 0));
                if (!$attempt || $cid === '') {
                    $stats['skipped']++;
                    continue;
                }
                if (isset($seenOps[$cid])) {
                    $stats['duplicates']++;
                    continue;
                }
                $seenOps[$cid] = true;
                $pastes = max(0, (int) ($o['paste_event_count'] ?? 0));
                $flags = is_array($o['synthetic_flags'] ?? null) ? $o['synthetic_flags'] : [];

                EditOpLog::create([
                    'exam_attempt_id' => $attempt->id,
                    'programming_problem_id' => $o['programming_problem_id'] ?? null,
                    'batch_seq' => max(0, (int) ($o['batch_seq'] ?? 0)),
                    'keystroke_count' => max(0, (int) ($o['keystroke_count'] ?? 0)),
                    'paste_event_count' => $pastes,
                    'synthetic_flags' => $flags ?: null,
                    'payload_ref' => $o['payload_ref'] ?? null,
                    'client_event_id' => $cid,
                    'created_at' => $this->at($o['occurred_at'] ?? null),
                ]);
                $stats['oplogs']++;

                // same anti-cheat rule as the direct REST op-log endpoint
                if ($pastes > 0 || !empty($flags['bulk_insert'])) {
                    $bpId = $cid . ':bp';
                    if (!isset($seen[$bpId])) {
                        $seen[$bpId] = true;
                        [$severity, $inc] = Risk::bulkPaste((int) ($flags['chars_count'] ?? 0));
                        Violation::create([
                            'exam_attempt_id' => $attempt->id,
                            'violation_type' => 'BULK_PASTE',
                            'severity' => $severity,
                            'details' => [
                                'message' => 'Phát hiện hành vi dán một lượng lớn mã nguồn bất thường vào bài làm.',
                                'paste_event_count' => $pastes,
                                'flags' => $flags,
                            ],
                            'client_event_id' => $bpId,
                            'timestamp' => $this->at($o['occurred_at'] ?? null),
                        ]);
                        $points[$attempt->id] = ($points[$attempt->id] ?? 0) + $inc;
                        $stats['violations']++;
                    }
                }
            }

            foreach ($points as $attemptId => $pts) {
                Risk::apply($attempts[$attemptId], $pts);
            }

            foreach ($heartbeats as $h) {
                $attempt = $attempts->get((int) ($h['attempt_id'] ?? 0));
                if (!$attempt || empty($h['last_seen_at'])) {
                    $stats['skipped']++;
                    continue;
                }
                $at = $this->at($h['last_seen_at']);
                ExamAttempt::whereKey($attempt->id)
                    ->where(fn ($q) => $q->whereNull('last_seen_at')->orWhere('last_seen_at', '<', $at))
                    ->update(['last_seen_at' => $at]);
                $stats['heartbeats']++;
            }
        });

        return response()->json(['success' => true, ...$stats]);
    }

    private function clientIds(array $violations, array $oplogs): array
    {
        $ids = collect($violations)->pluck('client_event_id')->filter()->all();
        foreach ($oplogs as $o) {
            if (!empty($o['client_event_id'])) {
                $ids[] = $o['client_event_id'] . ':bp';
            }
        }

        return $ids;
    }

    /** Client / ingest timestamps are unix milliseconds. */
    private function at(mixed $ms): Carbon
    {
        return is_numeric($ms) && $ms > 0 ? Carbon::createFromTimestampMs((int) $ms) : now();
    }
}
