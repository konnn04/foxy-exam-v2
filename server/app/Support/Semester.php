<?php

namespace App\Support;

use Carbon\CarbonInterface;

/**
 * Vietnamese academic calendar, derived from an exam's date (courses carry no semester column):
 *   Sep–Dec            → HK1 of the year that starts in that September
 *   Jan                → HK1 of the previous academic year (the exam period of the first term)
 *   Feb–Jun            → HK2
 *   Jul–Aug            → Học kỳ hè
 * A school with another calendar can still read the numbers by exam date; only the grouping label differs.
 */
final class Semester
{
    public static function of(?CarbonInterface $date): string
    {
        if (!$date) {
            return 'Chưa xếp lịch';
        }
        $m = (int) $date->format('n');
        $y = (int) $date->format('Y');
        $start = $m >= 9 ? $y : $y - 1;
        $term = match (true) {
            $m >= 9 || $m === 1 => 'HK1',
            $m <= 6 => 'HK2',
            default => 'HK hè',
        };

        return "{$start}-" . ($start + 1) . " · {$term}";
    }
}
