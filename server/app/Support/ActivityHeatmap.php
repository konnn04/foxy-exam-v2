<?php

namespace App\Support;

use App\Models\EditOpLog;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Violation;

/**
 * When did each candidate interact the most? Rows = attempts, columns = time buckets of the exam, cell = keystrokes +
 * mouse clicks reported by the app in that bucket (the op-log batches it already sends), plus the violations in it.
 *
 * A cell is marked "unusual" when it is far above the room at the same moment (>= 4x the median of the candidates who
 * were active then) or far above the candidate's own average (>= 5x), and big enough to matter. That is a hint for a
 * proctor to look, never a violation by itself.
 */
final class ActivityHeatmap
{
    private const MAX_COLUMNS = 60;
    private const MIN_EVENTS = 30;

    /** @return array{bucket_seconds:int, start:?string, columns:int, max:int, rows:array<int, array<string, mixed>>} */
    public static function forExam(Exam $exam): array
    {
        $attempts = ExamAttempt::with('user:id,name,username')->where('exam_id', $exam->id)->whereNotNull('started_at')->get(['id', 'user_id', 'started_at', 'submitted_at', 'status']);
        if ($attempts->isEmpty()) {
            return ['bucket_seconds' => 60, 'start' => null, 'columns' => 0, 'max' => 0, 'rows' => []];
        }
        $ids = $attempts->pluck('id')->all();
        $logs = EditOpLog::whereIn('exam_attempt_id', $ids)->orderBy('created_at')->get(['exam_attempt_id', 'created_at', 'keystroke_count', 'synthetic_flags']);
        $violations = Violation::withoutGlobalScopes()->whereIn('exam_attempt_id', $ids)->get(['exam_attempt_id', 'timestamp', 'severity']);

        $start = $attempts->min(fn ($a) => $a->started_at->getTimestamp());
        $end = max(
            $start + 60,
            (int) ($logs->max(fn ($l) => $l->created_at?->getTimestamp()) ?? 0),
            (int) ($violations->max(fn ($v) => $v->timestamp?->getTimestamp()) ?? 0),
            (int) $attempts->max(fn ($a) => $a->submitted_at?->getTimestamp() ?? 0),
        );
        // whole minutes per column, at most MAX_COLUMNS columns
        $bucket = max(60, (int) ceil(($end - $start + 1) / self::MAX_COLUMNS / 60) * 60);
        $columns = (int) ceil(($end - $start + 1) / $bucket);
        $col = fn (int $ts) => max(0, min($columns - 1, intdiv($ts - $start, $bucket)));

        $cells = [];
        $viol = [];
        foreach ($attempts as $a) {
            $cells[$a->id] = array_fill(0, $columns, 0);
            $viol[$a->id] = array_fill(0, $columns, 0);
        }
        foreach ($logs as $l) {
            if (!$l->created_at) {
                continue;
            }
            $flags = is_array($l->synthetic_flags) ? $l->synthetic_flags : [];
            $clicks = isset($flags['mouse_count']) ? (int) $flags['mouse_count'] : (is_array($flags['mouse_clicks'] ?? null) ? count($flags['mouse_clicks']) : 0);
            $cells[$l->exam_attempt_id][$col($l->created_at->getTimestamp())] += max(0, (int) $l->keystroke_count) + max(0, $clicks);
        }
        foreach ($violations as $v) {
            if ($v->timestamp) {
                $viol[$v->exam_attempt_id][$col($v->timestamp->getTimestamp())]++;
            }
        }

        // the room at each moment: median of the candidates active in that column
        $median = [];
        for ($c = 0; $c < $columns; $c++) {
            $active = array_values(array_filter(array_map(fn ($row) => $row[$c], $cells), fn ($x) => $x > 0));
            sort($active);
            $n = count($active);
            $median[$c] = $n === 0 ? 0 : ($n % 2 ? $active[intdiv($n, 2)] : ($active[$n / 2 - 1] + $active[$n / 2]) / 2);
        }

        $rows = [];
        $max = 0;
        foreach ($attempts as $a) {
            $row = $cells[$a->id];
            $activeCols = array_filter($row, fn ($x) => $x > 0);
            $own = count($activeCols) ? array_sum($activeCols) / count($activeCols) : 0;
            $flags = [];
            foreach ($row as $c => $x) {
                $max = max($max, $x);
                $flags[$c] = $x >= self::MIN_EVENTS && (($median[$c] > 0 && $x >= 4 * $median[$c]) || ($own > 0 && $x >= 5 * $own));
            }
            $rows[] = [
                'attempt_id' => $a->id,
                'name' => $a->user?->name ?? $a->user?->username ?? ('#' . $a->id),
                'status' => $a->status,
                'cells' => $row,
                'violations' => $viol[$a->id],
                'unusual' => $flags,
            ];
        }

        return [
            'bucket_seconds' => $bucket,
            'start' => date(DATE_ATOM, $start),
            'columns' => $columns,
            'max' => $max,
            'rows' => $rows,
        ];
    }
}
