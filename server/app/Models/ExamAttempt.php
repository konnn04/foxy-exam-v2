<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamAttempt extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_id',
        'user_id',
        'attempt_number',
        'status',
        'started_at',
        'submitted_at',
        'score',
        'risk_score',
        'is_flagged',
        'device_info',
        'session_token',
        'last_seen_at',
        'ended_reason',
    ];

    protected function casts(): array
    {
        return [
            'attempt_number' => 'integer',
            'last_seen_at' => 'datetime',
            'started_at' => 'datetime',
            'submitted_at' => 'datetime',
            'score' => 'float',
            'risk_score' => 'integer',
            'is_flagged' => 'boolean',
            'device_info' => 'array',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function editOpLogs(): HasMany
    {
        return $this->hasMany(EditOpLog::class)->orderBy('batch_seq');
    }

    public function violations(): HasMany
    {
        return $this->hasMany(Violation::class)->latest('timestamp');
    }

    public function classicalAnswers(): HasMany
    {
        return $this->hasMany(ExamAttemptAnswer::class);
    }
}
