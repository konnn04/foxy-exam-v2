<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Organization switcher for Super Admins.
 * There can be thousands of organizations, so the list is searched server-side and paged.
 */
class OrganizationSwitchController extends Controller
{
    private const PAGE_SIZE = 15;

    private function guard(): void
    {
        abort_unless(Auth::user()?->role === 'SUPER_ADMIN', 403, 'Chỉ Super Admin mới có quyền chuyển tổ chức.');
    }

    private function payload(Organization $o): array
    {
        return [
            'id' => $o->id,
            'name' => $o->name,
            'code' => $o->code,
            'type' => $o->type,
            'status' => $o->status,
            'plan' => $o->activeSubscription?->plan?->name ?? 'FREE',
        ];
    }

    /** GET /admin/switcher/organizations?q=&page= */
    public function search(Request $request)
    {
        $this->guard();

        $q = trim((string) $request->query('q', ''));
        $like = '%' . addcslashes($q, '%_' . chr(92)) . '%';

        $page = Organization::with('activeSubscription.plan')
            ->where('code', '!=', 'ROOT')
            ->when($q !== '', fn ($query) => $query->where(
                fn ($w) => $w->where('name', 'like', $like)->orWhere('code', 'like', $like)
            ))
            ->orderBy('name')
            ->simplePaginate(self::PAGE_SIZE)
            ->withQueryString();

        return response()->json([
            'data' => $page->getCollection()->map(fn ($o) => $this->payload($o))->values(),
            'has_more' => $page->hasMorePages(),
            'root' => $this->payload(Organization::with('activeSubscription.plan')->where('code', 'ROOT')->firstOrFail()),
        ]);
    }

    /** POST /admin/switch-organization */
    public function switch(Request $request)
    {
        $this->guard();

        $validated = $request->validate([
            'org_id' => ['required', 'integer', 'exists:organizations,id'],
            'redirect_to' => ['nullable', 'string'],
        ]);

        $org = Organization::findOrFail((int) $validated['org_id']);
        app(TenantContext::class)->set($org);

        // Server-side + encrypted cookie: the active organization decides what the UI and routes offer
        $request->session()->put('foxy_active_org_id', $org->id);
        cookie()->queue('foxy_active_org_id', (string) $org->id, 60 * 24 * 30);

        $isRoot = $org->code === 'ROOT' || $org->id === 1;
        $segment = explode('/', trim((string) parse_url($validated['redirect_to'] ?? '', PHP_URL_PATH), '/'))[1] ?? '';
        $stays = $isRoot ? ['users', 'saas-plans'] : ['users', 'saas-plans', 'settings', 'courses', 'exams', 'live', 'reports', 'problem-banks'];

        return redirect(in_array($segment, $stays, true)
            ? '/admin/' . $segment
            : ($isRoot ? '/admin/organizations' : '/admin'));
    }
}
