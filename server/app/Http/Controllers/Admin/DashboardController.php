<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\QuestionSet;
use App\Models\User;
use App\Models\Violation;
use App\Services\QuotaService;
use App\Services\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * One Inertia page ("Admin/Dashboard") hosts every list section of the admin portal.
 * Each section loads ONLY its own data, always scoped to the ACTIVE organization.
 * Which sections exist at all is decided by TenantContext::capabilities() + EnforceContextScope.
 */
class DashboardController extends Controller
{
    private const SECTIONS = [
        'overview', 'organizations', 'users', 'courses', 'exams',
        'problem-banks', 'saas-plans', 'settings',
    ];

    public function __construct(private TenantContext $tenant, private QuotaService $quota)
    {
    }

    public function show(Request $request, string $section = 'overview')
    {
        $user = Auth::user();

        // Legacy deep links: /admin?tab=courses
        if ($section === 'overview' && in_array($request->query('tab'), self::SECTIONS, true)) {
            $section = $request->query('tab');
        }
        abort_unless(in_array($section, self::SECTIONS, true), 404);

        // ?tab= bypasses the path-based EnforceContextScope, so the section itself is checked again here
        $can = $this->tenant->capabilities();
        $allowed = match ($section) {
            'organizations' => $can['organizations'],
            'users' => $can['users'],
            'saas-plans' => $can['managePlans'] || $can['quota'],
            'settings' => $can['orgSettings'],
            default => $can['academic'] || $section === 'overview', // overview: platform is redirected just below
        };
        if (!$allowed) {
            return redirect($this->tenant->inPlatformContext() ? '/admin/organizations' : '/admin');
        }

        // Platform context has no overview of its own: its home is the organization list
        if ($this->tenant->inPlatformContext() && $section === 'overview') {
            return redirect('/admin/organizations');
        }

        $org = $this->tenant->current();
        $plan = $this->quota->getActivePlan($org);

        $loader = match ($section) {
            'overview' => fn () => ['overview' => $this->overview($org), 'myOrgQuota' => $this->orgQuota($org)],
            'organizations' => fn () => $this->organizations($request),
            'users' => fn () => $this->users($request, $org),
            'courses' => fn () => ['courses' => $this->courses($org)],
            'exams' => fn () => ['exams' => $this->exams($org), 'setCounts' => $this->setCounts($org)],
            'problem-banks' => fn () => ['questionSets' => $this->questionSets($org), 'courses' => $this->courses($org)],
            // platform: plan catalogue + invoice ledger; school: read-only quota of its own plan
            'saas-plans' => fn () => [
                'plans' => Plan::all(),
                'myOrgQuota' => $this->orgQuota($org),
                ...($this->tenant->capabilities()['billing'] ? ['invoices' => $this->invoices()] : []),
            ],
            'settings' => fn () => ['organization' => [
                'id' => $org->id,
                'name' => $org->name,
                'code' => $org->code,
                'type' => $org->type,
                'status' => $org->status,
                'is_public' => (bool) $org->is_public,
            ]],
        };

        return Inertia::render('Admin/Dashboard', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
                'organization' => [
                    'id' => $org->id,
                    'name' => $org->name,
                    'code' => $org->code,
                    'type' => $org->type,
                    'is_public' => (bool) $org->is_public,
                    'plan' => $plan->name,
                ],
            ],
            'selectedOrgId' => $org->id,
            'isSuperAdmin' => $user->role === 'SUPER_ADMIN',
            'currentSection' => $section,
            ...$loader(),
        ]);
    }

    // ------------------------------------------------------------------ sections

    private function orgQuota(Organization $org): array
    {
        $plan = $this->quota->getActivePlan($org);
        $usage = $this->quota->getCurrentUsage($org);

        return [
            'plan_name' => $plan->display_name,
            'exams_used' => $usage->exams_created_count,
            'exams_limit' => $plan->max_exams_per_month,
            'students_limit' => $plan->max_students_per_exam,
            'has_ai' => $plan->has_ai_proctoring,
            'has_code_replay' => $plan->has_code_replay,
        ];
    }

    /** Platform only. Server-side search / filter / paging: there may be thousands of organizations. */
    private function organizations(Request $request): array
    {
        $q = trim((string) $request->query('q', ''));
        $like = '%' . addcslashes($q, '%_' . chr(92)) . '%';
        $plan = strtoupper((string) $request->query('plan', ''));
        $status = (string) $request->query('status', '');
        $per = min(50, max(5, (int) $request->query('per', 10)));

        $page = Organization::withCount([
                'exams',
                'users',
                'users as teachers_count' => fn ($w) => $w->where('role', 'TEACHER'),
                'exams as live_exams_count' => fn ($w) => $w->where('status', 'IN_PROGRESS'),
            ])
            ->with([
                'activeSubscription.plan',
                'usages' => fn ($w) => $w->where('month_year', now()->format('Y-m')),
                'users' => fn ($w) => $w->where('role', 'ORG_ADMIN')->select('id', 'organization_id', 'email'),
            ])
            ->when($q !== '', fn ($w) => $w->where(
                fn ($x) => $x->where('name', 'like', $like)->orWhere('code', 'like', $like)->orWhere('slug', 'like', $like)
            ))
            ->when($status !== '', fn ($w) => $w->where('status', $status))
            ->when($plan !== '', fn ($w) => $plan === 'FREE'
                ? $w->where(fn ($x) => $x->whereDoesntHave('activeSubscription')
                    ->orWhereHas('activeSubscription.plan', fn ($p) => $p->where('name', 'FREE')))
                : $w->whereHas('activeSubscription.plan', fn ($p) => $p->where('name', $plan)))
            ->orderByRaw("code = 'ROOT' desc")
            ->latest('id')
            ->paginate($per)
            ->withQueryString();

        return [
            'plans' => Plan::all(['id', 'name', 'display_name', 'max_exams_per_month', 'has_ai_proctoring']),
            'organizations' => $page->getCollection()->map(fn ($o) => [
                'id' => $o->id,
                'name' => $o->name,
                'code' => $o->code,
                'slug' => $o->slug,
                'type' => $o->type,
                'status' => $o->status,
                'plan' => $o->activeSubscription?->plan?->name ?? 'FREE',
                'active_plan_name' => $o->activeSubscription?->plan?->name ?? 'FREE',
                'is_public' => (bool) $o->is_public,
                'exams_count' => $o->exams_count,
                'users_count' => $o->users_count,
                'teachers_count' => $o->teachers_count,
                'live_exams_count' => $o->live_exams_count,
                'exams_used' => (int) ($o->usages->first()?->exams_created_count ?? 0),
                'exams_limit' => (int) ($o->activeSubscription?->plan?->max_exams_per_month ?? 0),
                'admin_email' => $o->users->first()?->email,
                'created_at' => $o->created_at?->format('d/m/Y'),
            ])->values(),
            'listMeta' => $this->meta($page, ['q' => $q, 'plan' => $plan, 'status' => $status]),
        ];
    }

    /** Accounts of the ACTIVE organization (platform context: the ROOT accounts). Paged on the server. */
    private function users(Request $request, Organization $org): array
    {
        $q = trim((string) $request->query('q', ''));
        $like = '%' . addcslashes($q, '%_' . chr(92)) . '%';
        $role = (string) $request->query('role', '');
        $status = (string) $request->query('status', '');
        $per = min(50, max(5, (int) $request->query('per', 10)));

        $page = User::where('organization_id', $org->id)
            ->with('organization:id,name,code')
            ->when($q !== '', fn ($w) => $w->where(
                fn ($x) => $x->where('name', 'like', $like)->orWhere('username', 'like', $like)->orWhere('email', 'like', $like)
            ))
            ->when($role !== '', fn ($w) => $w->where('role', $role))
            ->when($status !== '', fn ($w) => $w->where('status', $status))
            ->latest('id')
            ->paginate($per)
            ->withQueryString();

        return [
            'usersList' => $page->getCollection()->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'first_name' => $u->first_name,
                'middle_name' => $u->middle_name,
                'last_name' => $u->last_name,
                'date_of_birth' => $u->date_of_birth ? (is_string($u->date_of_birth) ? $u->date_of_birth : $u->date_of_birth->format('Y-m-d')) : null,
                'address' => $u->address,
                'avatar' => $u->avatar,
                'username' => $u->username,
                'email' => $u->email,
                'role' => $u->role,
                'status' => $u->status,
                'organization' => ['id' => $u->organization?->id, 'name' => $u->organization?->name, 'code' => $u->organization?->code],
                'created_at' => $u->created_at?->format('d/m/Y H:i') ?? 'N/A',
            ])->values(),
            'listMeta' => $this->meta($page, ['q' => $q, 'role' => $role, 'status' => $status]),
        ];
    }

    /** How many ready-to-use question sets per kind (shown in the "Tạo kỳ thi" chooser). */
    private function setCounts(Organization $org): array
    {
        $c = QuestionSet::where('organization_id', $org->id)->selectRaw('type, count(*) as total')->groupBy('type')->pluck('total', 'type');

        return ['CLASSICAL' => (int) ($c['CLASSICAL'] ?? 0), 'PROGRAMMING' => (int) ($c['PROGRAMMING'] ?? 0)];
    }

    private function courses(Organization $org)
    {
        return Course::where('organization_id', $org->id)
            ->with('organization:id,name,code', 'teacher:id,name')
            ->withCount('exams')
            ->latest()
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'description' => $c->description,
                'teacher_name' => $c->teacher?->name ?? 'Chưa gán',
                'exams_count' => $c->exams_count,
                'organization_name' => $c->organization?->name,
            ]);
    }

    private function exams(Organization $org)
    {
        return Exam::where('organization_id', $org->id)
            ->with('organization:id,name,code', 'course:id,name')
            ->withCount(['attempts', 'violations'])
            ->latest()
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'code' => $e->code,
                'type' => $e->type,
                'status' => $e->status,
                'duration_minutes' => $e->duration_minutes,
                'attempts_count' => $e->attempts_count,
                'violations_count' => $e->violations_count,
                'course_name' => $e->course?->name ?? 'Môn học chung',
                'organization_name' => $e->organization?->name,
                'monitoring_config' => $e->monitoring_config,
            ]);
    }

    private function questionSets(Organization $org)
    {
        return QuestionSet::where('organization_id', $org->id)
            ->with(['course:id,name,code', 'organization:id,name,code'])
            ->withCount(['classicalQuestions', 'programmingProblems'])
            ->latest()
            ->get()
            ->map(fn ($qs) => [
                'id' => $qs->id,
                'name' => $qs->name,
                'code' => $qs->code,
                'type' => $qs->type,
                'description' => $qs->description,
                'status' => $qs->status,
                'max_score' => $qs->max_score,
                'course_name' => $qs->course?->name ?? 'Dùng chung',
                'course_code' => $qs->course?->code,
                'course_id' => $qs->course_id,
                'organization_name' => $qs->organization?->name,
                'questions_count' => $qs->type === 'CLASSICAL' ? $qs->classical_questions_count : $qs->programming_problems_count,
                'created_at' => $qs->created_at?->format('d/m/Y H:i') ?? 'N/A',
            ]);
    }

    /** Platform billing ledger: latest 200 invoices. */
    private function invoices()
    {
        return Invoice::with(['organization:id,name,code', 'plan:id,name,display_name'])
            ->latest()
            ->take(200)
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->id,
                'invoice_code' => $inv->invoice_code,
                'organization_id' => $inv->organization_id,
                'organization_name' => $inv->organization?->name ?? 'Tổ chức',
                'organization_code' => $inv->organization?->code ?? 'ROOT',
                'plan_name' => $inv->plan?->display_name ?? 'Gói cước',
                'amount' => $inv->amount,
                'status' => $inv->status,
                'payment_method' => $inv->payment_method,
                'transaction_id' => $inv->transaction_id,
                'paid_at' => $inv->paid_at?->format('d/m/Y H:i'),
                'created_at' => $inv->created_at?->format('d/m/Y H:i') ?? 'N/A',
                'notes' => $inv->notes,
            ]);
    }

    /** Tổng quan of the active (tenant) organization. */
    private function overview(Organization $org): array
    {
        $attempts = fn () => ExamAttempt::whereHas('exam', fn ($e) => $e->where('organization_id', $org->id));
        $violations = fn () => Violation::whereHas('attempt.exam', fn ($e) => $e->where('organization_id', $org->id));
        $exams = fn () => Exam::where('organization_id', $org->id);

        $from = now()->subDays(13)->startOfDay();
        $submittedPerDay = $attempts()->whereNotNull('submitted_at')->where('submitted_at', '>=', $from)
            ->get(['submitted_at'])->groupBy(fn ($a) => $a->submitted_at->format('Y-m-d'))->map->count();
        $violationsPerDay = $violations()->where('timestamp', '>=', $from)
            ->get(['timestamp'])->groupBy(fn ($v) => $v->timestamp->format('Y-m-d'))->map->count();

        $activity = collect(range(13, 0))->map(function ($ago) use ($submittedPerDay, $violationsPerDay) {
            $day = now()->subDays($ago);
            $key = $day->format('Y-m-d');

            return ['date' => $key, 'label' => $day->format('d'), 'submissions' => $submittedPerDay[$key] ?? 0, 'violations' => $violationsPerDay[$key] ?? 0];
        })->values();

        return [
            'activity' => $activity,
            'violationTypes' => $violations()->where('timestamp', '>=', now()->subDays(7))
                ->selectRaw('violation_type, count(*) as total')->groupBy('violation_type')->pluck('total', 'violation_type'),
            'liveExams' => $exams()
                ->where(fn ($q) => $q->where('status', 'IN_PROGRESS')->orWhereHas('attempts', fn ($a) => $a->where('status', 'IN_PROGRESS')))
                ->with(['course:id,code,name'])
                ->withCount([
                    'attempts',
                    'attempts as active_count' => fn ($a) => $a->where('status', 'IN_PROGRESS'),
                    'violations as pending_violations_count' => fn ($v) => $v->where('is_reviewed', false)->where('is_false_positive', false),
                ])
                ->latest()->take(5)->get()
                ->map(fn ($e) => [
                    'id' => $e->id,
                    'title' => $e->title,
                    'code' => $e->code,
                    'course_code' => $e->course?->code,
                    'attempts_count' => $e->attempts_count,
                    'active_count' => $e->active_count,
                    'pending_violations_count' => $e->pending_violations_count,
                    'end_time' => $e->end_time?->toIso8601String(),
                ]),
            'pendingViolations' => $violations()->where('is_reviewed', false)->where('is_false_positive', false)
                ->with('attempt.user:id,name,username')
                ->latest('timestamp')->take(5)->get()
                ->map(fn ($v) => [
                    'id' => $v->id,
                    'attempt_id' => $v->exam_attempt_id,
                    'type' => $v->violation_type,
                    'severity' => $v->severity,
                    'student_name' => $v->attempt?->user?->name ?? 'Thí sinh',
                    'student_username' => $v->attempt?->user?->username ?? '',
                    'timestamp' => $v->timestamp?->toIso8601String(),
                ]),
            'activeStudents' => $attempts()->where('status', 'IN_PROGRESS')->count(),
            'submissions7d' => $attempts()->where('submitted_at', '>=', now()->subDays(7))->count(),
            'submissionsPrev7d' => $attempts()->whereBetween('submitted_at', [now()->subDays(14), now()->subDays(7)])->count(),
            'teachers' => User::where('organization_id', $org->id)->where('role', 'TEACHER')->count(),
            'students' => User::where('organization_id', $org->id)->where('role', 'STUDENT')->count(),
            'examsThisMonth' => $exams()->where('created_at', '>=', now()->startOfMonth())->count(),
        ];
    }

    private function meta($page, array $filters): array
    {
        return [
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'filters' => $filters,
        ];
    }
}
