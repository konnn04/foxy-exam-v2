<?php

namespace App\Services;

use App\Models\ExamAttempt;
use App\Models\ExamAttemptAnswer;
use App\Models\Submission;
use App\Support\QuestionSettings;

/** Closes an attempt as SUBMITTED: scores the saved answers and tells the realtime plane. */
class AttemptFinisher
{
    public function __construct(private Realtime $realtime)
    {
    }

    public function submit(ExamAttempt $attempt, ?string $reason = null): ExamAttempt
    {
        $total = 0.0;
        foreach (ExamAttemptAnswer::where('exam_attempt_id', $attempt->id)->with(['question.answers'])->get() as $saved) {
            if (!$saved->question) {
                continue;
            }
            $result = QuestionSettings::grade($saved->question, $saved); // essays stay pending for a teacher
            $saved->update(['score' => $result['score'], 'is_correct' => $result['is_correct']]);
            $total += $result['score'];
        }

        $attempt->update([
            'status' => 'SUBMITTED',
            'submitted_at' => now(),
            'score' => round($total + (float) Submission::where('exam_attempt_id', $attempt->id)->sum('score'), 2),
            'ended_reason' => $reason,
        ]);
        $this->realtime->lifecycle($attempt, 'ended');

        return $attempt;
    }
}
