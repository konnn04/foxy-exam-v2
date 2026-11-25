<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Password attempts counted per resolved account AND per caller IP, at the point where the login code has found the
 * user:
 *  - the key is the user id, so changing the organization / exam code or the name field does not reset it, and a
 *    student of another school with the same name is unaffected;
 *  - it is also the caller's IP, so somebody elsewhere typing wrong passwords cannot lock the candidate out of the
 *    exam (the room's shared address is still separate from an attacker's);
 *  - the attempt is counted BEFORE the password is checked (one atomic increment), so parallel requests cannot all
 *    slip under the limit; a correct password clears the count;
 *  - while over the limit the answer is the same 401 as a wrong password: no "this account exists and is locked".
 */
final class LoginGuard
{
    public const MAX_ATTEMPTS = 10;
    public const WINDOW_SECONDS = 300;

    private static function key(User $user, string $ip): string
    {
        return 'login-attempts:' . $user->id . '|' . $ip;
    }

    /** Counts this attempt; false when the caller already used up its attempts for this account. */
    public static function attempt(User $user, string $ip): bool
    {
        return RateLimiter::hit(self::key($user, $ip), self::WINDOW_SECONDS) <= self::MAX_ATTEMPTS;
    }

    public static function succeeded(User $user, string $ip): void
    {
        RateLimiter::clear(self::key($user, $ip));
    }
}
