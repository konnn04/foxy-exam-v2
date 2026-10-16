<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FaceChangeRequest extends Model
{
    protected $fillable = ['user_id', 'reason', 'status', 'decided_by', 'decided_at', 'decision_note'];

    protected $casts = ['decided_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
