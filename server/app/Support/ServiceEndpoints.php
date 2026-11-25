<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Addresses of the services the core talks to (AI workers, realtime plane, recorder, LiveKit).
 *
 * The .env value is the default; a Root Admin can override it from the UI without redeploying, so a new AI box or
 * domain is a form edit. Only the ADDRESS is editable here. Secrets (AI_TOKEN, RT_*_SECRET, LIVEKIT_API_*) stay in
 * the environment on purpose: a database dump must never contain them.
 *
 * The addresses the core calls with a secret attached (RT_INGEST_INTERNAL_URL, RT_RECORD_INTERNAL_URL) are NOT
 * editable here: pointing them elsewhere would hand the signing secret to another host. They stay in the environment.
 * The AI services do receive AI_TOKEN, so their addresses refuse link-local / cloud-metadata targets and the change is
 * written to the audit log with the old and new host.
 */
final class ServiceEndpoints
{
    private const CACHE_KEY = 'system_settings.service_endpoints.v1';

    /** key => [config path, label, scheme family, hint] */
    public static function schema(): array
    {
        return [
            'ai_face' => ['services.ai_face.url', 'AI nhận diện khuôn mặt', 'http', 'Dịch vụ so khớp khuôn mặt thí sinh. Ví dụ: https://ai-face.example.edu.vn'],
            'ai_objects' => ['services.ai_objects.url', 'AI phát hiện vật thể cấm', 'http', 'Dịch vụ nhận diện điện thoại, tài liệu… trong khung hình.'],
            'ai_agent' => ['services.ai_agent.url', 'AI giám sát tự động (agent)', 'http', 'Dịch vụ theo dõi camera trong phòng thi theo thời gian thực.'],
            'rt_ingest_public' => ['services.realtime.ingest_url', 'Realtime – địa chỉ cho ứng dụng thí sinh', 'http', 'Địa chỉ mà ứng dụng FoxyClient trên máy thí sinh kết nối tới.'],
            'rt_hub' => ['services.realtime.hub_url', 'Realtime – màn hình giám thị', 'ws', 'Địa chỉ WebSocket mà trang theo dõi giờ thi kết nối tới.'],
            'rt_record_public' => ['services.realtime.record_url', 'Ghi hình – địa chỉ công khai', 'http', 'Địa chỉ tải video bằng chứng về trình duyệt.'],
            'livekit' => ['services.realtime.livekit.url', 'LiveKit (camera/màn hình)', 'ws', 'Địa chỉ wss:// mà trình duyệt và ứng dụng thí sinh kết nối tới.'],
        ];
    }

    /** @return array<string, string> key => stored override (empty = using .env) */
    private static function stored(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            if (!Schema::hasTable('system_settings')) {
                return [];
            }

            return DB::table('system_settings')->where('key', 'like', 'service.%')->pluck('value', 'key')
                ->mapWithKeys(fn ($v, $k) => [substr($k, 8) => (string) $v])->all();
        });
    }

    /** Called on boot: overlays the stored addresses on the config. A broken/missing table must never stop the app. */
    public static function apply(): void
    {
        try {
            foreach (self::stored() as $key => $value) {
                if ($value !== '' && isset(self::schema()[$key])) {
                    config([self::schema()[$key][0] => $value]);
                }
            }
        } catch (\Throwable) {
            // before the first migration, or the database is down: keep the .env values
        }
    }

    /** For the editor: current effective value, what .env alone gives, and whether an override is active. */
    public static function forEditor(): array
    {
        $stored = self::stored();
        $rows = [];
        foreach (self::schema() as $key => [$path, $label, , $hint]) {
            $override = $stored[$key] ?? '';
            $rows[] = [
                'key' => $key,
                'label' => $label,
                'hint' => $hint,
                'value' => $override,
                'effective' => (string) config($path),
                'overridden' => $override !== '',
            ];
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $input  key => URL ('' removes the override)
     * @return array<string, string> key => error message
     */
    public static function save(array $input): array
    {
        $errors = [];
        foreach ($input as $key => $value) {
            if (!isset(self::schema()[$key])) {
                continue;
            }
            $value = rtrim(trim(is_scalar($value) ? (string) $value : ''), '/');
            $family = self::schema()[$key][2];
            $allowed = $family === 'ws' ? '(wss?|https?)' : '(https?)';
            if ($value !== '' && !preg_match('#^' . $allowed . '://[A-Za-z0-9.\-]+(:\d{1,5})?(/[^\s]*)?$#', $value)) {
                $errors[$key] = $family === 'ws' ? 'Địa chỉ phải bắt đầu bằng ws://, wss://, http:// hoặc https://.' : 'Địa chỉ phải bắt đầu bằng http:// hoặc https://.';

                continue;
            }
            if ($value !== '' && self::isForbiddenHost((string) parse_url($value, PHP_URL_HOST))) {
                $errors[$key] = 'Địa chỉ này không được phép (địa chỉ nội bộ của nhà cung cấp đám mây).';

                continue;
            }
            if ($value === '') {
                DB::table('system_settings')->where('key', "service.{$key}")->delete();
            } else {
                DB::table('system_settings')->upsert(
                    [['key' => "service.{$key}", 'value' => $value, 'created_at' => now(), 'updated_at' => now()]],
                    ['key'],
                    ['value', 'updated_at'],
                );
            }
        }
        Cache::forget(self::CACHE_KEY);
        // a changed AI address must be pinged again right away, not after the cached verdict expires
        foreach (['face', 'objects', 'agent'] as $w) {
            Cache::forget("foxy_ai_ping_{$w}");
        }

        return $errors;
    }

    /** Link-local (169.254.0.0/16, fe80::/10) and cloud metadata names: never a legitimate AI or realtime service. */
    private static function isForbiddenHost(string $host): bool
    {
        $host = strtolower(trim($host, '[]'));
        if (in_array($host, ['metadata.google.internal', 'metadata', 'instance-data'], true)) {
            return true;
        }
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return str_starts_with($host, '169.254.') || str_starts_with($host, 'fe80:');
        }

        return false;
    }

    /** key => host, for the audit trail (never the full URL: it may carry a path or port the log does not need). */
    public static function hosts(): array
    {
        return collect(self::stored())->map(fn ($v) => (string) parse_url($v, PHP_URL_HOST))->all();
    }
}
