<?php

use App\Models\ClassicalQuestion;
use App\Models\ClassicalQuestionAnswer;
use App\Models\Course;
use App\Models\Exam;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\ProgrammingProblem;
use App\Models\QuestionSet;
use App\Models\Subscription;
use App\Models\TestCase;
use App\Models\User;
use App\Models\Violation;
use App\Services\QuotaService;
use App\Services\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes - FoxyExam SaaS Web Portal
|--------------------------------------------------------------------------
*/

// 1. Landing Page (Trang chủ, Về chúng tôi, Dự án FoxyExam, Bảng giá)
Route::get('/', function () {
    $plans = Plan::where('is_active', true)->get();
    return Inertia::render('Landing', [
        'plans' => $plans,
    ]);
})->name('landing');

// 2. OpenAPI Interactive Documentation for Client App Developers (Scramble)
Route::get('/docs', function () {
    return redirect('/docs/api');
})->name('api.docs');

Route::get('/api/documentation', function () {
    return redirect('/docs/api');
});

Route::get('/openapi.json', function () {
    return redirect('/docs/api.json');
});

// 3. Authentication (Dành cho Giảng viên & Quản trị viên)
Route::get('/login', function () {
    if (Auth::check()) {
        return redirect(\App\Http\Middleware\PortalRole::home(Auth::user()->role));
    }
    return Inertia::render('Auth/Login');
})->name('login');

Route::post('/login', function (Request $request) {
    $credentials = $request->validate([
        'username' => ['required', 'string'],
        'password' => ['required', 'string'],
    ]);

    $user = User::where('username', $credentials['username'])
        ->orWhere('email', $credentials['username'])
        ->first();

    if ($user && Hash::check($credentials['password'], $user->password)) {
        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->intended(\App\Http\Middleware\PortalRole::home($user->role));
    }

    return back()->withErrors([
        'username' => 'Tên đăng nhập hoặc mật khẩu không chính xác.',
    ]);
});

Route::post('/logout', function (Request $request) {
    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/login');
})->name('logout');

Route::post('/oauth/token', [\App\Http\Controllers\Api\V1\Auth\AuthController::class, 'login']);

