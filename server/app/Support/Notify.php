<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserNotification;

/** Writes in-app notifications. Never throws: a failed notification must not break the action that caused it. */
final class Notify
{
    /**
     * @param  string|null  $key  i18n key (e.g. "graded"); clients translate "notif.{key}.title" / ".body" with $params and fall back to $title / $body
     * @param  array<string, scalar>  $params  values for the placeholders of the translation
     */
    public static function to(User|int $user, string $type, string $title, ?string $body = null, ?string $url = null, ?string $key = null, array $params = []): void
    {
        try {
            UserNotification::create([
                'user_id' => $user instanceof User ? $user->id : $user,
                'type' => $type,
                'key' => $key,
                'params' => $params ?: null,
                'title' => mb_substr($title, 0, 160),
                'body' => $body !== null ? mb_substr($body, 0, 500) : null,
                'url' => $url,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** Every admin and teacher of an organization. */
    public static function staff(int $organizationId, string $type, string $title, ?string $body = null, ?string $url = null, ?string $key = null, array $params = []): void
    {
        User::where('organization_id', $organizationId)->whereIn('role', ['ORG_ADMIN', 'TEACHER'])->pluck('id')
            ->each(fn ($id) => self::to($id, $type, $title, $body, $url, $key, $params));
    }
}
