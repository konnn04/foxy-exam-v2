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
 *  - a much higher account-wide cap (100 per 15 min) stops a distributed guess from many addresses;
 *  - the attempt is counted BEFORE the password is checked (one atomic increment), so parallel requests cannot all
 *    slip under the limit; a correct password clears the count;
 *  - while over the limit the answer is the same 401 as a wrong password: no "this account exists and is locked".
 */
final class LoginGuard
{
    /** per (account, caller): the brute-force brake */
    public const MAX_ATTEMPTS = 10;
    /** per account, whatever the caller: only a distributed attack reaches it (it would lock the account; same 401) */
    public const MAX_ACCOUNT_ATTEMPTS = 100;
    public const WINDOW_SECONDS = 300;
    public const ACCOUNT_WINDOW_SECONDS = 900;

    /** IPv4 as is; IPv6 cut to its /64 (one home / one machine usually owns a whole /64). */
    public static function caller(string $ip): string
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $bin = inet_pton($ip);

            return $bin === false ? $ip : bin2hex(substr($bin, 0, 8)) . '::/64';
        }

        return $ip;
    }

    /** Counts this attempt (before the password is checked); false when this caller or the account is over its limit. */
    public static function attempt(User $user, string $ip): bool
    {
        $perCaller = RateLimiter::hit('login-attempts:' . $user->id . '|' . self::caller($ip), self::WINDOW_SECONDS);
        if ($perCaller > self::MAX_ATTEMPTS) {
            return false; // a caller over its own limit no longer feeds the account-wide count (one address cannot lock it)
        }
        $perAccount = RateLimiter::hit('login-attempts:' . $user->id, self::ACCOUNT_WINDOW_SECONDS);

        // a hard cap: switching addresses must never buy more guesses. A candidate caught by a distributed attack is
        // unlocked by an administrator (php artisan foxy:unlock-login), or waits ACCOUNT_WINDOW_SECONDS.
        return $perAccount <= self::MAX_ACCOUNT_ATTEMPTS;
    }

    /** Administrator action: lift the account-wide lock (per-caller counts expire on their own within minutes). */
    public static function unlock(User $user): void
    {
        RateLimiter::clear('login-attempts:' . $user->id);
    }

    /** A correct password clears this caller's count; the account-wide count only decays (it is about other callers). */
    public static function succeeded(User $user, string $ip): void
    {
        RateLimiter::clear('login-attempts:' . $user->id . '|' . self::caller($ip));
    }
}
