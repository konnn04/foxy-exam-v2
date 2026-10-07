<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'price',
        'billing_cycle',
        'max_exams_per_month',
        'max_students_per_exam',
        'storage_limit_gb',
        'has_ai_proctoring',
        'has_code_replay',
        'is_active',
    ];

    protected $casts = [
        'price' => 'float',
        'max_exams_per_month' => 'integer',
        'max_students_per_exam' => 'integer',
        'storage_limit_gb' => 'integer',
        'has_ai_proctoring' => 'boolean',
        'has_code_replay' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
