<?php

namespace App\Support;

/**
 * Every violation FoxyClient / the server can raise. `review` marks the ones that depend on a probability
 * (AI, a camera guess, a person's judgement): they wait for a proctor. The rest are facts the client
 * observed itself and are stored as already confirmed. docs/VIOLATIONS.md documents each rule.
 */
final class ViolationCatalog
{
    public const REVIEW = [
        'FACE_MISMATCH', 'MULTIPLE_PEOPLE', 'NO_FACE_DETECTED', 'LOOKING_AWAY', 'GAZE_AWAY', 'FACE_TOO_FAR', 'PROHIBITED_DEVICE', 'SPOT_CHECK_FAILED',
    ];

    public const AUTO = [
        'BULK_PASTE', 'SYNTHETIC_INPUT', 'TAB_SWITCH', 'WINDOW_LOST_FOCUS', 'APP_NOT_ALLOWED', 'DEVTOOLS_OPENED',
        'SYSTEM_SHORTCUT', 'BANNED_APP', 'MULTIPLE_MONITORS', 'CAPTURE_DEVICE', 'MULTIPLE_KEYBOARDS', 'DEVICE_CHANGED',
        'CAMERA_LOST', 'SCREEN_SHARE_STOPPED', 'OFFLINE_TOO_LONG', 'PHONE_DISCONNECTED',
    ];

    public static function needsReview(string $type): bool
    {
        // a type nobody classified yet is not trusted blindly
        return !in_array($type, self::AUTO, true);
    }
}
