<?php

namespace App\Services;

use App\Models\ExamAttempt;
use App\Models\ExamAttemptAnswer;
use App\Models\Submission;
use App\Support\QuestionSettings;
use Illuminate\Support\Facades\DB;

/**
 * Closes an attempt as SUBMITTED: scores the saved answers and tells the realtime plane.
 *
 * Reasons: null = the candidate pressed submit, TIME_UP = the time ran out, ABSENT = disconnected for too long.
 * The row is locked and only a running attempt is closed, so the sweeper and a late submit never close it twice.
 */
class AttemptFinisher
{
    public const OPEN = ['NOT_STARTED', 'IN_PROGRESS'];

    public function __construct(private Realtime $realtime)
    {
    }

    public function submit(ExamAttempt $attempt, ?string $reason = null): ExamAttempt
    {
        $closed = DB::transaction(function () use ($attempt, $reason) {
            $row = ExamAttempt::whereKey($attempt->id)->lockForUpdate()->first();
            if (!$row || !in_array($row->status, self::OPEN, true)) {
                return false;
            }

            $total = 0.0;
            foreach (ExamAttemptAnswer::where('exam_attempt_id', $row->id)->with(['question.answers'])->get() as $saved) {
                if (!$saved->question) {
                    continue;
                }
                $result = QuestionSettings::grade($saved->question, $saved); // essays stay pending for a teacher
                $saved->update(['score' => $result['score'], 'is_correct' => $result['is_correct']]);
                $total += $result['score'];
            }

            $row->update([
                'status' => 'SUBMITTED',
                'submitted_at' => now(),
                'score' => round($total + (float) Submission::where('exam_attempt_id', $row->id)->sum('score'), 2),
                'ended_reason' => $reason,
            ]);

            return true;
        });

        $attempt->refresh();
        if ($closed) {
            $this->realtime->lifecycle($attempt, 'ended');
        }

        return $attempt;
    }
}
