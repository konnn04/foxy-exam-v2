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

        // Password guessing is limited per ACCOUNT, not only per IP: a whole exam room signs in from one school address,
        // so the gateway's per-IP limit has to stay generous.
        //  - every name field the login code may authenticate with (login, username, email) gets a bucket, so the
        //    limiter and the authenticator cannot disagree on which account is being tried;
        //  - the bucket is scoped by the organization the code RESOLVES to (unknown / varied codes all fall into "none"),
        //    so another school's student with the same name is not affected, and changing the code does not reset it;
        //  - 10/min per (IP, account) stops guessing, while the global per-account limit is softer (30/min) so someone
        //    elsewhere cannot lock a candidate out of the exam with a few wrong passwords.
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            $norm = fn ($v) => mb_strtolower(trim(is_scalar($v) ? (string) $v : ''));
            $code = strtoupper(trim((string) ($request->input('org_code') ?? $request->input('organization_code') ?? '')));
            $org = $code === '' ? 'none' : \Illuminate\Support\Facades\Cache::remember(
                'login-org:' . hash('sha256', $code),
                300,
                fn () => (string) (\App\Models\Organization::where('code', $code)->value('id') ?? 'none'),
            );
            $ip = (string) $request->ip();
            $limits = [\Illuminate\Cache\RateLimiting\Limit::perMinute(120)->by('login-ip:' . $ip)];
            $names = array_unique(array_filter([$norm($request->input('login')), $norm($request->input('username')), $norm($request->input('email'))]));
            foreach ($names as $name) {
                $account = hash('sha256', $org . '|' . $name);
                $limits[] = \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by('login-acct-ip:' . $account . '|' . $ip);
                $limits[] = \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by('login-acct:' . $account);
            }

            return $limits;
        });

        \Illuminate\Support\Facades\Gate::define('viewApiDocs', function ($user = null) {
            return true;
        });
    }
}
