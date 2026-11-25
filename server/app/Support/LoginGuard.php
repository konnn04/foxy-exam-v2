<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Wrong passwords counted per RESOLVED account (user id), at the point where the login code has found the user.
 * Nothing the caller sends (organization code, exam code, which name field) changes the key, and a student of another
 * school with the same name is a different id. Only failures count; a correct password clears the counter.
 */
final class LoginGuard
{
    public const MAX_FAILURES = 20;
    public const WINDOW_SECONDS = 300;

    private static function key(User $user): string
    {
        return 'login-failures:' . $user->id;
    }

    public static function locked(User $user): bool
    {
        return RateLimiter::tooManyAttempts(self::key($user), self::MAX_FAILURES);
    }

    public static function retryAfter(User $user): int
    {
        return RateLimiter::availableIn(self::key($user));
    }

    public static function failed(User $user): void
    {
        RateLimiter::hit(self::key($user), self::WINDOW_SECONDS);
    }

    public static function succeeded(User $user): void
    {
        RateLimiter::clear(self::key($user));
    }
}
