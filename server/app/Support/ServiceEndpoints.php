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
            'rt_ingest_internal' => ['services.realtime.ingest_internal_url', 'Realtime – địa chỉ nội bộ', 'http', 'Địa chỉ máy chủ này dùng để gọi dịch vụ realtime (thường là tên container).'],
            'rt_hub' => ['services.realtime.hub_url', 'Realtime – màn hình giám thị', 'ws', 'Địa chỉ WebSocket mà trang theo dõi giờ thi kết nối tới.'],
            'rt_record_public' => ['services.realtime.record_url', 'Ghi hình – địa chỉ công khai', 'http', 'Địa chỉ tải video bằng chứng về trình duyệt.'],
            'rt_record_internal' => ['services.realtime.record_internal_url', 'Ghi hình – địa chỉ nội bộ', 'http', 'Địa chỉ máy chủ này dùng để gọi dịch vụ ghi hình.'],
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
}
