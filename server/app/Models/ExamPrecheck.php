<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamPrecheck extends Model
{
    protected $fillable = [
        'user_id', 'exam_id', 'exam_attempt_id', 'token_hash', 'passed', 'reasons', 'checks', 'env',
        'fingerprint', 'boot_time', 'os_family', 'ip', 'expires_at', 'used_at',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'passed' => 'boolean',
            'reasons' => 'array',
            'checks' => 'array',
            'env' => 'array',
            'boot_time' => 'integer',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }
}
