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
    ];

    protected $casts = [
        'details' => 'array',
        'is_reviewed' => 'boolean',
        'is_false_positive' => 'boolean',
        'timestamp' => 'datetime',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }
}
