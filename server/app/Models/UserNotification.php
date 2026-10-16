<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotification extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'type', 'title', 'body', 'url', 'read_at'];

    protected $casts = ['read_at' => 'datetime', 'created_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'read' => $this->read_at !== null,
            'at' => $this->created_at?->toIso8601String(),
        ];
    }
}
