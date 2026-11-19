<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    protected $fillable = ['title', 'body', 'url', 'audience', 'recipients_count', 'created_by'];

    protected $casts = ['audience' => 'array'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
