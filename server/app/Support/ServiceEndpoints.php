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
 * Traffic from users (browsers, the candidate app) always enters through the API gateway. The addresses it uses
 * (RT_INGEST_URL, RT_HUB_URL, RT_RECORD_URL = https://<gateway>/rt/...) are therefore NOT editable here either, so a
 * form edit can never send users around the gateway. The AI services are called only by the core and by the
 * supervisor agent, never by a browser or the candidate app; LiveKit is the one public address outside the gateway
 * (WebRTC media), kept separate by design.
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
     * All-or-nothing: every key is validated first and nothing is written unless all of them pass, so a rejected
     * request can never leave a half-applied change behind.
     *
     * @param  array<string, mixed>  $input  key => URL ('' removes the override)
     * @return array<string, string> key => error message (empty = saved)
     */
    public static function save(array $input): array
    {
        $errors = [];
        $clean = [];
        foreach ($input as $key => $value) {
            if (!isset(self::schema()[$key])) {
                continue;
            }
            $value = rtrim(trim(is_scalar($value) ? (string) $value : ''), '/');
            $family = self::schema()[$key][2];
            $allowed = $family === 'ws' ? '(wss?|https?)' : '(https?)';
            if ($value !== '' && !preg_match('#^' . $allowed . '://[A-Za-z0-9.\-]+(:\d{1,5})?(/[^\s]*)?$#', $value)) {
                $errors[$key] = $family === 'ws' ? 'Địa chỉ phải bắt đầu bằng ws://, wss://, http:// hoặc https://.' : 'Địa chỉ phải bắt đầu bằng http:// hoặc https://.';
            } elseif ($value !== '' && self::isForbiddenHost((string) parse_url($value, PHP_URL_HOST))) {
                $errors[$key] = 'Địa chỉ này không được phép (địa chỉ nội bộ của nhà cung cấp đám mây).';
            } else {
                $clean[$key] = $value;
            }
        }
        if ($errors) {
            return $errors;
        }

        DB::transaction(function () use ($clean) {
            foreach ($clean as $key => $value) {
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
        });
        Cache::forget(self::CACHE_KEY);
        // a changed AI address must be pinged again right away, not after the cached verdict expires
        foreach (['face', 'objects', 'agent'] as $w) {
            Cache::forget("foxy_ai_ping_{$w}");
        }

        return [];
    }

    /**
     * Link-local (169.254.0.0/16, fe80::/10) and cloud metadata names: never a legitimate AI or realtime service.
     * The name is resolved and every address it maps to is checked too, so "metadata.attacker.com -> 169.254.169.254"
     * is refused. Odd spellings of an IP (all digits, 0x…, trailing dot) are refused outright. A name that does not
     * resolve yet is allowed (the service may not be up when it is saved). DNS can still change after this check; the
     * AI token is the secret at stake and is scoped to AI calls only (see AI_TOKEN in .env.example).
     */
    private static function isForbiddenHost(string $host): bool
    {
        $host = strtolower(trim($host, '[]'));
        if ($host === '' || str_ends_with($host, '.') || preg_match('/^(0x[0-9a-f]+|\d+)$/', $host)) {
            return true;
        }
        if (in_array($host, ['metadata.google.internal', 'metadata', 'instance-data'], true)) {
            return true;
        }
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        foreach ($ips as $ip) {
            if (str_starts_with($ip, '169.254.') || str_starts_with(strtolower($ip), 'fe80:')) {
                return true;
            }
        }

        return false;
    }

    /** key => host, for the audit trail (never the full URL: it may carry a path or port the log does not need). */
    public static function hosts(): array
    {
        return collect(self::stored())->map(fn ($v) => (string) parse_url($v, PHP_URL_HOST))->all();
    }
}
