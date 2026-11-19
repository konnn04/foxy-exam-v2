<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'user_name', 'organization_id', 'action', 'target_type', 'target_id', 'summary', 'meta', 'ip'];

    protected $casts = ['meta' => 'array', 'created_at' => 'datetime'];
}
