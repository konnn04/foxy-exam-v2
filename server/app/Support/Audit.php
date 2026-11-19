<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\TenantContext;
use Illuminate\Support\Facades\Auth;

/**
 * Records who did what. Never throws: a failed log line must not undo or block the action it describes.
 * Never put secrets or personal data of third parties in $meta (names of fields that changed are enough).
 */
final class Audit
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public static function record(string $action, ?string $summary = null, ?string $targetType = null, int|string|null $targetId = null, array $meta = [], ?User $actor = null): void
    {
        try {
            $actor ??= Auth::user();
            $orgId = null;
            if ($actor) {
                try {
                    $orgId = app(TenantContext::class)->current()->id;
                } catch (\Throwable) {
                    $orgId = $actor->organization_id;
                }
            }

            AuditLog::create([
                'user_id' => $actor?->id,
                'user_name' => $actor ? mb_substr($actor->name ?: $actor->username, 0, 160) : null,
                'organization_id' => $orgId,
                'action' => $action,
                'target_type' => $targetType,
                'target_id' => $targetId !== null ? (string) $targetId : null,
                'summary' => $summary !== null ? mb_substr($summary, 0, 255) : null,
                'meta' => $meta ?: null,
                'ip' => request()?->ip(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
