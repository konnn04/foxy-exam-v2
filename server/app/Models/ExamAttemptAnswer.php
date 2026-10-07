<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamAttemptAnswer extends Model
{
    use HasFactory;

    protected $fillable = [
        'exam_attempt_id',
        'classical_question_id',
        'answer_id',
        'selected_answer_ids',
        'answer_content',
        'is_correct',
        'score',
    ];

    protected function casts(): array
    {
        return [
            'selected_answer_ids' => 'array',
            'is_correct' => 'boolean',
            'score' => 'float',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ClassicalQuestion::class, 'classical_question_id');
    }

    public function selectedAnswer(): BelongsTo
    {
        return $this->belongsTo(ClassicalQuestionAnswer::class, 'answer_id');
    }
}
