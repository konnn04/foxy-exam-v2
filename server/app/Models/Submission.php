<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Submission extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_attempt_id',
        'programming_problem_id',
        'language',
        'source_code',
        'passed_cases_count',
        'total_cases_count',
        'score',
        'status',
        'grading_details',
        'submitted_at',
    ];

    protected $casts = [
        'passed_cases_count' => 'integer',
        'total_cases_count' => 'integer',
        'score' => 'float',
        'grading_details' => 'array',
        'submitted_at' => 'datetime',
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
