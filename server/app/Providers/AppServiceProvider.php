<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(\App\Services\TenantContext::class, function () {
            return new \App\Services\TenantContext();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // addresses edited by the Root Admin override the .env defaults
        \App\Support\ServiceEndpoints::apply();

        // Password guessing is limited per ACCOUNT (organization + login), not only per IP: a whole exam room signs in
        // from one school address, so the gateway's per-IP limit has to stay generous.
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            $who = strtolower(trim((string) ($request->input('login') ?? $request->input('username') ?? '')));
            $org = strtoupper(trim((string) ($request->input('org_code') ?? $request->input('organization_code') ?? '')));

            return [
                \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by('login:' . $org . '|' . $who),
                \Illuminate\Cache\RateLimiting\Limit::perMinute(120)->by('login-ip:' . $request->ip()),
            ];
        });

        \Illuminate\Support\Facades\Gate::define('viewApiDocs', function ($user = null) {
            return true;
        });
    }
}
