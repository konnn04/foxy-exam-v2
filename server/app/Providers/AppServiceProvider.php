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

        // Sign-in throttle, first line: per IP, and per (IP, name) for each name field the login code may use (login,
        // username, email). The per-ACCOUNT protection that cannot be reset by changing the organization / exam code,
        // and cannot hit another school's student with the same name, is in App\Support\LoginGuard (wrong passwords
        // counted per resolved user id). A whole exam room signs in from one school address, hence the generous IP limit.
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            $norm = fn ($v) => mb_strtolower(trim(is_scalar($v) ? (string) $v : ''));
            $ip = (string) $request->ip();
            $limits = [\Illuminate\Cache\RateLimiting\Limit::perMinute(120)->by('login-ip:' . $ip)];
            $names = array_unique(array_filter([$norm($request->input('login')), $norm($request->input('username')), $norm($request->input('email'))]));
            foreach ($names as $name) {
                $limits[] = \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by('login-name-ip:' . hash('sha256', $name) . '|' . $ip);
            }

            return $limits;
        });

        \Illuminate\Support\Facades\Gate::define('viewApiDocs', function ($user = null) {
            return true;
        });
    }
}
