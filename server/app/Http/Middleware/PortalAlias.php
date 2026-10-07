<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Two URLs, one portal: /lecturer/* is served by exactly the same routes as /admin/*, so a lecturer
 * sees /lecturer in the address bar while an admin sees /admin. Authorization never depends on the URL —
 * EnforceContextScope and the controllers decide from the user's role and the active organization.
 *
 * Runs as GLOBAL middleware (before routing): the request is rewritten to its /admin twin and tagged,
 * and redirects produced for it are mapped back so the lecturer never "falls out" into /admin.
 */
class PortalAlias
{
    public const LECTURER = '/lecturer';

    public function handle(Request $request, Closure $next): Response
    {
        $path = $request->getPathInfo();
        if ($path !== self::LECTURER && !str_starts_with($path, self::LECTURER . '/')) {
            return $next($request);
        }

        $original = $request->getRequestUri();
        $server = $request->server->all();
        $server['REQUEST_URI'] = '/admin' . substr($original, strlen(self::LECTURER));
        $request->server->replace($server);
        // drop Symfony's cached path info / request uri so routing sees the twin path
        $request->initialize(
            $request->query->all(), $request->request->all(), $request->attributes->all(),
            $request->cookies->all(), $request->files->all(), $server, $request->getContent(),
        );
        $request->attributes->set('portal', 'lecturer');
        $request->attributes->set('portal_original_uri', $original);

        $response = $next($request);

        // only lecturers live on /lecturer; anyone else is being sent to their own portal (see PortalRole)
        if ($response instanceof RedirectResponse && $request->user()?->role === 'TEACHER') {
            $response->setTargetUrl(self::toLecturer($response->getTargetUrl()));
        }

        return $response;
    }

    /** /admin/... → /lecturer/... for same-host URLs. */
    public static function toLecturer(string $url): string
    {
        return preg_replace('#^((?:https?://[^/]+)?)/admin(?=$|[/?\#])#', '$1/lecturer', $url) ?? $url;
    }
}
