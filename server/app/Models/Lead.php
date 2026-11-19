<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
    public const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED', 'SPAM'];

    protected $fillable = ['name', 'email', 'phone', 'organization', 'locale', 'status', 'note', 'handled_by', 'terms_accepted_at', 'terms_hash', 'ip', 'user_agent'];

    protected $casts = ['terms_accepted_at' => 'datetime'];

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
