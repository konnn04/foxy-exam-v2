<?php

namespace App\Support;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamPrecheck;
use App\Models\User;
use App\Models\Violation;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The lobby check, decided by the server. FoxyClient sends what it measured; the server applies the exam's policy
 * (OS, virtual machine, virtual camera, remote desktop, required checks) and, when everything passes, hands out a
 * single-use token bound to the candidate, the exam and the machine. `start` (new attempt or resume) needs it.
 *
 * Each start also rotates the attempt's session key: a window or machine still holding the old key can no longer
 * load the paper or save answers, so a restarted machine has to pass the precheck again before it continues.
 */
final class Precheck
{
    public const OS = ['windows', 'macos', 'linux'];

    /** Camera names of known virtual camera drivers (OBS, ManyCam, phone-as-webcam apps, v4l2loopback...). */
    public const VIRTUAL_CAMERAS = [
        'obs virtual', 'obs-camera', 'manycam', 'xsplit', 'snap camera', 'splitcam', 'droidcam', 'iriun', 'epoccam',
        'ivcam', 'e2esoft', 'vcam', 'youcam', 'camtwist', 'nvidia broadcast', 'logi capture', 'mmhmm', 'camo',
        'dummy video device', 'v4l2loopback', 'virtual camera', 'virtual webcam', 'unity video capture', 'newtek ndi',
        'ndi webcam', 'chromacam', 'vtuber', 'animaze', 'facerig', 'webcamoid', 'altercam', 'fake webcam',
    ];

    public static function isVirtualCamera(?string $label): bool
    {
        $l = strtolower(trim((string) $label));
        if ($l === '') {
            return false;
        }
        foreach (self::VIRTUAL_CAMERAS as $w) {
            if ($w === 'camo' ? preg_match('/\bcamo\b/', $l) : str_contains($l, $w)) {
                return true;
            }
        }

        return false;
    }

    /** @return string[] what blocks this candidate from starting, in plain Vietnamese (empty = passed) */
    public static function evaluate(Exam $exam, array $checks, array $env): array
    {
        $cfg = MonitoringConfig::normalize(array_merge(['ai_face_check' => true], (array) $exam->monitoring_config));
        $reasons = [];
        $dev = config('foxy.precheck.allow_dev') && !empty($env['dev']);

        if (empty($env['os_family'])) {
            return ['FoxyClient trên máy này đã cũ, chưa gửi được thông tin kiểm tra. Hãy cập nhật FoxyClient rồi thử lại.'];
        }

        $allowed = (array) ($cfg['allowed_os'] ?? []);
        if ($allowed && !in_array($env['os_family'], $allowed, true)) {
            $names = ['windows' => 'Windows', 'macos' => 'macOS', 'linux' => 'Linux'];
            $reasons[] = 'Kỳ thi chỉ cho phép thi trên ' . implode(', ', array_map(fn ($o) => $names[$o] ?? $o, $allowed)) . '.';
        }
        if (!empty($cfg['block_vm']) && !empty($env['vm']['detected']) && !$dev) {
            $reasons[] = 'Máy đang chạy trong máy ảo' . (!empty($env['vm']['vendor']) ? ' (' . Str::limit((string) $env['vm']['vendor'], 40) . ')' : '') . '. Hãy thi trên máy thật.';
        }
        if (!empty($env['remote_session'])) {
            $reasons[] = 'Máy đang được điều khiển từ xa (Remote Desktop). Hãy ngồi trực tiếp tại máy để thi.';
        }
        if (!empty($cfg['block_virtual_camera']) && !$dev) {
            $virtual = array_values(array_filter(array_merge((array) ($env['virtual_cameras'] ?? []), [$env['camera_label'] ?? null]), fn ($c) => self::isVirtualCamera(is_string($c) ? $c : null)));
            if ($virtual) {
                $reasons[] = 'Phát hiện camera ảo: ' . Str::limit(implode(', ', array_unique($virtual)), 120) . '. Gỡ hoặc tắt phần mềm camera ảo rồi kiểm tra lại.';
            }
        }
        if (!$dev && !empty($env['capture_devices'])) {
            $reasons[] = 'Có thiết bị capture / video-in: ' . Str::limit(implode(', ', (array) $env['capture_devices']), 120) . '.';
        }
        if (!$dev && (int) ($env['displays'] ?? 1) > 1) {
            $reasons[] = 'Đang dùng ' . (int) $env['displays'] . ' màn hình. Chỉ được dùng một màn hình.';
        }

        $required = ['network', 'exam', 'display', 'apps'];
        if (!empty($cfg['ai_face_check'])) {
            array_push($required, 'camera', 'face');
        }
        if (!empty($cfg['ai_identity'])) {
            array_push($required, 'liveness', 'enroll');
        }
        if (($cfg['extra_camera'] ?? 'off') === 'required') {
            $required[] = 'phone';
        }
        if (!empty($cfg['require_mic'])) {
            $required[] = 'mic';
        }
        if (!empty($cfg['require_screen'])) {
            $required[] = 'screen';
        }
        $names = [
            'network' => 'kết nối máy chủ', 'exam' => 'kỳ thi', 'display' => 'màn hình', 'apps' => 'ứng dụng bị cấm', 'camera' => 'camera',
            'face' => 'nhận diện khuôn mặt', 'liveness' => 'kiểm tra người thật', 'enroll' => 'khuôn mặt đăng ký', 'phone' => 'camera phụ',
            'mic' => 'micro', 'screen' => 'chia sẻ màn hình',
        ];
        $missing = [];
        foreach ($required as $id) {
            $level = $checks[$id] ?? null;
            $ok = $level === 'ok' || ($level === 'warn' && ($id === 'network' || $dev));
            if (!$ok) {
                $missing[] = $names[$id];
            }
        }
        if ($missing) {
            $reasons[] = 'Chưa đạt: ' . implode(', ', $missing) . '.';
        }

        return $reasons;
    }

