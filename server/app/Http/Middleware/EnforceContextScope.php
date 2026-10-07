<?php

namespace App\Http\Middleware;

use App\Services\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Server-side authority on "what can this user do in the organization they are viewing".
 *
 * A Super Admin who switches into a school behaves exactly like that school's Org Admin;
 * in the ROOT (platform) context only organizations / plans / root accounts exist.
 * The UI mirrors this via TenantContext::capabilities(), but nothing relies on the UI hiding links.
 */
class EnforceContextScope
{
    /** First path segment under /admin  =>  required capability. */
    private const RULES = [
        'organizations' => 'organizations',
        'plans' => 'managePlans',
        'invoices' => 'billing',
        'billing' => 'billing',
        'users' => 'users',
        'switcher' => 'switchOrganization',
        'switch-organization' => 'switchOrganization',
        'saas-plans' => '*plans-or-quota',
        'settings' => 'orgSettings',
        'organization' => 'orgSettings',          // POST /admin/organization/settings
        // everything below is tenant-only (courses, exams, banks, monitoring, reports)
        'overview' => 'academic',
        'courses' => 'academic',
        'exams' => 'academic',
        'question-sets' => 'academic',
        'problem-banks' => 'academic',
        'problems' => 'academic',
        'classical-questions' => 'academic',
        'programming-problems' => 'academic',
        'live' => 'academic',
        'attempts' => 'academic',
        'violations' => 'academic',
        'reports' => 'academic',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if (!Auth::check()) {
            return $next($request);
        }

        $segments = $request->segments();
        $isLecturerPath = ($segments[0] ?? '') === 'lecturer';
        if (($segments[0] ?? '') !== 'admin' && !$isLecturerPath) {
            return $next($request);
        }

        $tenant = app(TenantContext::class);
        $can = $tenant->capabilities();

        // Students take exams in FoxyClient; the admin portal has nothing for them (and redirecting would loop)
        abort_unless(in_array(Auth::user()->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403, 'Tài khoản thí sinh không dùng cổng quản trị. Hãy đăng nhập bằng ứng dụng FoxyClient.');

        // /admin (overview) and /lecturer: platform goes to organizations, everyone else stays
        $section = $isLecturerPath ? 'overview' : ($segments[1] ?? 'overview');
        $rule = self::RULES[$section] ?? null;

        if ($rule === null) {
            return $next($request);
        }

        $allowed = $rule === '*plans-or-quota'
            ? ($can['managePlans'] || $can['quota'])
            : (bool) ($can[$rule] ?? false);

        // Mutations of platform plans are also guarded again by checkIsRootAdmin.
        if ($allowed) {
            return $next($request);
        }

        if ($request->isMethod('GET') && !$request->expectsJson()) {
            // Land on the first page that makes sense for the active context
            return redirect($tenant->inPlatformContext() ? '/admin/organizations' : '/admin');
        }

        abort(403, $tenant->inPlatformContext()
            ? 'Trang này thuộc về từng tổ chức. Hãy chuyển sang tổ chức tương ứng để dùng.'
            : 'Bạn không có quyền truy cập chức năng này trong tổ chức hiện tại.');
    }
}
