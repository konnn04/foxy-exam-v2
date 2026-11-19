<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\TenantContext;
use App\Support\Audit;
use App\Support\MonitoringConfig;
use Illuminate\Http\Request;

/**
 * Default monitoring policy of a school: what a NEW exam starts with. Exams keep their own copy, so changing the
 * default never alters an exam that already exists.
 */
class OrgPolicyController extends Controller
{
    public const FLAGS = ['prevent_tab_switch', 'prevent_paste', 'track_keystroke_dynamics', 'ai_face_check', 'require_mic', 'require_screen'];

    public function update(Request $request, TenantContext $tenant)
    {
        abort_unless($tenant->capabilities()['orgSettings'], 403, 'Chỉ quản trị viên của trường mới đổi chính sách giám sát.');

        $v = $request->validate(array_merge(MonitoringConfig::REQUEST_RULES, [
            'reset' => ['nullable', 'boolean'],
            'prevent_tab_switch' => ['nullable', 'boolean'],
            'prevent_paste' => ['nullable', 'boolean'],
            'track_keystroke_dynamics' => ['nullable', 'boolean'],
            'ai_face_check' => ['nullable', 'boolean'],
            'require_mic' => ['nullable', 'boolean'],
            'require_screen' => ['nullable', 'boolean'],
            'extra_camera' => ['required', 'in:off,optional,required'],
            'max_paste_chars' => ['nullable', 'integer', 'min:0', 'max:500'],
        ]));

        $org = $tenant->current();
        $settings = $org->settings ?? [];

        if (!empty($v['reset'])) {
            unset($settings['monitoring_defaults']);
            $org->update(['settings' => $settings]);
            Audit::record('org.policy_reset', 'Đặt lại chính sách giám sát mặc định', 'organization', $org->id);

            return back()->with('success', 'Đã đặt lại chính sách giám sát về mặc định của hệ thống.');
        }

        $config = ['extra_camera' => $v['extra_camera'], 'max_paste_chars' => (int) ($v['max_paste_chars'] ?? 80)];
        foreach (self::FLAGS as $k) {
            $config[$k] = (bool) ($v[$k] ?? false);
        }
        $config = MonitoringConfig::fromRequest($config, $v); // applies the dependencies between options

        $settings['monitoring_defaults'] = $config;
        $org->update(['settings' => $settings]);
        Audit::record('org.policy', 'Cập nhật chính sách giám sát mặc định', 'organization', $org->id, ['keys' => array_keys($config)]);

        return back()->with('success', 'Đã lưu chính sách giám sát mặc định.');
    }
}
