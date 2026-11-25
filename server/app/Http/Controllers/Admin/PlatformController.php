<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Lead;
use App\Models\Organization;
use App\Models\OrganizationUsage;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Violation;
use App\Services\AiService;
use App\Services\Realtime;
use App\Services\TenantContext;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/** Platform overview and system health. Super Admin in the platform (ROOT) context only. */
class PlatformController extends Controller
{
    private function authorizePlatform(): array
    {
        abort_unless(Auth::user()?->role === 'SUPER_ADMIN' && app(TenantContext::class)->isRoot(), 403, 'Chỉ Super Admin ở ngữ cảnh nền tảng mới xem được trang này.');
        $u = Auth::user();

        return ['id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'email' => $u->email, 'role' => $u->role];
    }

    public function overview()
    {
        $user = $this->authorizePlatform();
        $month = now()->format('Y-m');

        // attempts per day for the last 14 days, zero-filled
        $since = now()->subDays(13)->startOfDay();
        $perDay = ExamAttempt::where('created_at', '>=', $since)
            ->selectRaw('date(created_at) as d, count(*) as c')->groupBy('d')->pluck('c', 'd');
        $series = collect(range(13, 0))->map(function ($i) use ($perDay) {
            $d = now()->subDays($i)->format('Y-m-d');

            return ['date' => $d, 'count' => (int) ($perDay[$d] ?? 0)];
        })->values();

        $usage = OrganizationUsage::where('month_year', $month)->with('organization:id,name,code')
            ->orderByDesc('total_attempts_count')->limit(5)->get()
            ->map(fn ($u) => ['org' => $u->organization?->name, 'code' => $u->organization?->code, 'attempts' => $u->total_attempts_count, 'exams' => $u->exams_created_count]);

        return Inertia::render('Admin/Platform/Overview', [
            'user' => $user,
            'teams' => [],
            'stats' => [
                'organizations' => Organization::where('id', '!=', 1)->where('code', '!=', 'ROOT')->count(),
                'users' => User::count(),
                'exams' => Exam::count(),
                'attemptsMonth' => (int) OrganizationUsage::where('month_year', $month)->sum('total_attempts_count'),
                'inProgress' => ExamAttempt::where('status', 'IN_PROGRESS')->count(),
                'violationsPending' => Violation::where('is_reviewed', false)->where('is_false_positive', false)->count(),
                'leadsNew' => Lead::where('status', 'NEW')->count(),
                'subscriptions' => Subscription::where('status', 'ACTIVE')->count(),
            ],
            'series' => $series,
            'topUsage' => $usage,
            'recentLeads' => Lead::latest()->limit(5)->get(['id', 'name', 'organization', 'status', 'created_at'])
                ->map(fn ($l) => ['id' => $l->id, 'name' => $l->name, 'organization' => $l->organization, 'status' => $l->status, 'at' => $l->created_at?->toIso8601String()]),
        ]);
    }

    public function health()
    {
        $user = $this->authorizePlatform();

        return Inertia::render('Admin/Platform/Health', ['user' => $user, 'teams' => [], 'checks' => $this->checks()]);
    }

    /** Same checks as JSON, so the page can refresh itself without a full reload. */
    /** GET /admin/platform/services — current addresses of the AI / realtime services (Root Admin). */
    public function services()
    {
        $this->authorizePlatform();

        return response()->json(['services' => \App\Support\ServiceEndpoints::forEditor()]);
    }

    /** POST /admin/platform/services — save the addresses; an empty value goes back to the .env default. */
    public function updateServices(\Illuminate\Http\Request $request)
    {
        $this->authorizePlatform();
        $data = $request->validate(['values' => ['required', 'array']]);
        $errors = \App\Support\ServiceEndpoints::save($data['values']);
        if ($errors) {
            return response()->json(['errors' => $errors], 422);
        }
        \App\Support\Audit::record('platform.services', 'Cập nhật địa chỉ dịch vụ hệ thống', null, null, ['keys' => array_keys($data['values'])]);

        return response()->json(['services' => \App\Support\ServiceEndpoints::forEditor()]);
    }

    public function healthJson()
    {
        $this->authorizePlatform();

        return response()->json($this->checks());
    }

    /** @return list<array{id:string,label:string,status:string,detail:string,ms:int}> */
    private function checks(): array
    {
        $out = [];
        $run = function (string $id, string $label, callable $fn) use (&$out) {
            $t = microtime(true);
            try {
                [$status, $detail] = $fn();
            } catch (\Throwable $e) {
                [$status, $detail] = ['down', mb_substr($e->getMessage(), 0, 160)];
            }
            $out[] = ['id' => $id, 'label' => $label, 'status' => $status, 'detail' => $detail, 'ms' => (int) round((microtime(true) - $t) * 1000)];
        };

        $run('database', 'Cơ sở dữ liệu', function () {
            DB::select('select 1');

            return ['ok', DB::connection()->getDriverName()];
        });
        $run('cache', 'Bộ nhớ đệm', function () {
            Cache::put('health_probe', 1, 10);

            return [Cache::get('health_probe') === 1 ? 'ok' : 'down', (string) config('cache.default')];
        });
        $run('storage', 'Lưu trữ tệp', function () {
            $ok = Storage::disk('public')->put('.health', (string) time());

            return [$ok ? 'ok' : 'down', 'đĩa public · ghi ' . ($ok ? 'được' : 'lỗi')];
        });
        $run('queue', 'Hàng đợi', function () {
            $failed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;
            $pending = Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0;

            return [$failed > 0 ? 'warn' : 'ok', "{$pending} đang chờ · {$failed} thất bại"];
        });
        $run('realtime', 'Realtime (ingest)', function () {
            if (!app(Realtime::class)->enabled()) {
                return ['off', 'chưa cấu hình RT_JWT_SECRET'];
            }
            $url = rtrim((string) config('services.realtime.ingest_internal_url'), '/');

            return [Http::timeout(2)->get($url . '/healthz')->successful() ? 'ok' : 'down', $url];
        });
        $run('recorder', 'Ghi hình bằng chứng', function () {
            if (!app(Realtime::class)->enabled()) {
                return ['off', 'chưa cấu hình realtime'];
            }
            $url = rtrim((string) config('services.realtime.record_internal_url'), '/');

            return [Http::timeout(2)->get($url . '/healthz')->successful() ? 'ok' : 'down', $url];
        });
        foreach (['face' => 'AI khuôn mặt', 'objects' => 'AI vật thể cấm', 'agent' => 'AI giám sát (agent)'] as $key => $label) {
            $run("ai_{$key}", $label, function () use ($key) {
                $configured = $key === 'agent' ? (string) config('services.ai_agent.url') !== '' : AiService::endpoints() !== [];
                if (!$configured) {
                    return ['off', 'chưa cấu hình'];
                }

                return [AiService::serviceOnline($key) ? 'ok' : 'down', 'phản hồi /health'];
            });
        }

        return $out;
    }
}
