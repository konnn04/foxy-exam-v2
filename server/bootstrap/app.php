<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // behind Coolify/Traefik and the nginx gateway: trust X-Forwarded-* so URLs and secure cookies are https
        // Only the gateway / platform proxy may set X-Forwarded-For: with '*' any client could pick its own IP (and dodge
        // per-IP limits). Default = private ranges, where the gateway and Coolify's proxy live inside Docker.
        $middleware->trustProxies(at: array_values(array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', '127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'))))));
        $middleware->prepend(\App\Http\Middleware\PortalAlias::class);
        $middleware->web(append: [
            \App\Http\Middleware\PortalRole::class,
            \App\Http\Middleware\ResolveTenantContext::class,
            \App\Http\Middleware\EnforceContextScope::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \App\Http\Middleware\AuditAdminWrites::class,
        ]);
        $middleware->alias(['biometric' => \App\Http\Middleware\RequireBiometricConsent::class]);
        $middleware->validateCsrfTokens(except: [
            'oauth/token',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // no-op until SENTRY_LARAVEL_DSN is set
        \Sentry\Laravel\Integration::handles($exceptions);
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
