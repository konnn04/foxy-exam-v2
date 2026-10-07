<?php

namespace App\Support;

use App\Models\ExamAttempt;
use Illuminate\Http\Request;

/**
 * Which attempt a request of the legacy student endpoints (paper, heartbeat, op-log, violation, submit, finish)
 * is about. A student can hold several attempts (retakes, several exams), so the client names the attempt in
 * the X-Foxy-Attempt header; without it the latest running one is used, as before.
 */
class AttemptResolver
{
    public const HEADER = 'X-Foxy-Attempt';

    public static function for(Request $request, bool $onlyRunning = true): ?ExamAttempt
    {
        $query = ExamAttempt::where('user_id', $request->user()->id);
        if ($onlyRunning) {
            $query->where('status', 'IN_PROGRESS');
        }

        $id = (int) $request->header(self::HEADER);

        // an explicit but foreign / finished attempt id must not silently fall back to another attempt
        return $id > 0 ? $query->whereKey($id)->first() : $query->orderByDesc('id')->first();
    }
}
