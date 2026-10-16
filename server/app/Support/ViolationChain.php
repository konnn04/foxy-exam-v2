<?php

namespace App\Support;

use App\Models\Violation;

/** Tamper evidence for an attempt's violation log: hash(prev_hash, immutable facts) per row, in id order. Details, reviews and clips are not covered because they legitimately change. */
final class ViolationChain
{
    public static function hash(string $prev, int $attemptId, string $type, string $severity, int $timestamp, ?string $clientEventId): string
    {
        return hash('sha256', implode('|', [$prev, $attemptId, $type, $severity, $timestamp, $clientEventId ?? '']));
    }

    public static function forNew(Violation $v): string
    {
        $prev = (string) Violation::withoutGlobalScopes()->where('exam_attempt_id', $v->exam_attempt_id)->whereNotNull('chain_hash')->orderByDesc('id')->value('chain_hash');

        return self::hash($prev, (int) $v->exam_attempt_id, (string) $v->violation_type, (string) $v->severity, \Carbon\Carbon::parse($v->timestamp)->getTimestamp(), $v->client_event_id);
    }

    /** @return array{ok:bool, checked:int, unchained:int, broken_at:?int} */
    public static function verify(int $attemptId): array
    {
        $prev = '';
        $checked = $unchained = 0;
        foreach (Violation::withoutGlobalScopes()->where('exam_attempt_id', $attemptId)->orderBy('id')->cursor() as $v) {
            if ($v->chain_hash === null) {
                $unchained++;
                continue;
            }
            $expected = self::hash($prev, $attemptId, $v->violation_type, $v->severity, $v->timestamp->getTimestamp(), $v->client_event_id);
            if (!hash_equals($expected, $v->chain_hash)) {
                return ['ok' => false, 'checked' => $checked, 'unchained' => $unchained, 'broken_at' => $v->id];
            }
            $prev = $v->chain_hash;
            $checked++;
        }

        return ['ok' => true, 'checked' => $checked, 'unchained' => $unchained, 'broken_at' => null];
    }
}
