<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProgrammingProblem extends Model
{
    use HasFactory;

    protected $fillable = [
        'question_set_id',
        'exam_id',
        'title',
        'description',
        'difficulty',
        'time_limit_ms',
        'memory_limit_mb',
        'allowed_languages',
        'starter_templates',
        'order',
    ];

    protected $casts = [
        'time_limit_ms' => 'integer',
        'memory_limit_mb' => 'integer',
        'allowed_languages' => 'array',
        'starter_templates' => 'array',
        'order' => 'integer',
    ];

    public function questionSet(): BelongsTo
    {
        return $this->belongsTo(QuestionSet::class);
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function testCases(): HasMany
    {
        return $this->hasMany(TestCase::class);
    }

    public function sampleTestCases(): HasMany
    {
        return $this->hasMany(TestCase::class)->where('is_sample', true);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }
}
