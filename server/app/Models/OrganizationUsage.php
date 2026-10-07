<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationUsage extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'month_year',
        'exams_created_count',
        'total_attempts_count',
        'storage_used_bytes',
    ];

    protected $casts = [
        'exams_created_count' => 'integer',
        'total_attempts_count' => 'integer',
        'storage_used_bytes' => 'integer',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
