<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class FaceEnrollToken extends Model
{
    public const TTL_MINUTES = 10;

    protected $fillable = ['user_id', 'token_hash', 'expires_at', 'used_at'];

    protected $casts = ['expires_at' => 'datetime', 'used_at' => 'datetime'];

    public static function hash(string $raw): string
    {
        return hash('sha256', $raw);
    }

    public static function generate(): string
    {
        return Str::random(48);
    }

    public static function findValid(string $raw): ?self
    {
        $row = static::where('token_hash', static::hash($raw))->first();

        return $row && $row->used_at === null && $row->expires_at->isFuture() ? $row : null;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
