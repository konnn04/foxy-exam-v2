<?php

namespace App\Support;

use App\Services\AiService;
use Illuminate\Validation\ValidationException;

/**
 * Rules between monitoring options: a sub-option never stays on when its main option is off, so the stored
 * config (and every client reading it) can rely on that.
 *
 *   ai_face_check  (camera + on-device MediaPipe)   -> ai_identity (face service), ai_objects (object service)
 *   extra_camera   (phone: off | optional | required) -> extra_camera_objects, extra_camera_spot_check
 */
final class MonitoringConfig
{
    public const REQUEST_RULES = [
        'ai_identity' => ['nullable', 'boolean'],
        'ai_objects' => ['nullable', 'boolean'],
        'extra_camera_objects' => ['nullable', 'boolean'],
        'extra_camera_spot_check' => ['nullable', 'boolean'],
    ];

    /** Copies the AI / extra-camera options of a validated request into the config and applies the dependencies. */
    public static function fromRequest(array $config, array $validated): array
    {
        foreach (['ai_identity', 'ai_objects', 'extra_camera_objects', 'extra_camera_spot_check'] as $k) {
            $config[$k] = (bool) ($validated[$k] ?? false);
        }

        return self::normalize($config);
    }

    public static function normalize(array $c): array
    {
        $camera = !empty($c['ai_face_check']);
        $c['ai_identity'] = $camera && !empty($c['ai_identity']);
        $c['ai_objects'] = $camera && !empty($c['ai_objects']);

        $extra = in_array($c['extra_camera'] ?? 'off', ['off', 'optional', 'required'], true) ? $c['extra_camera'] : 'off';
        $c['extra_camera'] = $extra;
        $c['extra_camera_objects'] = $extra !== 'off' && !empty($c['extra_camera_objects']);
        $c['extra_camera_spot_check'] = $extra !== 'off' && !empty($c['extra_camera_spot_check']);

        return $c;
    }

    /**
     * An AI feature may only be switched ON while its service answers a ping (features that were already on stay on:
     * a temporary outage must not make an existing exam impossible to edit).
     */
    public static function assertServicesReachable(array $new, array $old = []): void
    {
        $errors = [];
        if (!empty($new['ai_identity']) && empty($old['ai_identity']) && !AiService::serviceOnline('face')) {
            $errors['ai_identity'] = 'Dịch vụ AI khuôn mặt chưa phản hồi (ping thất bại) nên chưa thể bật xác thực sinh viên.';
        }
        $objects = !empty($new['ai_objects']) && empty($old['ai_objects']) || !empty($new['extra_camera_objects']) && empty($old['extra_camera_objects']);
        if ($objects && !AiService::serviceOnline('objects')) {
            $errors['ai_objects'] = 'Dịch vụ AI vật cấm chưa phản hồi (ping thất bại) nên chưa thể bật giám sát vật cấm.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }
}
