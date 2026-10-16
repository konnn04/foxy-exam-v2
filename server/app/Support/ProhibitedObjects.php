<?php

namespace App\Support;

/** COCO classes the object service can recognise that make sense in an exam room. Used when an exam does not choose its own. */
final class ProhibitedObjects
{
    public const LABELS = [
        'cell phone' => 'Điện thoại',
        'laptop' => 'Laptop',
        'book' => 'Sách, tài liệu',
        'remote' => 'Điều khiển',
        'tv' => 'Màn hình / TV',
        'keyboard' => 'Bàn phím rời',
        'mouse' => 'Chuột',
        'backpack' => 'Ba lô',
        'handbag' => 'Túi xách',
        'scissors' => 'Kéo',
    ];

    public const DEFAULT = ['cell phone', 'laptop', 'book', 'remote', 'tv'];

    /** @return list<string> only known classes, no duplicates; the default set when nothing valid is left */
    public static function clean(mixed $labels): array
    {
        $clean = array_values(array_unique(array_filter((array) $labels, fn ($l) => is_string($l) && isset(self::LABELS[$l]))));

        return $clean ?: self::DEFAULT;
    }
}
