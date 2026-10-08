<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttemptMessage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['exam_attempt_id', 'sender_id', 'sender_role', 'body'];

    protected $casts = ['created_at' => 'datetime'];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'role' => $this->sender_role,
            'name' => $this->sender?->name,
            'body' => $this->body,
            'at' => $this->created_at?->toIso8601String(),
        ];
    }
}
