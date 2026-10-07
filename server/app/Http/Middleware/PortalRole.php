<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the address bar honest about who is logged in: lecturers live on /lecturer, everyone else on /admin.
 * Both URLs render the same portal (see PortalAlias); this only normalises page navigations.
 */
class PortalRole
{
    public static function home(?string $role): string
    {
        return $role === 'TEACHER' ? '/lecturer' : '/admin';
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();
        if (!$user || !$request->isMethod('GET') || $request->expectsJson()) {
            return $next($request);
        }

        $isLecturerUrl = $request->attributes->get('portal') === 'lecturer';
        $isAdminUrl = $request->segment(1) === 'admin' && !$isLecturerUrl;

        if ($user->role === 'TEACHER' && $isAdminUrl) {
            return redirect(PortalAlias::toLecturer($request->getRequestUri()));
        }
        if ($user->role !== 'TEACHER' && $isLecturerUrl) {
            // the request URI was rewritten to the /admin twin already
            return redirect($request->getRequestUri());
        }

        return $next($request);
    }
}
