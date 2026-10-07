<?php

namespace App\Models;

use App\Traits\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exam extends Model
{
    use HasFactory, BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'course_id',
        'question_set_id',
        'title',
        'code',
        'description',
        'type',
        'status',
        'start_time',
        'end_time',
        'duration_minutes',
        'max_attempts',
        'monitoring_config',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'duration_minutes' => 'integer',
            'max_attempts' => 'integer', // null = không giới hạn số lượt thi
            'monitoring_config' => 'array',
        ];
    }

    /**
     * Lý do không thể BẮT ĐẦU lượt thi mới vào lúc này theo lịch thi
     * (`start_time` / `end_time`, NULL = không giới hạn phía đó), hoặc null nếu được phép.
     * Lượt đang làm dở vẫn được tiếp tục — đã có `duration_minutes` giới hạn thời gian.
     */
    public function scheduleBlockReason(): ?string
    {
        $now = now();
        if ($this->start_time && $now->lt($this->start_time)) {
            return 'Kỳ thi chưa mở. Thời gian bắt đầu: ' . $this->start_time->copy()->timezone('Asia/Ho_Chi_Minh')->format('H:i d/m/Y') . '.';
        }
        if ($this->end_time && $now->gt($this->end_time)) {
            return 'Kỳ thi đã đóng lúc ' . $this->end_time->copy()->timezone('Asia/Ho_Chi_Minh')->format('H:i d/m/Y') . '.';
        }
        return null;
    }

    /** Giám thị được phân công (cùng tổ chức). */
    public function proctors(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(User::class, 'exam_proctors')->withTimestamps();
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function questionSet(): BelongsTo
    {
        return $this->belongsTo(QuestionSet::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function programmingProblems(): HasMany
    {
        return $this->hasMany(ProgrammingProblem::class)->orderBy('order');
    }

    public function problems(): HasMany
    {
        return $this->programmingProblems();
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }

    public function activeAttempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class)->where('status', 'IN_PROGRESS');
    }

    public function violations(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(Violation::class, ExamAttempt::class, 'exam_id', 'exam_attempt_id');
    }
}