// 4. Admin Portal (/admin - Root Admin & Org Admin)
Route::middleware(['auth'])->group(function () {
    // =========================================================================
    // 4. ADMIN PORTAL CORE DATA PROVIDER & DIRECT RESTful ROUTES
    // =========================================================================
    // Every list section of the admin portal is one Inertia page; the controller loads only the
    // data of the section being opened, scoped to the ACTIVE organization. EnforceContextScope
    // decides which sections exist for the current context (platform vs. school).
    Route::get('/admin', [\App\Http\Controllers\Admin\DashboardController::class, 'show'])->name('admin.dashboard');
    Route::get('/admin/billing', fn () => redirect('/admin/saas-plans'));
    Route::get('/admin/reports', fn () => redirect('/admin/live'));
    foreach (['overview', 'organizations', 'users', 'courses', 'exams', 'problem-banks', 'saas-plans', 'settings'] as $section) {
        Route::get('/admin/' . $section, [\App\Http\Controllers\Admin\DashboardController::class, 'show'])
            ->defaults('section', $section);
    }

    Route::post('/admin/organization/settings', function (Request $request) {
        $currentUser = Auth::user();
        if (!in_array($currentUser->role, ['SUPER_ADMIN', 'ORG_ADMIN'])) {
            abort(403, 'Chỉ Quản trị viên mới có quyền cập nhật cấu hình tổ chức.');
        }

        $tenantContext = app(TenantContext::class);
        // Always the ACTIVE organization (a posted org_id is ignored)
        $targetOrgId = $tenantContext->current()->id;

        $targetOrg = Organization::findOrFail($targetOrgId);
        $tenantContext->enforceOwnership($targetOrg);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:organizations,code,' . $targetOrg->id],
            'type' => ['required', 'in:UNIVERSITY,CENTER,INDIVIDUAL'],
            'is_public' => ['required', 'boolean'],
        ]);

        $targetOrg->update([
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'slug' => Str::slug($validated['code']),
            'type' => $validated['type'],
            'is_public' => (bool) $validated['is_public'],
        ]);

        return back()->with('success', 'Đã cập nhật cấu hình tổ chức thành công.');
    });

    $getAdminCommonData = function (Request $request = null) {
        $tenantContext = app(TenantContext::class);
        $user = Auth::user();
        $org = $tenantContext->current();
        $teams = $tenantContext->teams();

        $userData = [
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
                'plan' => $org->activeSubscription?->plan?->name ?? 'FREE',
            ],
        ];
        return [$userData, $teams, $org];
    };

    Route::post('/admin/switch-organization', [\App\Http\Controllers\Admin\OrganizationSwitchController::class, 'switch']);
    Route::get('/admin/switcher/organizations', [\App\Http\Controllers\Admin\OrganizationSwitchController::class, 'search']);

    $checkIsRootAdmin = function (Request $request = null) {
        $user = Auth::user();
        if ($user->role !== 'SUPER_ADMIN') {
            abort(403, 'Chỉ Super Admin hệ thống ROOT mới có quyền quản lý tổ chức.');
        }
        if (!app(TenantContext::class)->isRoot()) {
            abort(403, 'Bạn đang ở ngữ cảnh trường học riêng. Vui lòng chuyển về Root Platform để quản lý tổ chức.');
        }
    };

    // ==========================================
    // 4.1 ORGANIZATIONS CRUD (CHỈ ROOT PLATFORM)
    // ==========================================
    Route::get('/admin/organizations/new', function (Request $request) use ($getAdminCommonData, $checkIsRootAdmin) {
        $checkIsRootAdmin($request);
        [$userData, $teams] = $getAdminCommonData();
        $plans = Plan::all(['id', 'name', 'display_name', 'max_exams_per_month', 'has_ai_proctoring']);
        return Inertia::render('Admin/Organizations/Create', [
            'user' => $userData,
            'teams' => $teams,
            'plans' => $plans,
        ]);
    });

    Route::post('/admin/organizations', function (Request $request) use ($checkIsRootAdmin) {
        $checkIsRootAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:organizations,code'],
            'type' => ['required', 'in:UNIVERSITY,CENTER,INDIVIDUAL'],
            'plan_name' => ['nullable', 'string'],
            'is_public' => ['nullable', 'boolean'],
        ]);

        $plan = Plan::where('name', $validated['plan_name'] ?? 'FREE')->first() ?? Plan::first();

        $org = Organization::create([
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'slug' => Str::slug($validated['code']),
            'type' => $validated['type'],
            'is_public' => (bool) ($validated['is_public'] ?? false),
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'organization_id' => $org->id,
            'plan_id' => $plan->id,
            'starts_at' => now(),
            'status' => 'ACTIVE',
        ]);

        return redirect('/admin/organizations');
    });

    Route::post('/admin/organizations/create', function (Request $request) {
        // Alias
        return app()->call(Route::getRoutes()->getByName('admin.dashboard') ? fn() => redirect('/admin/organizations') : fn() => back());
    });

    Route::get('/admin/organizations/{id}/edit', function (Request $request, $id) use ($getAdminCommonData, $checkIsRootAdmin) {
        $checkIsRootAdmin($request);
        $org = Organization::with('activeSubscription.plan')->findOrFail($id);
        [$userData, $teams] = $getAdminCommonData();

        return Inertia::render('Admin/Organizations/Edit', [
            'user' => $userData,
            'teams' => $teams,
            'plans' => Plan::all(['id', 'name', 'display_name', 'max_exams_per_month', 'has_ai_proctoring']),
            'organization' => [
                'id' => $org->id,
                'name' => $org->name,
                'code' => $org->code,
                'type' => $org->type,
                'status' => $org->status,
                'is_public' => (bool) $org->is_public,
                'plan_name' => $org->activeSubscription?->plan?->name ?? 'FREE',
            ],
        ]);
    });

    Route::post('/admin/organizations/{id}/update', function (Request $request, $id) use ($checkIsRootAdmin) {
        $checkIsRootAdmin($request);

        $org = Organization::findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:organizations,code,' . $id],
            'type' => ['required', 'in:UNIVERSITY,CENTER,INDIVIDUAL'],
            'status' => ['required', 'in:ACTIVE,SUSPENDED,EXPIRED'],
            'plan_name' => ['nullable', 'string'],
            'is_public' => ['nullable', 'boolean'],
        ]);

        $updateData = [
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'slug' => Str::slug($validated['code']),
            'type' => $validated['type'],
            'status' => $validated['status'],
        ];
        if (array_key_exists('is_public', $validated)) {
            $updateData['is_public'] = (bool) $validated['is_public'];
        }

        $org->update($updateData);

        if (!empty($validated['plan_name'])) {
            $plan = Plan::where('name', $validated['plan_name'])->first();
            if ($plan) {
                $sub = $org->activeSubscription;
                if ($sub) {
                    $sub->update(['plan_id' => $plan->id]);
                } else {
                    Subscription::create([
                        'organization_id' => $org->id,
                        'plan_id' => $plan->id,
                        'starts_at' => now(),
                        'status' => 'ACTIVE',
                    ]);
                }
            }
        }

        return redirect('/admin/organizations');
    });

    Route::get('/admin/organizations/{id}', function (Request $request, $id) use ($getAdminCommonData, $checkIsRootAdmin) {
        $checkIsRootAdmin($request);
        $org = Organization::with(['activeSubscription.plan', 'users', 'exams'])->withCount(['exams', 'users'])->findOrFail($id);
        [$userData, $teams] = $getAdminCommonData();

        return Inertia::render('Admin/Organizations/Show', [
            'user' => $userData,
            'teams' => $teams,
            'organization' => [
                'id' => $org->id,
                'name' => $org->name,
                'code' => $org->code,
                'type' => $org->type,
                'status' => $org->status,
                'plan_name' => $org->activeSubscription?->plan?->name ?? 'FREE',
                'exams_count' => $org->exams_count,
                'users_count' => $org->users_count,
                'created_at' => $org->created_at?->toIso8601String(),
                'users' => $org->users->map(fn($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'email' => $u->email,
                    'role' => $u->role,
                ]),
                'exams' => $org->exams->map(fn($e) => [
                    'id' => $e->id,
                    'title' => $e->title,
                    'code' => $e->code,
                    'type' => $e->type,
                    'status' => $e->status,
                    'duration_minutes' => $e->duration_minutes,
                ]),
            ],
        ]);
    });

    Route::post('/admin/organizations/{id}/delete', function (Request $request, $id) use ($checkIsRootAdmin) {
        $checkIsRootAdmin($request);

        $org = Organization::findOrFail($id);
        if ($org->code === 'ROOT' || $org->id === 1) {
            return back()->withErrors(['message' => 'Không thể xóa tổ chức gốc ROOT!']);
        }

        $org->delete();
        return redirect('/admin/organizations');
    });

    // ==========================================
    // 4.2 USERS CRUD
    // ==========================================
    // ==========================================
    // 4.2 USERS CRUD
    // ==========================================
    Route::get('/admin/users/new', function (Request $request) use ($getAdminCommonData) {
        $currentUser = Auth::user();
        if (!in_array($currentUser->role, ['SUPER_ADMIN', 'ORG_ADMIN'])) {
            abort(403);
        }
        [$userData, $teams, $currentScopeOrg] = $getAdminCommonData($request);
        $organizations = Organization::where('id', $currentScopeOrg->id)->get(['id', 'name', 'code']);
        $isRootContext = ($currentScopeOrg->code === 'ROOT' || $currentScopeOrg->id === 1);

        return Inertia::render('Admin/Users/Create', [
            'user' => $userData,
            'teams' => $teams,
            'currentScopeOrg' => [
                'id' => $currentScopeOrg->id,
                'name' => $currentScopeOrg->name,
                'code' => $currentScopeOrg->code,
            ],
            'isRootContext' => $isRootContext,
            'organizations' => $organizations,
        ]);
    });

    Route::post('/admin/users', function (Request $request) {
        $currentUser = Auth::user();
        if (!in_array($currentUser->role, ['SUPER_ADMIN', 'ORG_ADMIN'])) {
            abort(403);
        }

        $tenantContext = app(TenantContext::class);
        $targetOrgId = $tenantContext->resolveTargetOrgId(
            $request->filled('organization_id') ? (int) $request->input('organization_id') : null
        );

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:500'],
            'avatar' => ['nullable', 'string', 'max:500'],
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique('users', 'username')->where('organization_id', $targetOrgId),
            ],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'in:SUPER_ADMIN,ORG_ADMIN,TEACHER,STUDENT'],
            'organization_id' => ['nullable', 'exists:organizations,id'],
        ]);

        $fullName = !empty($validated['name']) 
            ? $validated['name'] 
            : trim(($validated['last_name'] ?? '') . ' ' . ($validated['middle_name'] ?? '') . ' ' . ($validated['first_name'] ?? ''));
        if (empty($fullName)) {
            $fullName = $validated['username'];
        }

        $tenantContext = app(TenantContext::class);

        $targetOrgId = $tenantContext->resolveTargetOrgId(
            isset($validated['organization_id']) ? (int)$validated['organization_id'] : null
        );

        $tenantContext->assertCanAssignRole($validated['role'], $targetOrgId);

        User::create([
            'organization_id' => $targetOrgId,
            'name' => $fullName,
            'first_name' => $validated['first_name'] ?? null,
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name' => $validated['last_name'] ?? null,
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'address' => $validated['address'] ?? null,
            'avatar' => $validated['avatar'] ?? ('https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($validated['username'])),
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'status' => 'ACTIVE',
        ]);

        session()->put('foxy_active_org_id', $targetOrgId);
        cookie()->queue('foxy_active_org_id', (string)$targetOrgId, 60 * 24 * 30);

        return redirect('/admin/users?org_id=' . $targetOrgId);
    });

    Route::post('/admin/users/create', function (Request $request) {
        $orgId = $request->query('org_id') ?: $request->input('organization_id') ?: $request->cookie('foxy_active_org_id') ?: session('foxy_active_org_id');
        return redirect('/admin/users' . ($orgId ? '?org_id=' . $orgId : ''));
    });

    Route::get('/admin/users/{id}/edit', function (Request $request, $id) use ($getAdminCommonData) {
        $currentUser = Auth::user();
        if (!in_array($currentUser->role, ['SUPER_ADMIN', 'ORG_ADMIN'])) {
            abort(403);
        }

        $tenantContext = app(TenantContext::class);
        $targetUser = User::findOrFail($id);
        $tenantContext->enforceOwnership($targetUser);

        [$userData, $teams, $currentScopeOrg] = $getAdminCommonData($request);
        $organizations = Organization::where('id', $currentScopeOrg->id)->get(['id', 'name', 'code']);
        $isRootContext = ($currentScopeOrg->code === 'ROOT' || $currentScopeOrg->id === 1);

        return Inertia::render('Admin/Users/Edit', [
            'user' => $userData,
            'teams' => $teams,
            'currentScopeOrg' => [
                'id' => $currentScopeOrg->id,
                'name' => $currentScopeOrg->name,
                'code' => $currentScopeOrg->code,
            ],
            'isRootContext' => $isRootContext,
            'targetUser' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'first_name' => $targetUser->first_name,
                'middle_name' => $targetUser->middle_name,
                'last_name' => $targetUser->last_name,
                'date_of_birth' => $targetUser->date_of_birth ? (is_string($targetUser->date_of_birth) ? $targetUser->date_of_birth : $targetUser->date_of_birth->format('Y-m-d')) : '',
                'address' => $targetUser->address ?? '',
                'avatar' => $targetUser->avatar ?? '',
                'username' => $targetUser->username,
                'email' => $targetUser->email,
                'role' => $targetUser->role,
                'status' => $targetUser->status,
                'organization_id' => $targetUser->organization_id,
            ],
            'organizations' => $organizations,
        ]);
    });

    Route::get('/admin/users/{id}', function (Request $request, $id) use ($getAdminCommonData) {
        $currentUser = Auth::user();
        if (!in_array($currentUser->role, ['SUPER_ADMIN', 'ORG_ADMIN'])) {
            abort(403);
        }

        $tenantContext = app(TenantContext::class);
        $targetUser = User::with('organization')->findOrFail($id);
        $tenantContext->enforceOwnership($targetUser);

        [$userData, $teams, $currentScopeOrg] = $getAdminCommonData($request);
        $isRootContext = ($currentScopeOrg->code === 'ROOT' || $currentScopeOrg->id === 1);

        return Inertia::render('Admin/Users/Show', [
            'user' => $userData,
            'teams' => $teams,
            'currentScopeOrg' => [
                'id' => $currentScopeOrg->id,
                'name' => $currentScopeOrg->name,
                'code' => $currentScopeOrg->code,
            ],
            'isRootContext' => $isRootContext,
            'targetUser' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'first_name' => $targetUser->first_name,
                'middle_name' => $targetUser->middle_name,
                'last_name' => $targetUser->last_name,
                'date_of_birth' => $targetUser->date_of_birth ? \Illuminate\Support\Carbon::parse($targetUser->date_of_birth)->format('Y-m-d') : null,
                'address' => $targetUser->address,
                'avatar' => $targetUser->avatar,
                'username' => $targetUser->username,
                'email' => $targetUser->email,
                'role' => $targetUser->role,
                'status' => $targetUser->status,
                'created_at' => $targetUser->created_at?->toIso8601String(),
                'organization' => $targetUser->organization ? [
                    'id' => $targetUser->organization->id,
                    'name' => $targetUser->organization->name,
                    'code' => $targetUser->organization->code,
                ] : null,
            ],
        ]);
    });

    Route::post('/admin/users/{id}/update', function (Request $request, $id) {
        $currentUser = Auth::user();
        if (!in_array($currentUser->role, ['SUPER_ADMIN', 'ORG_ADMIN'])) {
            abort(403);
        }

        $tenantContext = app(TenantContext::class);
        $targetUser = User::findOrFail($id);
        $tenantContext->enforceOwnership($targetUser);

        $targetOrgId = $tenantContext->resolveTargetOrgId(
            $request->filled('organization_id') ? (int) $request->input('organization_id') : $targetUser->organization_id
        );

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:500'],
            'avatar' => ['nullable', 'string', 'max:500'],
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique('users', 'username')->where('organization_id', $targetOrgId)->ignore($id),
            ],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $id],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['required', 'in:SUPER_ADMIN,ORG_ADMIN,TEACHER,STUDENT'],
            'status' => ['required', 'in:ACTIVE,SUSPENDED'],
            'organization_id' => ['nullable', 'exists:organizations,id'],
        ]);

        $targetOrgId = $tenantContext->resolveTargetOrgId(
            isset($validated['organization_id']) ? (int)$validated['organization_id'] : $targetUser->organization_id
        );

        $tenantContext->assertCanAssignRole($validated['role'], $targetOrgId);

        $fullName = !empty($validated['name']) 
            ? $validated['name'] 
            : trim(($validated['last_name'] ?? '') . ' ' . ($validated['middle_name'] ?? '') . ' ' . ($validated['first_name'] ?? ''));
        if (empty($fullName)) {
            $fullName = $targetUser->name;
        }

        $data = [
            'name' => $fullName,
            'first_name' => $validated['first_name'] ?? $targetUser->first_name,
            'middle_name' => $validated['middle_name'] ?? $targetUser->middle_name,
            'last_name' => $validated['last_name'] ?? $targetUser->last_name,
            'date_of_birth' => $validated['date_of_birth'] ?? $targetUser->date_of_birth,
            'address' => $validated['address'] ?? $targetUser->address,
            'avatar' => $validated['avatar'] ?? $targetUser->avatar,
            'username' => $validated['username'],
            'email' => $validated['email'],
            'role' => $validated['role'],
            'status' => $validated['status'],
            'organization_id' => $targetOrgId,
        ];

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $targetUser->update($data);

        session()->put('foxy_active_org_id', $targetOrgId);
        cookie()->queue('foxy_active_org_id', (string)$targetOrgId, 60 * 24 * 30);

        return redirect('/admin/users?org_id=' . $targetOrgId);
    });

    Route::post('/admin/users/{id}/delete', function (Request $request, $id) {
        $currentUser = Auth::user();
        if (!in_array($currentUser->role, ['SUPER_ADMIN', 'ORG_ADMIN'])) {
            abort(403);
        }

        if ((int)$currentUser->id === (int)$id) {
            return back()->withErrors(['message' => 'Bạn không thể tự xóa tài khoản của chính mình!']);
        }

        $tenantContext = app(TenantContext::class);
        $targetUser = User::findOrFail($id);
        $tenantContext->enforceOwnership($targetUser);

        $orgId = $targetUser->organization_id;
        $targetUser->delete();

        $scopedOrgId = $request->query('org_id') ?: $request->input('org_id') ?: $request->cookie('foxy_active_org_id') ?: session('foxy_active_org_id') ?: $orgId;
        return redirect('/admin/users?org_id=' . $scopedOrgId);
    });

    // ==========================================
    // 4.6 SAAS PLANS MANAGEMENT (SUPER ADMIN)
    // ==========================================
    Route::post('/admin/plans', function (Request $request) use ($checkIsRootAdmin) {
        $checkIsRootAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:plans,name'],
            'display_name' => ['required', 'string', 'max:100'],
            'price' => ['required', 'numeric', 'min:0'],
            'max_exams_per_month' => ['required', 'integer', 'min:1'],
            'max_students_per_exam' => ['required', 'integer', 'min:1'],
            'storage_limit_gb' => ['required', 'integer', 'min:1'],
            'has_ai_proctoring' => ['nullable', 'boolean'],
            'has_code_replay' => ['nullable', 'boolean'],
        ]);

        Plan::create([
            'name' => strtoupper($validated['name']),
            'display_name' => $validated['display_name'],
            'price' => $validated['price'],
            'max_exams_per_month' => $validated['max_exams_per_month'],
            'max_students_per_exam' => $validated['max_students_per_exam'],
            'storage_limit_gb' => $validated['storage_limit_gb'],
            'has_ai_proctoring' => $validated['has_ai_proctoring'] ?? false,
            'has_code_replay' => $validated['has_code_replay'] ?? false,
            'is_active' => true,
        ]);

        return redirect('/admin/saas-plans');
    });

    Route::post('/admin/plans/{id}/update', function (Request $request, $id) use ($checkIsRootAdmin) {
        $checkIsRootAdmin($request);

        $plan = Plan::findOrFail($id);
        $validated = $request->validate([
            'display_name' => ['required', 'string', 'max:100'],
            'price' => ['required', 'numeric', 'min:0'],
            'max_exams_per_month' => ['required', 'integer', 'min:1'],
            'max_students_per_exam' => ['required', 'integer', 'min:1'],
            'storage_limit_gb' => ['required', 'integer', 'min:1'],
            'has_ai_proctoring' => ['nullable', 'boolean'],
            'has_code_replay' => ['nullable', 'boolean'],
        ]);

        $plan->update([
            'display_name' => $validated['display_name'],
            'price' => $validated['price'],
            'max_exams_per_month' => $validated['max_exams_per_month'],
            'max_students_per_exam' => $validated['max_students_per_exam'],
            'storage_limit_gb' => $validated['storage_limit_gb'],
            'has_ai_proctoring' => $validated['has_ai_proctoring'] ?? false,
            'has_code_replay' => $validated['has_code_replay'] ?? false,
        ]);

        return redirect('/admin/saas-plans');
    });

    Route::post('/admin/plans/{id}/delete', function (Request $request, $id) use ($checkIsRootAdmin) {
        $checkIsRootAdmin($request);

        $plan = Plan::findOrFail($id);
        if ($plan->name === 'FREE') {
            return back()->withErrors(['message' => 'Không thể xóa gói FREE mặc định của hệ thống!']);
        }

        $plan->delete();
        return redirect('/admin/saas-plans');
    });

    // ==========================================
    // 4.7 BILLING & INVOICE MANAGEMENT
    // ==========================================
    Route::post('/admin/invoices/{id}/confirm', function ($id) {
        // Platform-only (EnforceContextScope: 'invoices' => billing); a school can never settle its own invoice
        abort_unless(app(TenantContext::class)->capabilities()['billing'], 403);

        $invoice = Invoice::findOrFail($id);
        $invoice->update([
            'status' => 'PAID',
            'paid_at' => now(),
        ]);

        return redirect('/admin/saas-plans')->with('success', 'Đã ghi nhận thanh toán.');
    });

    // ==========================================
    // 4.8 EXAM REPORTS & LIVE MONITORING
    // ==========================================
    Route::get('/admin/reports/{examId}', function ($examId) use ($getAdminCommonData) {
        [$userData, $teams] = $getAdminCommonData();
        $exam = Exam::with(['course:id,name,code', 'organization:id,name,code'])
            ->withCount(['attempts', 'violations'])
            ->findOrFail($examId);
        app(TenantContext::class)->enforceOwnership($exam);

        $attempts = \App\Models\ExamAttempt::where('exam_id', $examId)
            ->with('user:id,name,username,email,avatar')
            ->withCount('violations')
            ->latest()
            ->get()
            ->map(fn($att) => [
                'id' => $att->id,
                'user_id' => $att->user_id,
                'user_name' => $att->user?->name ?? 'Thí sinh',
                'user_username' => $att->user?->username ?? 'student',
                'avatar' => $att->user?->avatar,
                'attempt_number' => $att->attempt_number,
                'ended_reason' => $att->ended_reason,
                'voided' => $att->voided_at !== null,
                'status' => $att->status,
                'score' => $att->score,
                'started_at' => $att->started_at?->toIso8601String(),
                'submitted_at' => $att->submitted_at?->toIso8601String(),
                'violations_count' => $att->violations_count,
            ]);

        $violationsQuery = fn () => Violation::whereHas('attempt', fn($q) => $q->where('exam_id', $examId));
        $violationsTotal = $violationsQuery()->count();
        $violationsPending = $violationsQuery()->where('is_reviewed', false)->count();
        $violations = $violationsQuery()
            ->with('attempt.user:id,name,username')
            ->orderByDesc('id')
            ->limit(40)
            ->get()
            ->map(fn($v) => [
                'id' => $v->id,
                'attempt_id' => $v->exam_attempt_id,
                'student_name' => $v->attempt?->user?->name ?? 'Thí sinh',
                'student_username' => $v->attempt?->user?->username ?? 'student',
                'type' => $v->violation_type,
                'severity' => $v->severity,
                'details' => $v->details,
                'timestamp' => $v->timestamp?->toIso8601String() ?? now()->toIso8601String(),
                'is_reviewed' => (bool) $v->is_reviewed,
                'is_false_positive' => (bool) $v->is_false_positive,
            ]);

        return Inertia::render('Admin/Reports/Show', [
            'violations_total' => $violationsTotal,
            'violations_pending' => $violationsPending,
            'user' => $userData,
            'teams' => $teams,
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'code' => $exam->code,
                'type' => $exam->type,
                'status' => $exam->status,
                'duration_minutes' => $exam->duration_minutes,
                'course_name' => $exam->course?->name,
                'course_code' => $exam->course?->code,
                'organization_name' => $exam->organization?->name,
                'monitoring_config' => $exam->monitoring_config,
                'attempts_count' => $exam->attempts_count,
                'violations_count' => $exam->violations_count,
            ],
            'attempts' => $attempts,
            'violations' => $violations,
        ]);
    });

    // ==========================================
    // 4.3 COURSES CRUD
    // ==========================================
    Route::get('/admin/courses/new', function () use ($getAdminCommonData) {
        [$userData, $teams] = $getAdminCommonData();
        $orgId = app(TenantContext::class)->id();
        $teachers = User::where('organization_id', $orgId)->whereIn('role', ['TEACHER', 'ORG_ADMIN'])->get(['id', 'name']);
        $organizations = Organization::where('id', $orgId)->get(['id', 'name', 'code']);

        return Inertia::render('Admin/Courses/Create', [
            'user' => $userData,
            'teams' => $teams,
            'teachers' => $teachers,
            'organizations' => $organizations,
        ]);
    });

    Route::post('/admin/courses', function (Request $request) {
        $currentUser = Auth::user();
        $tenantContext = app(TenantContext::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'teacher_id' => ['nullable', 'exists:users,id'],
            'organization_id' => ['nullable', 'exists:organizations,id'],
        ]);

        $orgId = $tenantContext->id();

        if (!empty($validated['teacher_id'])
            && !User::where('id', $validated['teacher_id'])->where('organization_id', $orgId)->exists()) {
            return back()->withErrors(['teacher_id' => 'Giảng viên phải thuộc tổ chức hiện tại.']);
        }

        Course::create([
            'organization_id' => $orgId,
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'description' => $validated['description'] ?? '',
            'teacher_id' => $validated['teacher_id'] ?? $currentUser->id,
        ]);

        return redirect('/admin/courses');
    });

    Route::get('/admin/courses/{id}', function ($id) use ($getAdminCommonData) {
        $course = Course::with([
            'teacher:id,name', 
            'organization:id,name', 
            'exams' => fn($q) => $q->withCount('attempts')
        ])->findOrFail($id);

        app(TenantContext::class)->enforceOwnership($course);

        [$userData, $teams] = $getAdminCommonData();

        return Inertia::render('Admin/Courses/Show', [
            'user' => $userData,
            'teams' => $teams,
            'course' => [
                'id' => $course->id,
                'name' => $course->name,
                'code' => $course->code,
                'description' => $course->description,
                'teacher_name' => $course->teacher?->name ?? 'Chưa gán',
                'organization_name' => $course->organization?->name,
                'exams' => $course->exams->map(fn($e) => [
                    'id' => $e->id,
                    'title' => $e->title,
                    'code' => $e->code,
                    'type' => $e->type,
                    'duration_minutes' => $e->duration_minutes,
                    'status' => $e->status,
                    'attempts_count' => $e->attempts_count,
                ]),
            ],
        ]);
    });

    Route::get('/admin/courses/{id}/edit', function ($id) use ($getAdminCommonData) {
        $course = Course::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($course);

        [$userData, $teams] = $getAdminCommonData();
        $teachers = User::where('organization_id', $course->organization_id)->whereIn('role', ['TEACHER', 'ORG_ADMIN'])->get(['id', 'name']);

        return Inertia::render('Admin/Courses/Edit', [
            'user' => $userData,
            'teams' => $teams,
            'course' => [
                'id' => $course->id,
                'name' => $course->name,
                'code' => $course->code,
                'description' => $course->description,
                'teacher_id' => $course->teacher_id,
                'organization_id' => $course->organization_id,
            ],
            'teachers' => $teachers,
        ]);
    });

    Route::post('/admin/courses/{id}/update', function (Request $request, $id) {
        $course = Course::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($course);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'teacher_id' => ['nullable', 'exists:users,id'],
        ]);

        if (!empty($validated['teacher_id'])
            && !User::where('id', $validated['teacher_id'])->where('organization_id', $course->organization_id)->exists()) {
            return back()->withErrors(['teacher_id' => 'Giảng viên phải thuộc tổ chức hiện tại.']);
        }

        $course->update([
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'description' => $validated['description'] ?? '',
            'teacher_id' => $validated['teacher_id'] ?? $course->teacher_id,
        ]);

        return redirect('/admin/courses');
    });

    Route::post('/admin/courses/{id}/delete', function ($id) {
        $course = Course::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($course);
        $course->delete();
        return redirect('/admin/courses');
    });

    // ==========================================
    // 4.4 EXAMS CRUD
    // ==========================================
    // Shared data for the two exam forms (FoxyExam Screens v2): Thi phổ thông = CLASSICAL sets, Thi lập trình = PROGRAMMING sets.
    $examFormProps = function (int $orgId, string $setType) {
        $courses = Course::where('organization_id', $orgId)->withCount('enrollments')->get(['id', 'name', 'code']);
        if ($courses->isEmpty()) {
            $courses = Course::withCount('enrollments')->get(['id', 'name', 'code']);
        }

        $questionSets = QuestionSet::where('organization_id', $orgId)
            ->where('type', $setType)
            ->with(['course:id,name,code', 'programmingProblems:id,question_set_id,title,difficulty,time_limit_ms,memory_limit_mb'])
            ->withCount(['classicalQuestions', 'programmingProblems'])
            ->get()
            ->map(fn($qs) => [
                'id' => $qs->id,
                'name' => $qs->name,
                'code' => $qs->code,
                'type' => $qs->type,
                'status' => $qs->status,
                'course_id' => $qs->course_id,
                'course_name' => $qs->course?->name,
                'max_score' => (float) $qs->max_score,
                'questions_count' => $qs->type === 'CLASSICAL' ? $qs->classical_questions_count : $qs->programming_problems_count,
                'problems' => $qs->type === 'PROGRAMMING' ? $qs->programmingProblems->map(fn ($p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'difficulty' => $p->difficulty,
                    'time_limit_ms' => $p->time_limit_ms,
                    'memory_limit_mb' => $p->memory_limit_mb,
                ])->values() : [],
            ]);

        $quotaService = app(QuotaService::class);
        $quotaOrg = Organization::find($orgId) ?? Auth::user()->organization;
        $quotaPlan = $quotaService->getActivePlan($quotaOrg);
        $quotaUsage = $quotaService->getCurrentUsage($quotaOrg);

        // Giám thị chọn trong nhân sự (giảng viên, quản trị) của chính tổ chức
        $proctorOptions = User::withoutGlobalScopes()
            ->where('organization_id', $orgId)
            ->whereIn('role', ['TEACHER', 'ORG_ADMIN'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role'])
            ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->role]);

        return [
            'proctorOptions' => $proctorOptions,
            'courses' => $courses->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'students_count' => $c->enrollments_count,
            ]),
            'questionSets' => $questionSets,
            'quota' => [
                'plan_name' => $quotaPlan->display_name ?? $quotaPlan->name,
                'exams_used' => $quotaUsage->exams_created_count,
                'exams_limit' => $quotaPlan->max_exams_per_month,
                'students_limit' => $quotaPlan->max_students_per_exam,
                'has_ai' => (bool) $quotaPlan->has_ai_proctoring,
            ],
        ];
    };

    // Only staff of the exam's own organization may be proctors; the actor is always kept (never an empty room)
    $syncProctors = function (int $orgId, array $ids, int $actorId) {
        $valid = User::withoutGlobalScopes()->where('organization_id', $orgId)
            ->whereIn('role', ['TEACHER', 'ORG_ADMIN'])->whereIn('id', $ids)->pluck('id')->all();
        $actor = User::withoutGlobalScopes()->where('id', $actorId)->where('organization_id', $orgId)->exists();

        return array_values(array_unique($actor ? [...$valid, $actorId] : $valid));
    };

    $examScopeOrgId = fn (Request $request) => $request->query('org_id')
        ? (int) $request->query('org_id')
        : app(TenantContext::class)->current()->id;

    // "Tạo kỳ thi" is a dialog on the exam list; each exam kind has its own create page below
    Route::get('/admin/exams/new', fn (Request $request) => redirect('/admin/exams?create=1' . ($request->query('course_id') ? '&course_id=' . (int) $request->query('course_id') : '')));

    Route::get('/admin/exams/new/{kind}', function (Request $request, string $kind) use ($getAdminCommonData, $examFormProps, $examScopeOrgId) {
        [$userData, $teams] = $getAdminCommonData();
        $isCode = $kind === 'programming';

        return Inertia::render($isCode ? 'Admin/Exams/ProgrammingForm' : 'Admin/Exams/GeneralForm', [
            'user' => $userData,
            'teams' => $teams,
            ...$examFormProps($examScopeOrgId($request), $isCode ? 'PROGRAMMING' : 'CLASSICAL'),
            'defaultCourseId' => $request->query('course_id') ? (int) $request->query('course_id') : null,
            'exam' => null,
        ]);
    })->whereIn('kind', ['general', 'programming']);

    Route::post('/admin/exams', function (Request $request, QuotaService $quotaService) use ($syncProctors) {
        $currentUser = Auth::user();
        // The ACTIVE organization (also for a Super Admin viewing a school) — never the account's own org
        $org = app(TenantContext::class)->current();

        $quotaCheck = $quotaService->canCreateExam($org);
        if (!$quotaCheck['allowed']) {
            return back()->withErrors(['message' => $quotaCheck['message']]);
        }

        $validated = $request->validate([
            'course_id' => ['required', 'exists:courses,id'],
            'question_set_id' => ['required', 'exists:question_sets,id'],
            'title' => ['required', 'string', 'max:255'],
            'duration_minutes' => ['required', 'integer', 'min:15', 'max:300'],
            // Lịch thi & số lượt (NULL = không giới hạn)
            'start_time' => ['nullable', 'date'],
            'end_time' => ['nullable', 'date', \Illuminate\Validation\Rule::when(fn ($input) => !empty($input['start_time']), ['after:start_time'])],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:100'],
            'status' => ['nullable', 'in:DRAFT,PUBLISHED'],
            // Common anti-cheat
            'prevent_tab_switch' => ['nullable', 'boolean'],
            'ai_face_check' => ['nullable', 'boolean'],
            // Programming specific
            'prevent_paste' => ['nullable', 'boolean'],
            'max_paste_chars' => ['nullable', 'integer'],
            'track_keystroke' => ['nullable', 'boolean'],
            // Classical specific
            'is_shuffle_questions' => ['nullable', 'boolean'],
            'is_shuffle_answers' => ['nullable', 'boolean'],
            'is_hide_score' => ['nullable', 'boolean'],
            'is_allow_review' => ['nullable', 'boolean'],
            'number_questions_per_page' => ['nullable', 'integer'],
            'require_mic' => ['nullable', 'boolean'],
            'require_screen' => ['nullable', 'boolean'],
            'allowed_apps_enabled' => ['nullable', 'boolean'],
            'allowed_apps' => ['nullable', 'array', 'max:30'],
            'allowed_apps.*' => ['string', 'max:40', 'regex:/^[A-Za-z0-9._ -]+$/'],
            'proctor_ids' => ['nullable', 'array', 'max:50'],
            'proctor_ids.*' => ['integer'],
            'excluded_student_ids' => ['nullable', 'array', 'max:5000'],
            'excluded_student_ids.*' => ['integer'],
        ]);

        $questionSet = QuestionSet::findOrFail($validated['question_set_id']);
        app(TenantContext::class)->enforceOwnership($questionSet);
        app(TenantContext::class)->enforceOwnership(Course::findOrFail($validated['course_id']));
        $examType = ($questionSet->type === 'CLASSICAL') ? 'QUIZ' : 'PROGRAMMING';

        $monitoringConfig = [
            'type' => $questionSet->type,
            'prevent_tab_switch' => $validated['prevent_tab_switch'] ?? true,
            'ai_face_check' => $validated['ai_face_check'] ?? true,
        ];

        if ($questionSet->type === 'CLASSICAL') {
            $monitoringConfig['is_shuffle_questions'] = $validated['is_shuffle_questions'] ?? true;
            $monitoringConfig['is_shuffle_answers'] = $validated['is_shuffle_answers'] ?? true;
            $monitoringConfig['is_hide_score'] = $validated['is_hide_score'] ?? false;
            $monitoringConfig['is_allow_review'] = $validated['is_allow_review'] ?? true;
            $monitoringConfig['number_questions_per_page'] = $validated['number_questions_per_page'] ?? 1;
            $monitoringConfig['require_mic'] = $validated['require_mic'] ?? false;
        } else {
            $monitoringConfig['max_paste_chars'] = $validated['max_paste_chars'] ?? 80;
            $monitoringConfig['track_keystroke_dynamics'] = $validated['track_keystroke'] ?? true;
        }
        $monitoringConfig['prevent_paste'] = $validated['prevent_paste'] ?? true;
        $monitoringConfig['require_screen'] = (bool) ($validated['require_screen'] ?? false);
        $monitoringConfig['allowed_apps'] = ($validated['allowed_apps_enabled'] ?? false) && $questionSet->type === 'PROGRAMMING'
            ? array_values(array_unique(array_map('strtolower', $validated['allowed_apps'] ?? ['devenv', 'code']))) : [];
        $monitoringConfig['allowed_apps_enabled'] = $monitoringConfig['allowed_apps'] !== [];

        $exam = Exam::create([
            'organization_id' => $org->id,
            'course_id' => $validated['course_id'],
            'question_set_id' => $questionSet->id,
            'title' => $validated['title'],
            'code' => 'FOXY-' . strtoupper(Str::random(6)),
            'type' => $examType,
            'status' => $validated['status'] ?? 'PUBLISHED',
            'duration_minutes' => $validated['duration_minutes'],
            'start_time' => $validated['start_time'] ?? null,
            'end_time' => $validated['end_time'] ?? null,
            'max_attempts' => $validated['max_attempts'] ?? null,
            'monitoring_config' => $monitoringConfig,
            'created_by' => $currentUser->id,
        ]);

        $exam->proctors()->sync($syncProctors($org->id, $validated['proctor_ids'] ?? [], $currentUser->id));
        $exam->excludedStudents()->sync(\App\Support\Roster::onlyEnrolled((int) $exam->course_id, $validated['excluded_student_ids'] ?? []));

        $quotaService->recordExamCreated($org);

        session()->put('foxy_active_org_id', $org->id);
        cookie()->queue('foxy_active_org_id', (string)$org->id, 60 * 24 * 30);

        return redirect('/admin/exams');
    });

    Route::get('/admin/exams/{id}', function ($id) use ($getAdminCommonData) {
        $exam = Exam::with([
            'course:id,name,code',
            'questionSet.classicalQuestions.answers',
            'questionSet.programmingProblems.testCases',
            'problems',
            'attempts' => fn($q) => $q->with('user:id,name,username')->latest(),
        ])->findOrFail($id);

        app(TenantContext::class)->enforceOwnership($exam);

        $violations = Violation::whereHas('attempt', fn($q) => $q->where('exam_id', $exam->id))
            ->with('attempt.user:id,name')
            ->latest()
            ->take(20)
            ->get()
            ->map(fn($v) => [
                'id' => $v->id,
                'attempt_id' => $v->exam_attempt_id,
                'student_name' => $v->attempt?->user?->name ?? 'Thí sinh',
                'type' => $v->violation_type,
                'severity' => $v->severity,
                'details' => $v->details,
                'timestamp' => $v->timestamp?->toIso8601String() ?? now()->toIso8601String(),
            ]);

        [$userData, $teams] = $getAdminCommonData();

        $questionSetData = null;
        if ($exam->questionSet) {
            $qs = $exam->questionSet;
            $questionSetData = [
                'id' => $qs->id,
                'name' => $qs->name,
                'code' => $qs->code,
                'type' => $qs->type,
                'description' => $qs->description,
                'classical_questions' => $qs->classicalQuestions->map(fn($q) => [
                    'id' => $q->id,
                    'type' => $q->type,
                    'content' => $q->content,
                    'points' => $q->points,
                    'answers_count' => $q->answers->count(),
                ]),
                'programming_problems' => $qs->programmingProblems->map(fn($p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'difficulty' => $p->difficulty,
                    'time_limit_ms' => $p->time_limit_ms,
                    'memory_limit_mb' => $p->memory_limit_mb,
                    'test_cases_count' => $p->testCases->count(),
                ]),
            ];
        }

        return Inertia::render('Admin/Exams/Show', [
            'user' => $userData,
            'teams' => $teams,
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'code' => $exam->code,
                'type' => $exam->type,
                'start_time' => $exam->start_time?->toIso8601String(),
                'end_time' => $exam->end_time?->toIso8601String(),
                'max_attempts' => $exam->max_attempts,
                'duration_minutes' => $exam->duration_minutes,
                'status' => $exam->status,
                'course_name' => $exam->course?->name ?? 'Môn học chung',
                'question_set' => $questionSetData,
                'monitoring_config' => $exam->monitoring_config,
                'problems' => $exam->problems->map(fn($p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'difficulty' => $p->difficulty,
                    'time_limit_ms' => $p->time_limit_ms,
                    'memory_limit_mb' => $p->memory_limit_mb,
                ]),
                'attempts' => $exam->attempts->map(fn($a) => [
                    'id' => $a->id,
                    'attempt_number' => $a->attempt_number,
                    'student_name' => $a->user?->name ?? 'Thí sinh',
                    'student_username' => $a->user?->username ?? 'student',
                    'status' => $a->status,
                    'score' => (float)$a->score,
                    'started_at' => $a->started_at?->toIso8601String(),
                ]),
                'violations' => $violations,
            ],
        ]);
    });

    Route::get('/admin/exams/{id}/edit', function ($id) use ($getAdminCommonData, $examFormProps) {
        $exam = Exam::with('questionSet')->findOrFail($id);
        app(TenantContext::class)->enforceOwnership($exam);
        [$userData, $teams] = $getAdminCommonData();
        $setType = $exam->questionSet?->type ?? ($exam->type === 'QUIZ' ? 'CLASSICAL' : 'PROGRAMMING');
        $isCode = $setType === 'PROGRAMMING';

        return Inertia::render($isCode ? 'Admin/Exams/ProgrammingForm' : 'Admin/Exams/GeneralForm', [
            'user' => $userData,
            'teams' => $teams,
            ...$examFormProps($exam->organization_id, $setType),
            'defaultCourseId' => null,
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'code' => $exam->code,
                'course_id' => $exam->course_id,
                'question_set_id' => $exam->question_set_id,
                'duration_minutes' => $exam->duration_minutes,
                'start_time' => $exam->start_time?->toIso8601String(),
                'end_time' => $exam->end_time?->toIso8601String(),
                'max_attempts' => $exam->max_attempts,
                'status' => $exam->status,
                'monitoring_config' => $exam->monitoring_config ?? (object) [],
                'attempts_count' => $exam->attempts()->count(),
                'proctor_ids' => $exam->proctors()->pluck('users.id')->values(),
                'excluded_student_ids' => $exam->excludedStudents()->pluck('users.id')->values(),
            ],
        ]);
    });

    Route::get('/admin/courses/{id}/roster', function (Request $request, $id) {
        $course = \App\Models\Course::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($course);

        return response()->json(\App\Support\Roster::of($course, (string) $request->query('q', '')));
    });

    Route::post('/admin/exams/{id}/update', function (Request $request, $id) use ($syncProctors) {
        $exam = Exam::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($exam);
        $validated = $request->validate([
            'course_id' => ['required', 'exists:courses,id'],
            'question_set_id' => ['nullable', 'exists:question_sets,id'],
            'title' => ['required', 'string', 'max:255'],
            'duration_minutes' => ['required', 'integer', 'min:15', 'max:300'],
            'status' => ['required', 'in:DRAFT,PUBLISHED,IN_PROGRESS,ENDED'],
            // Lịch thi & số lượt (NULL = không giới hạn)
            'start_time' => ['nullable', 'date'],
            'end_time' => ['nullable', 'date', \Illuminate\Validation\Rule::when(fn ($input) => !empty($input['start_time']), ['after:start_time'])],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:100'],
            // Common anti-cheat
            'prevent_tab_switch' => ['nullable', 'boolean'],
            'ai_face_check' => ['nullable', 'boolean'],
            // Programming specific
            'prevent_paste' => ['nullable', 'boolean'],
            'max_paste_chars' => ['nullable', 'integer'],
            'track_keystroke' => ['nullable', 'boolean'],
            // Classical specific
            'is_shuffle_questions' => ['nullable', 'boolean'],
            'is_shuffle_answers' => ['nullable', 'boolean'],
            'is_hide_score' => ['nullable', 'boolean'],
            'is_allow_review' => ['nullable', 'boolean'],
            'number_questions_per_page' => ['nullable', 'integer'],
            'require_mic' => ['nullable', 'boolean'],
            'require_screen' => ['nullable', 'boolean'],
            'allowed_apps_enabled' => ['nullable', 'boolean'],
            'allowed_apps' => ['nullable', 'array', 'max:30'],
            'allowed_apps.*' => ['string', 'max:40', 'regex:/^[A-Za-z0-9._ -]+$/'],
            'proctor_ids' => ['nullable', 'array', 'max:50'],
            'proctor_ids.*' => ['integer'],
            'excluded_student_ids' => ['nullable', 'array', 'max:5000'],
            'excluded_student_ids.*' => ['integer'],
        ]);

        $qs = !empty($validated['question_set_id']) ? QuestionSet::find($validated['question_set_id']) : $exam->questionSet;
        if ($qs) {
            app(TenantContext::class)->enforceOwnership($qs);
        }
        app(TenantContext::class)->enforceOwnership(Course::findOrFail($validated['course_id']));
        $examType = $qs ? (($qs->type === 'CLASSICAL') ? 'QUIZ' : 'PROGRAMMING') : $exam->type;

        $config = $exam->monitoring_config ?? [];
        $config['type'] = $qs?->type ?? 'PROGRAMMING';
        $config['prevent_tab_switch'] = $validated['prevent_tab_switch'] ?? true;
        $config['ai_face_check'] = $validated['ai_face_check'] ?? true;

        if ($qs && $qs->type === 'CLASSICAL') {
            $config['is_shuffle_questions'] = $validated['is_shuffle_questions'] ?? true;
            $config['is_shuffle_answers'] = $validated['is_shuffle_answers'] ?? true;
            $config['is_hide_score'] = $validated['is_hide_score'] ?? false;
            $config['is_allow_review'] = $validated['is_allow_review'] ?? true;
            $config['number_questions_per_page'] = $validated['number_questions_per_page'] ?? 1;
            $config['require_mic'] = $validated['require_mic'] ?? false;
        } else {
            $config['max_paste_chars'] = $validated['max_paste_chars'] ?? 80;
            $config['track_keystroke_dynamics'] = $validated['track_keystroke'] ?? true;
        }
        $config['prevent_paste'] = $validated['prevent_paste'] ?? true;
        $config['require_screen'] = (bool) ($validated['require_screen'] ?? false);
        $config['allowed_apps'] = ($validated['allowed_apps_enabled'] ?? false) && $qs && $qs->type === 'PROGRAMMING'
            ? array_values(array_unique(array_map('strtolower', $validated['allowed_apps'] ?? ['devenv', 'code']))) : [];
        $config['allowed_apps_enabled'] = $config['allowed_apps'] !== [];

        $exam->update([
            'course_id' => $validated['course_id'],
            'question_set_id' => $qs?->id ?? $exam->question_set_id,
            'title' => $validated['title'],
            'type' => $examType,
            'duration_minutes' => $validated['duration_minutes'],
            'start_time' => $validated['start_time'] ?? null,
            'end_time' => $validated['end_time'] ?? null,
            'max_attempts' => $validated['max_attempts'] ?? null,
            'status' => $validated['status'],
            'monitoring_config' => $config,
        ]);

        if ($request->has('excluded_student_ids')) {
            $exam->excludedStudents()->sync(\App\Support\Roster::onlyEnrolled((int) $exam->course_id, $validated['excluded_student_ids'] ?? []));
        }
        if ($request->has('proctor_ids')) {
            $exam->proctors()->sync($syncProctors($exam->organization_id, $validated['proctor_ids'] ?? [], Auth::id()));
        }

        return redirect('/admin/exams');
    });

    // Xoá 1 phiên thi (lượt làm bài) của thí sinh — đáp án, bài nộp, op-log và vi phạm
    // của lượt đó bị xoá theo (cascadeOnDelete). Thí sinh lấy lại được 1 lượt thi.
    Route::post('/admin/exams/{id}/attempts/{attemptId}/delete', function ($id, $attemptId) {
        $exam = Exam::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($exam);

        $attempt = \App\Models\ExamAttempt::where('exam_id', $exam->id)->findOrFail($attemptId);
        $attempt->delete();

        return redirect("/admin/exams/{$exam->id}");
    });

    Route::post('/admin/exams/{id}/delete', function ($id) {
        $exam = Exam::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($exam);
        $examOrgId = $exam->organization_id;
        $exam->delete();
        return redirect('/admin/exams');
    });

    // ==========================================
    // 4.5 PROBLEMS CRUD
    // ==========================================
    // Bài toán thuộc bộ bài lập trình: soạn trong /admin/question-sets/{id}/problems/...
    Route::get('/admin/problems/new', fn () => redirect('/admin/question-sets/new/programming'));
    Route::get('/admin/problems/{id}/edit', function ($id) {
        $prob = ProgrammingProblem::with('questionSet')->findOrFail($id);
        abort_unless($prob->questionSet, 404);
        app(TenantContext::class)->enforceOwnership($prob->questionSet);

        return redirect("/admin/question-sets/{$prob->question_set_id}/problems/{$prob->id}");
    });

    // ==========================================
    // 4.6 QUESTION SETS & QUESTIONS AUTHORING CRUD
    // ==========================================
    Route::post('/admin/question-sets', function (Request $request) {
        $user = Auth::user();
        $tenant = app(TenantContext::class);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required', 'string', 'max:50',
                Rule::unique('question_sets', 'code')->where('organization_id', $tenant->id()),
            ],
            'type' => ['required', 'in:CLASSICAL,PROGRAMMING'],
            'course_id' => ['nullable', 'exists:courses,id'],
            'description' => ['nullable', 'string'],
            'max_score' => ['nullable', 'numeric'],
            'status' => ['nullable', 'in:DRAFT,PUBLISHED'],
        ]);

        if (!empty($validated['course_id'])) {
            $tenant->enforceOwnership(Course::findOrFail($validated['course_id']));
        }

        $qs = QuestionSet::create([
            'organization_id' => $tenant->id(),
            'course_id' => $validated['course_id'] ?? null,
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'type' => $validated['type'],
            'description' => $validated['description'] ?? null,
            'max_score' => $validated['max_score'] ?? 10.0,
            'status' => $validated['status'] ?? 'DRAFT',
            'created_by' => $user->id,
        ]);

        return redirect($qs->type === 'PROGRAMMING'
            ? '/admin/question-sets/' . $qs->id . '/problems/new'
            : '/admin/question-sets/' . $qs->id);
    });

    // Trang tạo bộ đề — tách riêng bộ đề phổ thông và bộ bài lập trình.
    Route::get('/admin/question-sets/new/{kind}', function (Request $request, string $kind) use ($getAdminCommonData) {
        [$userData, $teams, $org] = $getAdminCommonData();
        $courses = Course::where('organization_id', $org->id)->get(['id', 'name', 'code']);

        return Inertia::render($kind === 'programming' ? 'Admin/QuestionSets/CreateProgramming' : 'Admin/QuestionSets/CreateClassical', [
            'user' => $userData,
            'teams' => $teams,
            'courses' => $courses,
            'defaultCourseId' => $request->query('course_id') ? (int) $request->query('course_id') : null,
        ]);
    })->whereIn('kind', ['classical', 'programming']);

    Route::get('/admin/question-sets/{id}', function ($id) use ($getAdminCommonData) {
        $qs = QuestionSet::with(['course:id,name,code', 'organization:id,name,code', 'creator:id,name'])
            ->findOrFail($id);
        app(TenantContext::class)->enforceOwnership($qs);

        [$userData, $teams] = $getAdminCommonData();
        $courses = Course::where('organization_id', $qs->organization_id)->get(['id', 'name', 'code']);

        $classicalQuestions = [];
        $programmingProblems = [];

        if ($qs->type === 'CLASSICAL') {
            $classicalQuestions = ClassicalQuestion::where('question_set_id', $id)
                ->whereNull('parent_id')
                ->with(['answers' => fn($q) => $q->orderBy('order'), 'children' => fn($q) => $q->with(['answers' => fn($a) => $a->orderBy('order')])->orderBy('order')])
                ->orderBy('order')
                ->get()
                ->map(fn($q) => [
                    'id' => $q->id,
                    'type' => $q->type,
                    'content' => $q->content,
                    'explanation' => $q->explanation,
                    'is_true' => $q->is_true,
                    'settings' => $q->settings,
                    'skill' => $q->skill,
                    'image' => $q->image,
                    'points' => (float)$q->points,
                    'difficulty' => $q->difficulty,
                    'order' => $q->order,
                    'answers' => $q->answers->map(fn($a) => [
                        'id' => $a->id,
                        'content' => $a->content,
                        'is_correct' => (bool)$a->is_correct,
                        'order' => $a->order,
                    ]),
                    'children' => $q->children->map(fn($c) => [
                        'id' => $c->id,
                        'parent_id' => $c->parent_id,
                        'type' => $c->type,
                        'content' => $c->content,
                        'explanation' => $c->explanation,
                        'is_true' => $c->is_true,
                        'settings' => $c->settings,
                        'skill' => $c->skill,
                        'image' => $c->image,
                        'points' => (float)$c->points,
                        'difficulty' => $c->difficulty,
                        'order' => $c->order,
                        'answers' => $c->answers->map(fn($ca) => [
                            'id' => $ca->id,
                            'content' => $ca->content,
                            'is_correct' => (bool)$ca->is_correct,
                            'order' => $ca->order,
                        ]),
                    ]),
                ]);
        } else {
            $programmingProblems = ProgrammingProblem::where('question_set_id', $id)
                ->with(['testCases' => fn($q) => $q->orderBy('id')])
                ->orderBy('order')
                ->get()
                ->map(fn($p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'description' => $p->description,
                    'difficulty' => $p->difficulty,
                    'time_limit_ms' => $p->time_limit_ms,
                    'memory_limit_mb' => $p->memory_limit_mb,
                    'allowed_languages' => $p->allowed_languages ?? ['cpp', 'python'],
                    'starter_templates' => $p->starter_templates ?? [],
                    'order' => $p->order,
                    'test_cases' => $p->testCases->map(fn($tc) => [
                        'id' => $tc->id,
                        'input_data' => $tc->input_data,
                        'expected_output' => $tc->expected_output,
                        'is_sample' => (bool)$tc->is_sample,
                        'score_weight' => (float)$tc->score_weight,
                    ]),
                ]);
        }

        // Available other question sets to import from
        $otherSets = QuestionSet::where('id', '!=', $id)
            ->where('organization_id', $qs->organization_id)
            ->where('type', $qs->type)
            ->withCount(['classicalQuestions', 'programmingProblems'])
            ->get(['id', 'name', 'code', 'type', 'created_at']);

        // Available bank items to import
        $availableBankItems = [];
        if ($qs->type === 'CLASSICAL') {
            $availableBankItems = ClassicalQuestion::where('question_set_id', '!=', $id)
                ->whereHas('questionSet', fn ($w) => $w->where('organization_id', $qs->organization_id))
                ->whereNull('parent_id')
                ->with(['questionSet:id,name,code', 'answers'])
                ->get()
                ->map(fn($q) => [
                    'id' => $q->id,
                    'type' => $q->type,
                    'content' => Str::limit($q->content, 120),
                    'set_name' => $q->questionSet?->name ?? 'Bộ đề khác',
                    'set_code' => $q->questionSet?->code ?? '',
                    'points' => $q->points,
                    'difficulty' => $q->difficulty,
                ]);
        } else {
            $availableBankItems = ProgrammingProblem::where('question_set_id', '!=', $id)
                ->whereHas('questionSet', fn ($w) => $w->where('organization_id', $qs->organization_id))
                ->with(['questionSet:id,name,code'])
                ->withCount('testCases')
                ->get()
                ->map(fn($p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'set_name' => $p->questionSet?->name ?? 'Ngân hàng chung',
                    'set_code' => $p->questionSet?->code ?? '',
                    'difficulty' => $p->difficulty,
                    'test_cases_count' => $p->test_cases_count,
                ]);
        }

        return Inertia::render('Admin/QuestionSets/Show', [
            'user' => $userData,
            'teams' => $teams,
            'questionSet' => [
                'id' => $qs->id,
                'name' => $qs->name,
                'code' => $qs->code,
                'type' => $qs->type,
                'description' => $qs->description,
                'status' => $qs->status,
                'max_score' => $qs->max_score,
                'limit_questions' => (int) $qs->limit_questions,
                'ratio_per_difficulty' => $qs->ratio_per_difficulty,
                'course_name' => $qs->course?->name ?? 'Dùng chung',
                'course_id' => $qs->course_id,
                'organization_name' => $qs->organization?->name,
                'creator_name' => $qs->creator?->name ?? 'Giảng viên',
            ],
            'courses' => $courses,
            'classicalQuestions' => $classicalQuestions,
            'programmingProblems' => $programmingProblems,
            'otherSets' => $otherSets,
            'availableBankItems' => $availableBankItems,
        ]);
    });

    Route::post('/admin/question-sets/{id}/update', function (Request $request, $id) {
        $qs = QuestionSet::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($qs);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required', 'string', 'max:50',
                Rule::unique('question_sets', 'code')->where('organization_id', $qs->organization_id)->ignore($qs->id),
            ],
            'course_id' => ['nullable', 'exists:courses,id'],
            'description' => ['nullable', 'string'],
            'max_score' => ['nullable', 'numeric'],
            'status' => ['required', 'in:DRAFT,PUBLISHED,ARCHIVED'],
            'limit_questions' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'ratio_per_difficulty' => ['nullable', 'array'],
            'ratio_per_difficulty.*' => ['integer', 'min:0', 'max:100'],
        ]);

        if (!empty($validated['course_id'])) {
            app(TenantContext::class)->enforceOwnership(Course::findOrFail($validated['course_id']));
        }
        $ratio = collect($validated['ratio_per_difficulty'] ?? [])->only(ClassicalQuestion::DIFFICULTIES);
        if ($ratio->sum() > 0 && $ratio->sum() !== 100) {
            return back()->withErrors(['ratio_per_difficulty' => 'Tổng tỉ lệ độ khó phải bằng 100% (đang ' . $ratio->sum() . '%).']);
        }

        $qs->update([
            'limit_questions' => $validated['limit_questions'] ?? 0,
            'ratio_per_difficulty' => $ratio->sum() > 0 ? $ratio->all() : null,
            'name' => $validated['name'],
            'code' => strtoupper($validated['code']),
            'course_id' => $validated['course_id'] ?? null,
            'description' => $validated['description'] ?? null,
            'max_score' => $validated['max_score'] ?? 10.0,
            'status' => $validated['status'],
        ]);

        return redirect()->back();
    });

    Route::post('/admin/question-sets/{id}/delete', function ($id) {
        $qs = QuestionSet::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($qs);
        $qs->delete();
        return redirect('/admin/problem-banks');
    });

    // 4.7 CLASSICAL QUESTION AUTHORING (all six exam-sys types)
    Route::post('/admin/question-sets/{id}/classical-questions', function (Request $request, $id) {
        $qs = QuestionSet::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($qs);
        abort_unless($qs->type === 'CLASSICAL', 422, 'Bộ đề lập trình không có câu hỏi phổ thông.');

        $rules = fn (string $p = '') => [
            $p . 'type' => ['required', Rule::in(ClassicalQuestion::TYPES)],
            $p . 'content' => ['required', 'string'],
            $p . 'explanation' => ['nullable', 'string'],
            $p . 'points' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            $p . 'difficulty' => ['required', Rule::in(ClassicalQuestion::DIFFICULTIES)],
            $p . 'skill' => ['nullable', 'string', 'max:40'],
            $p . 'image' => ['nullable', 'string', 'max:500'],
            $p . 'is_true' => ['nullable', 'boolean'],
            $p . 'settings' => ['nullable', 'array'],
            $p . 'answers' => ['nullable', 'array', 'max:8'],
            $p . 'answers.*.content' => ['required_with:' . $p . 'answers', 'string'],
            $p . 'answers.*.is_correct' => ['nullable', 'boolean'],
        ];

        $validated = $request->validate([
            'id' => ['nullable', 'integer'],
            'parent_id' => ['nullable', 'integer'],
            ...$rules(),
            'children' => ['nullable', 'array', 'max:50'],
            'children.*.type' => ['required', Rule::in(array_diff(ClassicalQuestion::TYPES, ['GROUP_QUESTION']))],
            'children.*.content' => ['required', 'string'],
            'children.*.explanation' => ['nullable', 'string'],
            'children.*.points' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'children.*.difficulty' => ['nullable', Rule::in(ClassicalQuestion::DIFFICULTIES)],
            'children.*.skill' => ['nullable', 'string', 'max:40'],
            'children.*.image' => ['nullable', 'string', 'max:500'],
            'children.*.is_true' => ['nullable', 'boolean'],
            'children.*.settings' => ['nullable', 'array'],
            'children.*.answers' => ['nullable', 'array', 'max:8'],
            'children.*.answers.*.content' => ['required_with:children.*.answers', 'string'],
            'children.*.answers.*.is_correct' => ['nullable', 'boolean'],
        ]);

        // Semantic checks the form also shows, enforced here so API clients cannot skip them
        $check = function (array $q, string $label) {
            $type = $q['type'];
            $answers = collect($q['answers'] ?? [])->filter(fn ($a) => trim((string) ($a['content'] ?? '')) !== '');
            if (in_array($type, ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'], true)) {
                if ($answers->count() < 2) {
                    throw ValidationException::withMessages(['answers' => "$label: trắc nghiệm cần ít nhất 2 đáp án."]);
                }
                if ($answers->where('is_correct', true)->count() < 1) {
                    throw ValidationException::withMessages(['answers' => "$label: cần đánh dấu ít nhất 1 đáp án đúng."]);
                }
            }
            if ($type === 'TRUE_FALSE' && !array_key_exists('is_true', $q)) {
                throw ValidationException::withMessages(['is_true' => "$label: chọn Đúng hoặc Sai."]);
            }
            if ($type === 'MULTIPLE_FILL_IN_BLANK') {
                $blanks = $q['settings']['blanks'] ?? [];
                preg_match_all('/\[(\d+)\]/', $q['content'], $m);
                $used = collect($m[1])->unique()->count();
                if ($used < 1) {
                    throw ValidationException::withMessages(['content' => "$label: dùng [1], [2]… trong nội dung để tạo ô trống."]);
                }
                if (count($blanks) < $used) {
                    throw ValidationException::withMessages(['settings' => "$label: nhập đáp án cho đủ $used ô trống."]);
                }
            }
        };

        $store = function (array $q, ?int $parentId, int $order, ?ClassicalQuestion $existing = null) use ($qs) {
            $type = $q['type'];
            $attrs = [
                'type' => $type,
                'content' => $q['content'],
                'explanation' => $q['explanation'] ?? null,
                'points' => $type === 'GROUP_QUESTION' ? 0 : ($q['points'] ?? 1),
                'difficulty' => $q['difficulty'] ?? 'MEDIUM',
                'skill' => $q['skill'] ?? null,
                'image' => $q['image'] ?? null,
                'is_true' => $type === 'TRUE_FALSE' ? (bool) ($q['is_true'] ?? false) : null,
                'settings' => \App\Support\QuestionSettings::sanitize($type, $q['settings'] ?? []),
            ];

            if ($existing) {
                $existing->update($attrs);
                $question = $existing;
            } else {
                $question = ClassicalQuestion::create([
                    ...$attrs,
                    'question_set_id' => $qs->id,
                    'parent_id' => $parentId,
                    'order' => $order,
                    'created_by' => Auth::id(),
                ]);
            }

            $question->answers()->delete();
            if (in_array($type, ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'], true)) {
                $answers = collect($q['answers'] ?? [])->filter(fn ($a) => trim((string) ($a['content'] ?? '')) !== '')->values();
                // one correct answer => radio, several => checkboxes
                if ($answers->where('is_correct', true)->count() > 1 && $type === 'SINGLE_CHOICE') {
                    $question->update(['type' => 'MULTIPLE_CHOICE']);
                }
                foreach ($answers as $i => $a) {
                    ClassicalQuestionAnswer::create([
                        'classical_question_id' => $question->id,
                        'content' => $a['content'],
                        'is_correct' => !empty($a['is_correct']),
                        'order' => $i + 1,
                    ]);
                }
            }

            return $question;
        };

        DB::transaction(function () use ($validated, $qs, $store, $check) {
            $check($validated, 'Câu hỏi');

            $existing = !empty($validated['id'])
                ? ClassicalQuestion::where('question_set_id', $qs->id)->findOrFail($validated['id'])
                : null;
            $parentId = $validated['parent_id'] ?? null;
            if ($parentId) {
                abort_unless(ClassicalQuestion::where('question_set_id', $qs->id)->whereKey($parentId)->where('type', 'GROUP_QUESTION')->exists(), 422, 'Câu cha phải là câu hỏi nhóm.');
            }
            if ($validated['type'] === 'GROUP_QUESTION' && $parentId) {
                abort(422, 'Không lồng nhóm trong nhóm.');
            }

            $order = $existing?->order
                ?? ((ClassicalQuestion::where('question_set_id', $qs->id)->where('parent_id', $parentId)->max('order') ?? 0) + 1);
            $question = $store($validated, $parentId, $order, $existing);

            // Children submitted together with a group (used by "Nhân bản" and imports)
            if ($validated['type'] === 'GROUP_QUESTION' && !empty($validated['children'])) {
                foreach ($validated['children'] as $i => $child) {
                    $child['difficulty'] = $child['difficulty'] ?? 'MEDIUM';
                    $check($child, 'Câu con ' . ($i + 1));
                    $store($child, $question->id, $i + 1);
                }
            }
        });

        return redirect()->back();
    });

    // Ảnh / âm thanh minh họa cho câu hỏi (ảnh câu hỏi, audio & hình của câu hỏi nhóm)
    Route::post('/admin/question-media', function (Request $request) {
        $request->validate([
            'file' => ['required', 'file', 'max:20480', 'mimes:jpg,jpeg,png,webp,gif,mp3,wav,ogg,m4a,aac'],
        ]);
        $org = app(TenantContext::class)->id();
        $path = $request->file('file')->store("question-media/{$org}", 'public');

        return response()->json(['url' => \Illuminate\Support\Facades\Storage::disk('public')->url($path)]);
    });

    Route::post('/admin/classical-questions/{id}/delete', function ($id) {
        $q = ClassicalQuestion::with('questionSet')->findOrFail($id);
        app(TenantContext::class)->enforceOwnership($q->questionSet);
        $q->delete();
        return redirect()->back();
    });

    // 4.8 PROGRAMMING PROBLEM AUTHORING (LEETCODE / HACKERRANK STYLE)
    Route::post('/admin/question-sets/{id}/programming-problems', function (Request $request, $id) {
        $qs = QuestionSet::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($qs);
        $validated = $request->validate([
            'id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'difficulty' => ['required', 'in:EASY,MEDIUM,HARD,EXPERT'],
            'time_limit_ms' => ['required', 'integer', 'min:100', 'max:10000'],
            'memory_limit_mb' => ['required', 'integer', 'min:16', 'max:1024'],
            'allowed_languages' => ['nullable', 'array'],
            'starter_templates' => ['nullable', 'array'],
            'test_cases' => ['nullable', 'array'],
        ]);

        $probId = $validated['id'] ?? null;
        if ($probId) {
            $problem = ProgrammingProblem::where('question_set_id', $qs->id)->findOrFail($probId);
            $problem->update([
                'title' => $validated['title'],
                'description' => $validated['description'],
                'difficulty' => $validated['difficulty'],
                'time_limit_ms' => $validated['time_limit_ms'],
                'memory_limit_mb' => $validated['memory_limit_mb'],
                'allowed_languages' => $validated['allowed_languages'] ?? ['cpp', 'python'],
                'starter_templates' => $validated['starter_templates'] ?? [
                    'cpp' => "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}",
                    'python' => "def solve():\n    pass",
                ],
            ]);
        } else {
            $maxOrder = ProgrammingProblem::where('question_set_id', $qs->id)->max('order') ?? 0;
            $problem = ProgrammingProblem::create([
                'question_set_id' => $qs->id,
                'title' => $validated['title'],
                'description' => $validated['description'],
                'difficulty' => $validated['difficulty'],
                'time_limit_ms' => $validated['time_limit_ms'],
                'memory_limit_mb' => $validated['memory_limit_mb'],
                'allowed_languages' => $validated['allowed_languages'] ?? ['cpp', 'python'],
                'starter_templates' => $validated['starter_templates'] ?? [
                    'cpp' => "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}",
                    'python' => "def solve():\n    pass",
                ],
                'order' => $maxOrder + 1,
            ]);
        }

        // Sync test cases
        if (isset($validated['test_cases']) && is_array($validated['test_cases'])) {
            $problem->testCases()->delete();
            foreach ($validated['test_cases'] as $tc) {
                if (isset($tc['input_data']) && isset($tc['expected_output'])) {
                    TestCase::create([
                        'programming_problem_id' => $problem->id,
                        'input_data' => $tc['input_data'],
                        'expected_output' => $tc['expected_output'],
                        'is_sample' => !empty($tc['is_sample']),
                        'score_weight' => $tc['score_weight'] ?? 5.0,
                    ]);
                }
            }
        }

        return redirect()->back();
    });

    Route::post('/admin/programming-problems/{id}/delete', function ($id) {
        $p = ProgrammingProblem::with('questionSet')->findOrFail($id);
        abort_unless($p->questionSet, 404);
        app(TenantContext::class)->enforceOwnership($p->questionSet);
        $p->delete();
        return redirect()->back();
    });

    // 4.8b PROGRAMMING PROBLEM EDITOR PAGE (FoxyExam Screens v2 · Soạn bài lập trình)
    $renderProblemEditor = function ($setId, $problemId = null) use ($getAdminCommonData) {
        $qs = QuestionSet::with('course:id,name,code')->findOrFail($setId);
        app(TenantContext::class)->enforceOwnership($qs);
        abort_if($qs->type !== 'PROGRAMMING', 404);
        [$userData, $teams] = $getAdminCommonData();

        $problem = $problemId
            ? ProgrammingProblem::where('question_set_id', $qs->id)->with(['testCases' => fn ($q) => $q->orderBy('id')])->findOrFail($problemId)
            : null;

        return Inertia::render('Admin/Problems/Editor', [
            'user' => $userData,
            'teams' => $teams,
            'questionSet' => [
                'id' => $qs->id,
                'name' => $qs->name,
                'code' => $qs->code,
                'course_name' => $qs->course?->name,
            ],
            'problem' => $problem ? [
                'id' => $problem->id,
                'title' => $problem->title,
                'description' => $problem->description,
                'difficulty' => $problem->difficulty,
                'time_limit_ms' => $problem->time_limit_ms,
                'memory_limit_mb' => $problem->memory_limit_mb,
                'allowed_languages' => $problem->allowed_languages ?? ['cpp', 'python'],
                'starter_templates' => $problem->starter_templates ?? (object) [],
                'updated_at' => $problem->updated_at?->toIso8601String(),
                'test_cases' => $problem->testCases->map(fn ($tc) => [
                    'id' => $tc->id,
                    'input_data' => $tc->input_data,
                    'expected_output' => $tc->expected_output,
                    'is_sample' => (bool) $tc->is_sample,
                    'score_weight' => (float) $tc->score_weight,
                ]),
            ] : null,
        ]);
    };

    Route::get('/admin/question-sets/{id}/problems/new', fn ($id) => $renderProblemEditor($id))->whereNumber('id');
    Route::get('/admin/question-sets/{id}/problems/{problemId}', fn ($id, $problemId) => $renderProblemEditor($id, $problemId))
        ->whereNumber(['id', 'problemId']);

    // 4.9 IMPORT QUESTIONS / PROBLEMS INTO QUESTION SET
    Route::post('/admin/question-sets/{id}/import-questions', function (Request $request, $id) {
        $qs = QuestionSet::findOrFail($id);
        app(TenantContext::class)->enforceOwnership($qs);
        $validated = $request->validate([
            'selected_ids' => ['required', 'array', 'min:1'],
            'selected_ids.*' => ['integer'],
        ]);

        $ids = $validated['selected_ids'];

        if ($qs->type === 'CLASSICAL') {
            $sourceQuestions = ClassicalQuestion::whereIn('id', $ids)
                ->whereHas('questionSet', fn ($w) => $w->where('organization_id', $qs->organization_id))
                ->whereNull('parent_id')
                ->with(['answers', 'children.answers'])
                ->get();

            $currentMaxOrder = ClassicalQuestion::where('question_set_id', $qs->id)
                ->whereNull('parent_id')
                ->max('order') ?? 0;

            foreach ($sourceQuestions as $src) {
                $currentMaxOrder++;
                $newQ = ClassicalQuestion::create([
                    'question_set_id' => $qs->id,
                    'parent_id' => null,
                    'type' => $src->type,
                    'content' => $src->content,
                    'explanation' => $src->explanation,
                    'is_true' => $src->is_true,
                    'settings' => $src->settings,
                    'skill' => $src->skill,
                    'image' => $src->image,
                    'points' => $src->points,
                    'difficulty' => $src->difficulty,
                    'order' => $currentMaxOrder,
                    'created_by' => Auth::id(),
                ]);

                foreach ($src->answers as $a) {
                    ClassicalQuestionAnswer::create([
                        'classical_question_id' => $newQ->id,
                        'content' => $a->content,
                        'is_correct' => $a->is_correct,
                        'order' => $a->order,
                    ]);
                }

                // If group question, clone children
                foreach ($src->children as $cIdx => $child) {
                    $newChild = ClassicalQuestion::create([
                        'question_set_id' => $qs->id,
                        'parent_id' => $newQ->id,
                        'type' => $child->type,
                        'content' => $child->content,
                        'explanation' => $child->explanation,
                        'is_true' => $child->is_true,
                        'settings' => $child->settings,
                        'skill' => $child->skill,
                        'image' => $child->image,
                        'points' => $child->points,
                        'difficulty' => $child->difficulty,
                        'order' => $cIdx + 1,
                        'created_by' => Auth::id(),
                    ]);

                    foreach ($child->answers as $ca) {
                        ClassicalQuestionAnswer::create([
                            'classical_question_id' => $newChild->id,
                            'content' => $ca->content,
                            'is_correct' => $ca->is_correct,
                            'order' => $ca->order,
                        ]);
                    }
                }
            }
        } else {
            $sourceProblems = ProgrammingProblem::whereIn('id', $ids)
                ->whereHas('questionSet', fn ($w) => $w->where('organization_id', $qs->organization_id))
                ->with('testCases')
                ->get();

            $currentMaxOrder = ProgrammingProblem::where('question_set_id', $qs->id)->max('order') ?? 0;

            foreach ($sourceProblems as $srcProb) {
                $currentMaxOrder++;
                $newProb = ProgrammingProblem::create([
                    'question_set_id' => $qs->id,
                    'title' => $srcProb->title,
                    'description' => $srcProb->description,
                    'difficulty' => $srcProb->difficulty,
                    'time_limit_ms' => $srcProb->time_limit_ms,
                    'memory_limit_mb' => $srcProb->memory_limit_mb,
                    'allowed_languages' => $srcProb->allowed_languages,
                    'starter_templates' => $srcProb->starter_templates,
                    'order' => $currentMaxOrder,
                ]);

                foreach ($srcProb->testCases as $tc) {
                    TestCase::create([
                        'programming_problem_id' => $newProb->id,
                        'input_data' => $tc->input_data,
                        'expected_output' => $tc->expected_output,
                        'is_sample' => $tc->is_sample,
                        'score_weight' => $tc->score_weight,
                    ]);
                }
            }
        }

        return redirect()->back();
    });
});

