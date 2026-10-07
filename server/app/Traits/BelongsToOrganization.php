<?php

namespace App\Traits;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

trait BelongsToOrganization
{
    /**
     * Boot the trait to apply the organization global scope.
     */
    protected static function bootBelongsToOrganization(): void
    {
        static::creating(function ($model) {
            if (empty($model->organization_id) && Auth::hasUser()) {
                $model->organization_id = Auth::user()->organization_id;
            }
        });

        static::addGlobalScope('organization', function (Builder $builder) {
            if (Auth::hasUser()) {
                $user = Auth::user();
                // Super Admin can see all tenant records; everyone else is strictly isolated
                if ($user && $user->role !== 'SUPER_ADMIN') {
                    $builder->where($builder->getModel()->getTable() . '.organization_id', $user->organization_id);
                }
            }
        });
    }

    /**
     * Relationship: Belongs to Organization.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
