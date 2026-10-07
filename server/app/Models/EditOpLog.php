<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EditOpLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'exam_attempt_id',
        'programming_problem_id',
        'batch_seq',
        'keystroke_count',
        'paste_event_count',
        'synthetic_flags',
        'raw_ops_payload',
        'payload_ref',
        'client_event_id',
        'created_at',
    ];

    protected $casts = [
        'batch_seq' => 'integer',
        'keystroke_count' => 'integer',
        'paste_event_count' => 'integer',
        'synthetic_flags' => 'array',
        'created_at' => 'datetime',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }

    public function problem(): BelongsTo
    {
        return $this->belongsTo(ProgrammingProblem::class, 'programming_problem_id');
    }
}
