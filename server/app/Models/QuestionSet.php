<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuestionSet extends Model
{
    use HasFactory;

    protected $fillable = [
        'organization_id',
        'course_id',
        'name',
        'code',
        'type', // 'CLASSICAL' or 'PROGRAMMING'
        'description',
        'status', // 'DRAFT', 'PUBLISHED', 'ARCHIVED'
        'max_score',
        'limit_questions',      // 0 = deal every question
        'ratio_per_difficulty', // {"EASY":30,"MEDIUM":40,"HARD":20,"EXPERT":10}
        'created_by',
    ];

    protected $casts = [
        'max_score' => 'float',
        'limit_questions' => 'integer',
        'ratio_per_difficulty' => 'array',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Câu hỏi cổ điển (chỉ lấy câu hỏi gốc, không bao gồm câu hỏi con trong nhóm)
     */
    public function rootClassicalQuestions(): HasMany
    {
        return $this->hasMany(ClassicalQuestion::class)->whereNull('parent_id')->orderBy('order');
    }

    /**
     * Tất cả câu hỏi cổ điển thuộc bộ đề
     */
    public function classicalQuestions(): HasMany
    {
        return $this->hasMany(ClassicalQuestion::class)->orderBy('order');
    }

    /**
     * Các bài toán lập trình thuộc bộ đề
     */
    public function programmingProblems(): HasMany
    {
        return $this->hasMany(ProgrammingProblem::class)->orderBy('order');
    }
}
