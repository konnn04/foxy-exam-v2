<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserNotification;

/** Writes in-app notifications. Never throws: a failed notification must not break the action that caused it. */
final class Notify
{
    public static function to(User|int $user, string $type, string $title, ?string $body = null, ?string $url = null): void
    {
        try {
            UserNotification::create([
                'user_id' => $user instanceof User ? $user->id : $user,
                'type' => $type,
                'title' => mb_substr($title, 0, 160),
                'body' => $body !== null ? mb_substr($body, 0, 500) : null,
                'url' => $url,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** Every admin and teacher of an organization. */
    public static function staff(int $organizationId, string $type, string $title, ?string $body = null, ?string $url = null): void
    {
        User::where('organization_id', $organizationId)->whereIn('role', ['ORG_ADMIN', 'TEACHER'])->pluck('id')
            ->each(fn ($id) => self::to($id, $type, $title, $body, $url));
    }
}