// 4.10 PROCTORING — Giám sát trực tiếp, Phiên thi & vi phạm, Xem bài làm (FoxyExam Screens v2)
Route::middleware(['auth'])->prefix('admin')->group(function () {
    Route::get('/live', [\App\Http\Controllers\Admin\MonitoringController::class, 'index']);
    Route::get('/exams/{id}/live', [\App\Http\Controllers\Admin\MonitoringController::class, 'show'])->whereNumber('id');
    Route::post('/exams/{id}/end', [\App\Http\Controllers\Admin\MonitoringController::class, 'end'])->whereNumber('id');
    Route::get('/exams/{id}/realtime', [\App\Http\Controllers\Admin\MonitoringController::class, 'realtime'])->whereNumber('id');
    Route::get('/exams/{id}/violations', [\App\Http\Controllers\Admin\MonitoringController::class, 'violationsPage'])->whereNumber('id');
    Route::get('/exams/{id}/live-video', [\App\Http\Controllers\Admin\MonitoringController::class, 'liveVideo'])->whereNumber('id');
    Route::post('/attempts/{id}/force-end', [\App\Http\Controllers\Admin\MonitoringController::class, 'forceEndAttempt'])->whereNumber('id');
    Route::get('/attempts/{id}', [\App\Http\Controllers\Admin\MonitoringController::class, 'attempt'])->whereNumber('id');
    Route::get('/attempts/{id}/submissions', [\App\Http\Controllers\Admin\MonitoringController::class, 'submissions'])->whereNumber('id');
    Route::post('/violations/bulk-review', [\App\Http\Controllers\Admin\MonitoringController::class, 'bulkReview']);
    Route::post('/attempts/{id}/void', [\App\Http\Controllers\Admin\MonitoringController::class, 'voidAttempt'])->whereNumber('id');
    Route::post('/violations/{id}/review', [\App\Http\Controllers\Admin\MonitoringController::class, 'review'])->whereNumber('id');
});

// 5. Lecturer portal: /lecturer/* is an alias of /admin/* (see PortalAlias / PortalRole); teachers only see the academic pages
