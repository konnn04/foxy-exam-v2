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
        'voided_at',
        'void_reason',
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

    protected static function booted(): void
    {
        // every way an attempt ends (submit, time out, absent, force end) passes through a status change: when the exam
        // asks for it, the attempt's recordings and evidence get encrypted from then on
        static::updated(function (ExamAttempt $a) {
            if (!$a->wasChanged('status') || $a->getOriginal('status') !== 'IN_PROGRESS' || $a->status === 'IN_PROGRESS') {
                return;
            }
            if (!empty(($a->exam?->monitoring_config ?? [])['seal_after_exam'])) {
                app(\App\Services\Realtime::class)->sealAttempt($a);
            }
        });
    }

    /** When the candidate's time runs out. `end_time` of the exam only closes the door for NEW attempts. */
    public function deadline(): ?\Illuminate\Support\Carbon
    {
        $minutes = $this->exam?->duration_minutes;

        return $this->started_at && $minutes ? $this->started_at->copy()->addMinutes($minutes) : null;
    }

    /** Seconds the candidate still has (never negative). */
    public function secondsLeft(): int
    {
        $deadline = $this->deadline();

        return $deadline ? max(0, (int) now()->diffInSeconds($deadline, false)) : 0;
    }

    /** Past the deadline by more than $graceSeconds (the last autosave of a slow network still counts). */
    public function isOverdue(int $graceSeconds = 60): bool
    {
        $deadline = $this->deadline();

        return $deadline !== null && now()->gt($deadline->copy()->addSeconds($graceSeconds));
    }

    /** Newest sign of life: realtime presence, any REST call that touched the row, or the start. */
    public function lastSeen(): ?\Illuminate\Support\Carbon
    {
        return collect([$this->last_seen_at, $this->updated_at, $this->started_at])->filter()->max();
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

    public function violationReport(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(ViolationReport::class, 'exam_attempt_id');
    }
}
