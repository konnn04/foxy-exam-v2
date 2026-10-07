<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassicalQuestion extends Model
{
    use HasFactory;

    protected $fillable = [
        'question_set_id',
        'parent_id',
        'type', // see TYPES
        'content',
        'explanation',
        'is_true',   // TRUE_FALSE
        'settings',  // per-type options, see App\Support\QuestionSettings
        'skill',
        'image',
        'points',
        'difficulty',
        'order',
        'created_by',
    ];

    /** Every question type of the old exam-sys, kept 1:1. */
    public const TYPES = [
        'SINGLE_CHOICE',          // Trắc nghiệm 1 đáp án
        'MULTIPLE_CHOICE',        // Trắc nghiệm nhiều đáp án
        'TRUE_FALSE',             // Đúng / Sai
        'MULTIPLE_FILL_IN_BLANK', // Điền khuyết nhiều ô
        'SHORT_ANSWER',           // Trả lời ngắn
        'ESSAY',                  // Tự luận (viết / ghi âm / nộp tệp)
        'GROUP_QUESTION',         // Nhóm: đoạn văn / audio / hình + câu con
    ];

    public const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

    protected $casts = [
        'points' => 'float',
        'order' => 'integer',
        'is_true' => 'boolean',
        'settings' => 'array',
    ];

    public function questionSet(): BelongsTo
    {
        return $this->belongsTo(QuestionSet::class);
    }

    /**
     * Nhóm cha nếu đây là câu hỏi con trong bài đọc
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(ClassicalQuestion::class, 'parent_id');
    }

    /**
     * Các câu hỏi con nếu đây là GROUP_QUESTION
     */
    public function children(): HasMany
    {
        return $this->hasMany(ClassicalQuestion::class, 'parent_id')->orderBy('order');
    }

    /**
     * Danh sách phương án đáp án của câu hỏi
     */
    public function answers(): HasMany
    {
        return $this->hasMany(ClassicalQuestionAnswer::class)->orderBy('order');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
