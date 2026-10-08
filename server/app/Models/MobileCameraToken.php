<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class MobileCameraToken extends Model
{
    protected $fillable = ['user_id', 'exam_id', 'attempt_id', 'token_hash', 'relay_ack_at', 'expires_at'];

    protected $casts = ['relay_ack_at' => 'datetime', 'expires_at' => 'datetime'];

    public static function hash(string $raw): string
    {
        return hash('sha256', $raw);
    }

    public static function generate(): string
    {
        return Str::random(48);
    }

    public static function findByRaw(string $raw): ?self
    {
        return static::where('token_hash', static::hash($raw))->first();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }

    /** Valid until it expires or the attempt it belongs to is over. */
    public function isValid(): bool
    {
        if ($this->expires_at->isPast()) {
            return false;
        }

        return $this->attempt_id === null || $this->attempt?->status === 'IN_PROGRESS';
    }
}
