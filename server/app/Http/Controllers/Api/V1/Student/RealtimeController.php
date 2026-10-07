<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Services\Realtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RealtimeController extends Controller
{
    public function __construct(private Realtime $realtime)
    {
    }

    /**
     * Realtime session of the running attempt.
     *
     * Returns everything FoxyClient needs to talk to the realtime plane: where and how to send batched
     * telemetry (ingest), how to upload evidence straight to storage, and the LiveKit room to publish
     * camera + screen into. Tokens are bound to this one attempt and expire when the exam can no longer run.
     *
     * Call it right after login / start, and again when `expires_at` approaches (or after a 401 from ingest).
     */
    public function session(Request $request): JsonResponse
    {
        if (!$this->realtime->enabled()) {
            // the client keeps working over the plain REST endpoints (/student/op-log, /student/violation, ...)
            return response()->json(['success' => false, 'error_code' => 'REALTIME_DISABLED', 'message' => 'Realtime chưa được bật trên máy chủ này.'], 503);
        }

        $user = $request->user();
        $query = ExamAttempt::with(['exam', 'user'])->where('user_id', $user->id);
        $attempt = $request->filled('attempt_id')
            ? $query->whereKey((int) $request->input('attempt_id'))->first()
            : $query->where('status', 'IN_PROGRESS')->latest()->first();

        if (!$attempt || $attempt->status !== 'IN_PROGRESS') {
            return response()->json(['success' => false, 'message' => 'Không có phiên làm bài đang diễn ra.'], 409);
        }

        $exam = $attempt->exam;
        $elapsed = $attempt->started_at ? (int) $attempt->started_at->diffInSeconds(now(), true) : 0;
        $remaining = max(0, $exam->duration_minutes * 60 - $elapsed);
        $ttl = $remaining + 900; // grace for the final flush after the timer ends

        $ingest = rtrim((string) config('services.realtime.ingest_url'), '/');
        $record = rtrim((string) config('services.realtime.record_url'), '/');

        return response()->json([
            'success' => true,
            'data' => [
                'attempt_id' => $attempt->id,
                'exam_id' => $attempt->exam_id,
                'server_time_ms' => (int) (microtime(true) * 1000),
                'remaining_seconds' => $remaining,
                'expires_at' => now()->addSeconds($ttl)->toIso8601String(),
                'ingest' => [
                    'url' => $ingest . '/v1/batch',
                    'time_url' => $ingest . '/v1/time',
                    'token' => $this->realtime->candidateToken($attempt, $ttl),
                    'flush_interval_ms' => 1000,
                    'max_batch_events' => 500,
                    'max_body_bytes' => 1048576,
                    'compress' => 'gzip',
                ],
                'evidence' => [
                    'presign_url' => $record . '/v1/evidence/presign',
                    'commit_url' => $record . '/v1/evidence/{id}/commit',
                    'allowed_content_types' => ['image/jpeg', 'image/png', 'image/webp', 'video/webm', 'video/mp4'],
                ],
                'livekit' => $this->realtime->liveKitToken($attempt, $ttl),
            ],
        ]);
    }
}