    /** Records the check; a passed one gets a token. Returns [row, token|null]. */
    public static function record(Request $request, User $user, Exam $exam, array $checks, array $env, array $device): array
    {
        $reasons = self::evaluate($exam, $checks, $env);
        $token = $reasons ? null : Str::random(48);
        $row = ExamPrecheck::create([
            'user_id' => $user->id,
            'exam_id' => $exam->id,
            'token_hash' => $token ? hash('sha256', $token) : null,
            'passed' => !$reasons,
            'reasons' => $reasons ?: null,
            'checks' => array_intersect_key($checks, array_flip(['network', 'exam', 'display', 'apps', 'camera', 'face', 'liveness', 'enroll', 'phone', 'mic', 'screen'])),
            'env' => self::cleanEnv($env),
            'fingerprint' => isset($device['fingerprint']) ? Str::limit((string) $device['fingerprint'], 80, '') : null,
            'boot_time' => isset($env['boot_time']) ? (int) $env['boot_time'] : null,
            'os_family' => in_array($env['os_family'] ?? null, self::OS, true) ? $env['os_family'] : null,
            'ip' => $request->ip(),
            'expires_at' => $token ? now()->addMinutes(max(1, (int) config('foxy.precheck.ttl'))) : null,
        ]);

        return [$row, $token];
    }

    /** The passed, unused, unexpired precheck behind $token for this candidate, exam and machine. */
    public static function find(?string $token, User $user, Exam $exam, array $device): ?ExamPrecheck
    {
        if (!$token) {
            return null;
        }
        $row = ExamPrecheck::where('token_hash', hash('sha256', $token))
            ->where('user_id', $user->id)->where('exam_id', $exam->id)
            ->where('passed', true)->whereNull('used_at')->where('expires_at', '>', now())
            ->first();
        $fp = $device['fingerprint'] ?? null;
        if ($row && $row->fingerprint && $fp && !hash_equals($row->fingerprint, (string) $fp)) {
            return null; // checked on one machine, started on another
        }

        return $row;
    }

