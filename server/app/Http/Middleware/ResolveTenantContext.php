<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use App\Services\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenantContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantContext = app(TenantContext::class);

        if (Auth::check()) {
            $user = Auth::user()->loadMissing('organization.activeSubscription.plan');

            if ($user->role !== 'SUPER_ADMIN') {
                // Non-super-admins are strictly and immutably bound to their own organization
                $org = $user->organization;
            } else {
                // Super Admin can switch organization scope
                $scopedOrgId = null;

                // The active organization is kept server-side (session + encrypted cookie).
                // Only an explicit GET ?org_id= (deep links) or POST /admin/switch-organization changes it.
                if ($request->isMethod('GET') && $request->query('org_id') !== null) {
                    $scopedOrgId = (int) $request->query('org_id');
                    session(['foxy_active_org_id' => $scopedOrgId]);
                    cookie()->queue('foxy_active_org_id', (string) $scopedOrgId, 60 * 24 * 30);
                } elseif (session()->has('foxy_active_org_id')) {
                    $scopedOrgId = (int) session('foxy_active_org_id');
                } elseif ($request->hasCookie('foxy_active_org_id')) {
                    // Laravel decrypts this cookie; a forged/plain one fails to decrypt and arrives as null
                    $scopedOrgId = (int) $request->cookie('foxy_active_org_id');
                }

                $org = null;
                if ($scopedOrgId) {
                    $org = Organization::with('activeSubscription.plan')->find($scopedOrgId);
                }

                if (!$org) {
                    $org = Organization::with('activeSubscription.plan')->where('code', 'ROOT')->first() 
                        ?? $user->organization;
                }
            }

            $tenantContext->set($org);
        }

        return $next($request);
    }
}
