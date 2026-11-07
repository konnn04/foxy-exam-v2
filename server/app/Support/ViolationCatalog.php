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

    public static function label(string $type): string
    {
        return self::LABELS[$type] ?? $type;
    }

    public static function needsReview(string $type): bool
    {
        // a type nobody classified yet is not trusted blindly
        return !in_array($type, self::AUTO, true);
    }
}
