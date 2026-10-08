<?php

namespace App\Support;

use App\Models\User;
use App\Services\AiService;
use Illuminate\Support\Facades\Storage;

/** The enrolled face photo of a student: stored privately, checked by the face service before it is accepted. */
final class FaceReference
{
    public static function disk()
    {
        return Storage::disk('local');
    }

    public static function path(User $user): string
    {
        return "faces/{$user->id}.jpg";
    }

    public static function has(User $user): bool
    {
        return $user->face_enrolled_at !== null && self::disk()->exists(self::path($user));
    }

    public static function bytes(User $user): ?string
    {
        return self::has($user) ? (string) self::disk()->get(self::path($user)) : null;
    }

    /**
     * Stores the photo when the face service sees exactly one face in it.
     * @return array{ok:bool,message:string}
     */
    public static function enroll(User $user, string $jpeg): array
    {
        if (AiService::endpoints() !== [] || !app()->environment('testing')) {
            $faces = AiService::faces($jpeg);
            if ($faces === null) {
                return ['ok' => false, 'message' => 'Dịch vụ AI khuôn mặt chưa phản hồi, thử lại sau.'];
            }
            if (($faces['count'] ?? 0) !== 1) {
                return ['ok' => false, 'message' => ($faces['count'] ?? 0) === 0 ? 'Không thấy khuôn mặt trong ảnh. Nhìn thẳng vào camera, đủ sáng.' : 'Ảnh có nhiều hơn một khuôn mặt.'];
            }
            if (($faces['faces'][0]['score'] ?? 1) < 0.7) {
                return ['ok' => false, 'message' => 'Ảnh chưa đủ rõ khuôn mặt. Chụp lại ở nơi đủ sáng.'];
            }
        }
        self::disk()->put(self::path($user), $jpeg);
        $user->forceFill(['face_photo' => self::path($user), 'face_enrolled_at' => now()])->save();

        return ['ok' => true, 'message' => 'Đã lưu khuôn mặt.'];
    }

    public static function delete(User $user): void
    {
        self::disk()->delete(self::path($user));
        $user->forceFill(['face_photo' => null, 'face_enrolled_at' => null, 'face_locked_at' => null])->save();
    }
}
