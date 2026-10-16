<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BiometricConsent extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'token_id', 'policy_version', 'source', 'ip', 'user_agent', 'accepted_at'];

    protected $casts = ['accepted_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
