<?php

namespace App\Support;

/**
 * Every violation FoxyClient / the server / supervisor-agent can raise.
 * Centralizes rule definitions (severity, cooldown_seconds, threshold_seconds, review mode, label)
 * so both backend and client/agent can query the single source of truth via `/api/v1/public/violation-rules`.
 */
final class ViolationCatalog
{
    public const REVIEW = [
        'FACE_MISMATCH', 'MULTIPLE_PEOPLE', 'NO_FACE_DETECTED', 'LOOKING_AWAY', 'GAZE_AWAY', 'FACE_TOO_FAR', 'PROHIBITED_DEVICE', 'SPOT_CHECK_FAILED', 'SPEECH_DETECTED',
    ];

    public const AUTO = [
        'BULK_PASTE', 'SYNTHETIC_INPUT', 'TAB_SWITCH', 'WINDOW_LOST_FOCUS', 'APP_NOT_ALLOWED', 'DEVTOOLS_OPENED',
        'SYSTEM_SHORTCUT', 'BANNED_APP', 'MULTIPLE_MONITORS', 'CAPTURE_DEVICE', 'MULTIPLE_KEYBOARDS', 'DEVICE_CHANGED',
        'CAMERA_LOST', 'MANUAL', 'SCREEN_SHARE_STOPPED', 'OFFLINE_TOO_LONG', 'PHONE_DISCONNECTED', 'PHONE_SCREEN_OFF',
        'PHONE_ORIENTATION_INVALID', 'CAMERA_TAMPERED', 'COPY_ATTEMPT',
    ];

    public const LABELS = [
        'FACE_MISMATCH' => 'Không khớp khuôn mặt đăng ký',
        'MULTIPLE_PEOPLE' => 'Nhiều người trong khung hình',
        'NO_FACE_DETECTED' => 'Không thấy khuôn mặt',
        'LOOKING_AWAY' => 'Quay mặt khỏi màn hình',
        'GAZE_AWAY' => 'Mắt nhìn lệch khỏi màn hình',
        'FACE_TOO_FAR' => 'Ngồi quá xa camera',
        'PROHIBITED_DEVICE' => 'Phát hiện vật cấm qua camera',
        'SPOT_CHECK_FAILED' => 'Không qua kiểm tra camera phụ',
        'PHONE_DISCONNECTED' => 'Camera phụ mất kết nối',
        'PHONE_SCREEN_OFF' => 'Điện thoại phụ tắt màn hình / chuyển tab',
        'PHONE_ORIENTATION_INVALID' => 'Điện thoại phụ đặt sai hướng / úp mặt bàn',
        'CAMERA_TAMPERED' => 'Đổi hoặc can thiệp thiết bị camera giữa ca thi',
        'CAMERA_LOST' => 'Camera chính ngắt giữa ca thi',
        'SCREEN_SHARE_STOPPED' => 'Chia sẻ màn hình dừng giữa ca thi',
        'OFFLINE_TOO_LONG' => 'Mất kết nối mạng kéo dài',
        'COPY_ATTEMPT' => 'Sao chép / cắt nội dung đề',
        'SPEECH_DETECTED' => 'Phát hiện tiếng nói chuyện',
        'BULK_PASTE' => 'Dán khối văn bản lớn',
        'SYNTHETIC_INPUT' => 'Gõ tự động / tốc độ bất thường',
        'TAB_SWITCH' => 'Rời cửa sổ thi',
        'WINDOW_LOST_FOCUS' => 'Mất tiêu điểm cửa sổ',
        'APP_NOT_ALLOWED' => 'Chuyển sang phần mềm ngoài danh sách cho phép',
        'DEVTOOLS_OPENED' => 'Mở công cụ nhà phát triển',
        'SYSTEM_SHORTCUT' => 'Nhấn phím tắt hệ thống',
        'BANNED_APP' => 'Đang chạy phần mềm bị cấm',
        'MULTIPLE_MONITORS' => 'Cắm nhiều màn hình',
        'CAPTURE_DEVICE' => 'Thiết bị ghi/chiếu hình ngoài',
        'MULTIPLE_KEYBOARDS' => 'Nhiều bàn phím',
        'DEVICE_CHANGED' => 'Thay đổi thiết bị ngoại vi khi đang thi',
        'MANUAL' => 'Giám thị ghi nhận trực tiếp',
    ];

