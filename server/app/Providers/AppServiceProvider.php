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

        // Password guessing is limited per ACCOUNT NAME, not only per IP: a whole exam room signs in from one school address,
        // so the gateway's per-IP limit has to stay generous. Each name field the login code may authenticate with gets
        // its own bucket, and nothing else the client sends (organization code, casing, spaces) changes the key, so
        // varying those does not reset the count. The same name in two organizations shares a bucket: acceptable.
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            $norm = fn ($v) => mb_strtolower(trim(is_scalar($v) ? (string) $v : ''));
            $limits = [\Illuminate\Cache\RateLimiting\Limit::perMinute(120)->by('login-ip:' . $request->ip())];
            foreach (array_unique(array_filter([$norm($request->input('login')), $norm($request->input('username'))])) as $name) {
                $limits[] = \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by('login-name:' . hash('sha256', $name));
            }

            return $limits;
        });

        \Illuminate\Support\Facades\Gate::define('viewApiDocs', function ($user = null) {
            return true;
        });
    }
}
