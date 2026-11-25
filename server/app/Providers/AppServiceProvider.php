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
        // so the gateway's per-IP limit has to stay generous.
        //  - every name field the login code may authenticate with (login, username, email) gets a bucket, so the
        //    limiter and the authenticator cannot disagree on which account is being tried;
        //  - the key is built from the name only: the organization / exam code is resolved differently by each login
        //    path, so any part of it in the key would let a caller reset the count by changing it;
        //  - 10/min per (IP, name) stops guessing; the per-name cap for everyone is softer (30/min) so a few wrong
        //    passwords sent from elsewhere cannot lock a candidate out. Same name in two schools shares that cap.
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            $norm = fn ($v) => mb_strtolower(trim(is_scalar($v) ? (string) $v : ''));
            $ip = (string) $request->ip();
            $limits = [\Illuminate\Cache\RateLimiting\Limit::perMinute(120)->by('login-ip:' . $ip)];
            $names = array_unique(array_filter([$norm($request->input('login')), $norm($request->input('username')), $norm($request->input('email'))]));
            foreach ($names as $name) {
                $who = hash('sha256', $name);
                $limits[] = \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by('login-name-ip:' . $who . '|' . $ip);
                $limits[] = \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by('login-name:' . $who);
            }

            return $limits;
        });

        \Illuminate\Support\Facades\Gate::define('viewApiDocs', function ($user = null) {
            return true;
        });
    }
}
