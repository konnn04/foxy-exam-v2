<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class TenantContext
{
    protected ?Organization $current = null;

    /**
     * Set the current tenant organization.
     */
    public function set(Organization $organization): void
    {
        $this->current = $organization;
    }

    /**
     * Get the active organization model.
     */
    public function current(): Organization
    {
        if (!$this->current) {
            $user = Auth::user();
            if ($user && $user->organization) {
                $this->current = $user->organization;
            } else {
                $this->current = Organization::where('code', 'ROOT')->first() ?? Organization::first();
            }
        }
        return $this->current;
    }

    /**
     * Get the active organization ID.
     */
    public function id(): int
    {
        return $this->current()->id;
    }

    /**
     * Check if currently active in ROOT platform context.
     */
    public function isRoot(): bool
    {
        $org = $this->current();
        return $org->code === 'ROOT' || $org->id === 1;
    }

    /**
     * "Platform context": a Super Admin currently working AS the platform (ROOT org).
     * Everything tenant-specific (courses, exams, proctoring...) is unavailable here,
     * and everything platform-specific (organizations, plans...) is unavailable in a tenant.
     */
    public function inPlatformContext(): bool
    {
        return Auth::user()?->role === 'SUPER_ADMIN' && $this->isRoot();
    }

    /**
     * What the signed-in user may do in the ACTIVE context. This is the single source of truth:
     * the EnforceContextScope middleware rejects routes with it and the UI only renders what it allows.
     */
    public function capabilities(): array
    {
        $role = Auth::user()?->role;
        $platform = $this->inPlatformContext();
        $admin = in_array($role, ['SUPER_ADMIN', 'ORG_ADMIN'], true);
        $staff = $admin || $role === 'TEACHER';

        return [
            // platform context only
            'organizations' => $platform,
            'managePlans' => $platform,
            'billing' => $platform,
            // platform: root accounts; tenant: that organization's accounts
            'users' => $platform || $admin,
            // tenant context only
            'academic' => !$platform && $staff,   // courses, exams, question banks, monitoring, reports
            'quota' => !$platform && $admin,      // read-only plan & quota of the organization
            'orgSettings' => !$platform && $admin,
            'switchOrganization' => $role === 'SUPER_ADMIN',
        ];
    }

    /**
     * Teams shown in the switcher. Only the ACTIVE organization is sent: the list of
     * organizations can be huge, so the switcher searches them on demand (OrganizationSwitchController).
     */
    public function teams(): array
    {
        return $this->activeTeam() ? [$this->activeTeam()] : [];
    }

    public function activeTeam(): array
    {
        $org = $this->current();

        return [
            'id' => $org->id,
            'name' => $org->name,
            'code' => $org->code,
            'type' => $org->type,
            'status' => $org->status,
            'plan' => $org->activeSubscription?->plan?->name ?? 'FREE',
        ];
    }

    /**
     * Validate role assignment according to tenant boundaries:
     * - SUPER_ADMIN can ONLY be created in ROOT organization.
     * - Non-super-admins can NEVER create SUPER_ADMIN.
     */
    public function assertCanAssignRole(string $role, int $targetOrgId): void
    {
        $targetOrg = Organization::find($targetOrgId);
        $isTargetRoot = $targetOrg && ($targetOrg->code === 'ROOT' || $targetOrg->id === 1);

        if (!$isTargetRoot && $role === 'SUPER_ADMIN') {
            throw ValidationException::withMessages([
                'role' => 'Tài khoản thuộc tổ chức/trường học không thể có vai trò Root Super Admin (SUPER_ADMIN). Chỉ tổ chức ROOT mới được phép có vai trò này.',
            ]);
        }

        $currentUser = Auth::user();
        if ($currentUser && $currentUser->role !== 'SUPER_ADMIN' && $role === 'SUPER_ADMIN') {
            abort(403, 'Bạn không có quyền gán vai trò Super Admin.');
        }
    }

    /**
     * Organization that new records (users, courses, exams...) are created in.
     * Everyone, Super Admins included, creates inside the ACTIVE organization: the platform context
     * creates ROOT accounts, a school context creates that school's records. A posted organization_id is ignored.
     */
    public function resolveTargetOrgId(?int $explicitOrgId = null): int
    {
        return $this->id();
    }

    /**
     * Prevent Insecure Direct Object Reference (IDOR) attacks across tenants.
     */
    public function enforceOwnership(Model $model, string $orgForeignKey = 'organization_id'): void
    {
        $currentUser = Auth::user();
        if (!$currentUser) {
            abort(401);
        }

        // Super admin at ROOT platform has cross-tenant oversight
        if ($currentUser->role === 'SUPER_ADMIN' && $this->isRoot()) {
            return;
        }

        // If the model itself is an Organization
        if ($model instanceof Organization) {
            if ($model->id !== $this->id()) {
                abort(403, 'Bạn không có quyền truy cập hoặc chỉnh sửa thông tin tổ chức khác.');
            }
            return;
        }

        // Otherwise, the model MUST belong to the active tenant
        $modelOrgId = (int)$model->{$orgForeignKey};
        if ($modelOrgId !== $this->id()) {
            abort(403, 'Bạn không có quyền truy cập hoặc chỉnh sửa dữ liệu thuộc tổ chức khác.');
        }
    }

    /**
     * Format payload for Inertia Shared Data.
     */
    public function toInertiaArray(): array
    {
        $org = $this->current();
        return [
            'current' => [
                'id' => $org->id,
                'name' => $org->name,
                'code' => $org->code,
                'type' => $org->type,
                'status' => $org->status,
                'plan' => $org->activeSubscription?->plan?->name ?? 'FREE',
            ],
            'is_root' => $this->isRoot(),
            'is_platform' => $this->inPlatformContext(),
            'can' => $this->capabilities(),
            'teams' => $this->teams(),
        ];
    }
}