    /**
     * Ties a precheck to the attempt it opened, records a restart or a network change on a resume, and rotates the
     * session key. Returns the new key (only the client that just started holds it).
     */
    public static function enter(ExamAttempt $attempt, ?ExamPrecheck $check, Request $request, bool $resumed): string
    {
        $device = is_array($attempt->device_info) ? $attempt->device_info : [];
        if ($check) {
            $check->update(['used_at' => now(), 'exam_attempt_id' => $attempt->id]);
            if ($resumed && !empty($device['boot_time']) && $check->boot_time && abs($check->boot_time - (int) $device['boot_time']) > 120) {
                self::flag($attempt, 'DEVICE_RESTARTED', 'MEDIUM', ['previous_boot' => (int) $device['boot_time'], 'boot' => $check->boot_time]);
            }
            $device['boot_time'] = $check->boot_time ?? ($device['boot_time'] ?? null);
            $device['env'] = $check->env;
            $device['precheck_id'] = $check->id;
        }
        if ($resumed && !empty($device['ip']) && $device['ip'] !== $request->ip()) {
            self::flag($attempt, 'IP_CHANGED', 'LOW', ['from' => $device['ip'], 'to' => $request->ip(), 'when' => 'resume']);
        }
        $device['ip'] = $request->ip();

        $key = Str::random(48);
        $attempt->forceFill(['device_info' => $device, 'session_token' => hash('sha256', $key)])->save();

        return $key;
    }

    /**
     * For take / save-answer / submit / realtime session: refuses a stale session (another window, or the same
     * machine after a restart that skipped the precheck) and notes a network change once per new address.
     */
    public static function guard(Request $request, ExamAttempt $attempt): ?\Illuminate\Http\JsonResponse
    {
        // attempts opened before this mechanism (or by the legacy /auth flow) carry a plain random token: not enforced
        if (config('foxy.precheck.required') && is_string($attempt->session_token) && strlen($attempt->session_token) === 64 && ctype_xdigit($attempt->session_token)) {
            $sent = (string) $request->header('X-Foxy-Session', '');
            if ($sent === '' || !hash_equals($attempt->session_token, hash('sha256', $sent))) {
                return response()->json([
                    'success' => false,
                    'error_code' => 'PRECHECK_REQUIRED',
                    'message' => 'Phiên làm bài này đã được mở lại (máy khởi động lại, mở cửa sổ khác hoặc máy khác). Hãy kiểm tra thiết bị (precheck) để tiếp tục.',
                ], 428);
            }
        }

        $device = is_array($attempt->device_info) ? $attempt->device_info : [];
        if (!empty($device['ip']) && $device['ip'] !== $request->ip()) {
            self::flag($attempt, 'IP_CHANGED', 'LOW', ['from' => $device['ip'], 'to' => $request->ip()]);
            $device['ip'] = $request->ip();
            $attempt->forceFill(['device_info' => $device])->saveQuietly();
        }

        return null;
    }

    private static function flag(ExamAttempt $attempt, string $type, string $severity, array $details): void
    {
        Violation::create([
            'exam_attempt_id' => $attempt->id,
            'violation_type' => $type,
            'severity' => $severity,
            'details' => $details + ['message' => ViolationCatalog::label($type), 'source' => 'server'],
            'timestamp' => now(),
        ]);
    }

    private static function cleanEnv(array $env): array
    {
        $s = fn ($v, $n = 120) => is_scalar($v) ? Str::limit((string) $v, $n, '') : null;

        return [
            'os_family' => $s($env['os_family'] ?? null, 16),
            'vm' => [
                'detected' => !empty($env['vm']['detected']),
                'vendor' => $s($env['vm']['vendor'] ?? null, 60),
                'evidence' => array_slice(array_map(fn ($e) => $s($e), (array) ($env['vm']['evidence'] ?? [])), 0, 10),
            ],
            'remote_session' => !empty($env['remote_session']),
            'virtual_cameras' => array_slice(array_map(fn ($e) => $s($e), (array) ($env['virtual_cameras'] ?? [])), 0, 10),
            'camera_label' => $s($env['camera_label'] ?? null),
            'capture_devices' => array_slice(array_map(fn ($e) => $s($e), (array) ($env['capture_devices'] ?? [])), 0, 10),
            'displays' => (int) ($env['displays'] ?? 0),
            'dev' => !empty($env['dev']),
        ];
    }
}