    /**
     * Centralized rule parameters (severity, cooldown_seconds, threshold_seconds, lock_screen) for all 30 violation types.
     */
    public const RULES = [
        'FACE_MISMATCH' => ['severity' => 'HIGH', 'cooldown_seconds' => 20, 'threshold_seconds' => 3, 'locks_screen' => false],
        'MULTIPLE_PEOPLE' => ['severity' => 'HIGH', 'cooldown_seconds' => 15, 'threshold_seconds' => 2, 'locks_screen' => false],
        'NO_FACE_DETECTED' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 15, 'threshold_seconds' => 4, 'locks_screen' => false],
        'LOOKING_AWAY' => ['severity' => 'LOW', 'cooldown_seconds' => 15, 'threshold_seconds' => 3, 'locks_screen' => false],
        'GAZE_AWAY' => ['severity' => 'LOW', 'cooldown_seconds' => 15, 'threshold_seconds' => 4, 'locks_screen' => false],
        'FACE_TOO_FAR' => ['severity' => 'LOW', 'cooldown_seconds' => 20, 'threshold_seconds' => 4, 'locks_screen' => false],
        'PROHIBITED_DEVICE' => ['severity' => 'CRITICAL', 'cooldown_seconds' => 15, 'threshold_seconds' => 1, 'locks_screen' => false],
        'SPOT_CHECK_FAILED' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 60, 'threshold_seconds' => 10, 'locks_screen' => false],
        'PHONE_DISCONNECTED' => ['severity' => 'HIGH', 'cooldown_seconds' => 30, 'threshold_seconds' => 5, 'locks_screen' => true],
        'PHONE_SCREEN_OFF' => ['severity' => 'HIGH', 'cooldown_seconds' => 15, 'threshold_seconds' => 1, 'locks_screen' => true],
        'PHONE_ORIENTATION_INVALID' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 25, 'threshold_seconds' => 2, 'locks_screen' => true],
        'CAMERA_TAMPERED' => ['severity' => 'HIGH', 'cooldown_seconds' => 15, 'threshold_seconds' => 0, 'locks_screen' => true],
        'CAMERA_LOST' => ['severity' => 'HIGH', 'cooldown_seconds' => 10, 'threshold_seconds' => 0, 'locks_screen' => true],
        'SCREEN_SHARE_STOPPED' => ['severity' => 'HIGH', 'cooldown_seconds' => 10, 'threshold_seconds' => 0, 'locks_screen' => true],
        'OFFLINE_TOO_LONG' => ['severity' => 'HIGH', 'cooldown_seconds' => 60, 'threshold_seconds' => 300, 'locks_screen' => true],
        'COPY_ATTEMPT' => ['severity' => 'LOW', 'cooldown_seconds' => 2, 'threshold_seconds' => 0, 'locks_screen' => false],
        'SPEECH_DETECTED' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 20, 'threshold_seconds' => 3, 'locks_screen' => false],
        'BULK_PASTE' => ['severity' => 'CRITICAL', 'cooldown_seconds' => 2, 'threshold_seconds' => 0, 'locks_screen' => false],
        'SYNTHETIC_INPUT' => ['severity' => 'HIGH', 'cooldown_seconds' => 5, 'threshold_seconds' => 0, 'locks_screen' => false],
        'TAB_SWITCH' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 2, 'threshold_seconds' => 0, 'locks_screen' => false],
        'WINDOW_LOST_FOCUS' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 2, 'threshold_seconds' => 0, 'locks_screen' => false],
        'APP_NOT_ALLOWED' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 2, 'threshold_seconds' => 0, 'locks_screen' => false],
        'DEVTOOLS_OPENED' => ['severity' => 'HIGH', 'cooldown_seconds' => 10, 'threshold_seconds' => 0, 'locks_screen' => false],
        'SYSTEM_SHORTCUT' => ['severity' => 'LOW', 'cooldown_seconds' => 2, 'threshold_seconds' => 0, 'locks_screen' => false],
        'BANNED_APP' => ['severity' => 'HIGH', 'cooldown_seconds' => 10, 'threshold_seconds' => 0, 'locks_screen' => true],
        'MULTIPLE_MONITORS' => ['severity' => 'HIGH', 'cooldown_seconds' => 10, 'threshold_seconds' => 0, 'locks_screen' => true],
        'CAPTURE_DEVICE' => ['severity' => 'HIGH', 'cooldown_seconds' => 15, 'threshold_seconds' => 0, 'locks_screen' => false],
        'MULTIPLE_KEYBOARDS' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 30, 'threshold_seconds' => 0, 'locks_screen' => false],
        'DEVICE_CHANGED' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 5, 'threshold_seconds' => 0, 'locks_screen' => false],
        'MANUAL' => ['severity' => 'MEDIUM', 'cooldown_seconds' => 0, 'threshold_seconds' => 0, 'locks_screen' => false],
    ];

    public static function label(string $type): string
    {
        return self::LABELS[$type] ?? $type;
    }

    public static function needsReview(string $type): bool
    {
        // a type nobody classified yet is not trusted blindly
        return !in_array($type, self::AUTO, true);
    }

    /** Full catalog payload for API consumers (client, supervisor-agent, admin UI). */
    public static function all(): array
    {
        $out = [];
        foreach (self::LABELS as $type => $label) {
            $rule = self::RULES[$type] ?? ['severity' => 'MEDIUM', 'cooldown_seconds' => 10, 'threshold_seconds' => 0, 'locks_screen' => false];
            $out[$type] = [
                'type' => $type,
                'label' => $label,
                'severity' => $rule['severity'],
                'cooldown_seconds' => $rule['cooldown_seconds'],
                'threshold_seconds' => $rule['threshold_seconds'],
                'locks_screen' => $rule['locks_screen'],
                'needs_review' => self::needsReview($type),
            ];
        }

        return $out;
    }
}
