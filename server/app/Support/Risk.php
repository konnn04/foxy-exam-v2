<?php

namespace App\Support;

use App\Models\ExamAttempt;

/** Risk scoring shared by every path that records a violation (REST, realtime bulk). */
class Risk
{
    public const FLAG_THRESHOLD = 40;

    public static function weight(string $severity): int
    {
        return match ($severity) {
            'LOW' => 5,
            'MEDIUM' => 15,
            'HIGH' => 30,
            'CRITICAL' => 60,
            default => 10,
        };
    }

    public static function apply(ExamAttempt $attempt, int $points): void
    {
        if ($points <= 0) {
            return;
        }
        $attempt->increment('risk_score', $points);
        if ($attempt->risk_score >= self::FLAG_THRESHOLD && !$attempt->is_flagged) {
            $attempt->update(['is_flagged' => true]);
        }
    }

    /** A pasted block of code (op-log analysis): how severe and how many risk points. */
    public static function bulkPaste(int $charsCount): array
    {
        return $charsCount > 100 ? ['CRITICAL', 50] : ['HIGH', 25];
    }
}
