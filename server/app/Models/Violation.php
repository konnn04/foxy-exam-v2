<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Violation extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_attempt_id',
        'violation_type',
        'severity',
        'details',
        'evidence_url',
        'is_reviewed',
        'is_false_positive',
        'timestamp',
        'client_event_id',
        'evidence_id',
        'voided',
    ];

    protected $casts = [
        'details' => 'array',
        'is_reviewed' => 'boolean',
        'is_false_positive' => 'boolean',
        'voided' => 'boolean',
        'timestamp' => 'datetime',
    ];

    /** Violations of a voided attempt stay stored but drop out of every count and list. */
    protected static function booted(): void
    {
        static::addGlobalScope('counted', fn ($q) => $q->where('violations.voided', false));
        static::creating(function (self $v) {
            if ($v->exam_attempt_id && ExamAttempt::whereKey($v->exam_attempt_id)->whereNotNull('voided_at')->exists()) {
                $v->voided = true;
            }
        });
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }
}
