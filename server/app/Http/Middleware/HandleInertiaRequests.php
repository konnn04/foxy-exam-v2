<?php

namespace App\Http\Middleware;

use App\Services\TenantContext;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /** The address bar keeps showing /lecturer even though the request was served by the /admin twin. */
    public function urlResolver()
    {
        return function (Request $request) {
            $original = $request->attributes->get('portal_original_uri');

            return $original ?: \Illuminate\Support\Str::start(\Illuminate\Support\Str::after($request->fullUrl(), $request->getSchemeAndHttpHost()), '/');
        };
    }

    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $tenantContext = app(TenantContext::class);
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'role' => $user->role,
                    'avatar' => $user->avatar,
                    'organization' => $user->organization ? [
                        'id' => $user->organization->id,
                        'name' => $user->organization->name,
                        'code' => $user->organization->code,
                    ] : null,
                ] : null,
            ],
            'tenant' => $user ? $tenantContext->toInertiaArray() : null,
            // Sidebar badge ("Phiên thi & vi phạm"): unreviewed violations of the ACTIVE organization.
            // Never computed in the platform (ROOT) context where proctoring does not exist.
            'navCounts' => fn () => $user && $tenantContext->capabilities()['academic'] ? [
                'pendingViolations' => \App\Models\Violation::where('is_reviewed', false)
                    ->where('is_false_positive', false)
                    ->whereHas('attempt.exam', fn ($e) => $e->where('organization_id', $tenantContext->current()->id))
                    ->count(),
            ] : null,
            // One-shot messages: surfaced as toasts by the global dialog provider
            'portal' => fn () => PortalRole::home($request->user()?->role),
            'flash' => fn () => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
        ];
    }
}
