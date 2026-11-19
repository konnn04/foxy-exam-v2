<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/** Read-only trail. A school admin sees only their own organization's lines; the platform sees everything. */
class AuditLogController extends Controller
{
    public const GROUPS = ['auth', 'org', 'user', 'site', 'lead', 'face', 'exam'];

    public function index(Request $request, TenantContext $tenant)
    {
        $user = Auth::user();
        abort_unless(in_array($user->role, ['SUPER_ADMIN', 'ORG_ADMIN'], true), 403);

        $platform = $tenant->inPlatformContext();
        $group = in_array($request->query('group'), self::GROUPS, true) ? $request->query('group') : null;
        $q = trim((string) $request->query('q', ''));
        $from = $request->query('from');
        $to = $request->query('to');

        $rows = AuditLog::query()
            ->when(!$platform, fn ($x) => $x->where('organization_id', $tenant->current()->id))
            ->when($group, fn ($x) => $x->where('action', 'like', "{$group}.%"))
            ->when($q !== '', fn ($x) => $x->where(fn ($w) => $w->where('summary', 'like', "%{$q}%")->orWhere('user_name', 'like', "%{$q}%")->orWhere('ip', 'like', "%{$q}%")))
            ->when($from, fn ($x) => $x->where('created_at', '>=', $from . ' 00:00:00'))
            ->when($to, fn ($x) => $x->where('created_at', '<=', $to . ' 23:59:59'))
            ->orderByDesc('id')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (AuditLog $a) => [
                'id' => $a->id, 'action' => $a->action, 'summary' => $a->summary, 'user' => $a->user_name,
                'target' => $a->target_type ? "{$a->target_type}#{$a->target_id}" : null, 'ip' => $a->ip,
                'at' => $a->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Audit/Index', [
            'user' => ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role],
            'teams' => [],
            'rows' => $rows,
            'filters' => ['group' => $group, 'q' => $q, 'from' => $from, 'to' => $to],
            'scope' => $platform ? 'platform' : 'organization',
        ]);
    }
}
