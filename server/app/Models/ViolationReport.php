<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ViolationReport extends Model
{
    public const STATUS_NO_VIOLATION = 'no_violation';
    public const STATUS_WARNING = 'warning';
    public const STATUS_SUSPENDED = 'suspended';

    public const REASON_TEMPLATES = [
        self::STATUS_NO_VIOLATION => 'Qua đối chiếu bằng chứng hình ảnh và luồng video đa góc nhìn, Hội đồng thi xác nhận các cảnh báo tự động trong phiên thi này là báo nhầm kỹ thuật. Thí sinh tuân thủ đúng quy chế phòng thi và được bảo lưu toàn bộ điểm bài làm.',
        self::STATUS_WARNING => 'Hệ thống Exam Guard và cán bộ coi thi ghi nhận thí sinh có hành vi vi phạm quy chế phòng thi ở mức độ cảnh cáo (rời vùng giám sát / chuyển cửa sổ / thiết bị phụ gián đoạn). Thí sinh bị nhắc nhở và trừ điểm theo tỷ lệ quy định.',
        self::STATUS_SUSPENDED => 'Hệ thống Exam Guard phát hiện hành vi gian lận nghiêm trọng có minh chứng đồng bộ (sử dụng tài liệu/thiết bị trái phép, có người thứ hai hỗ trợ, hoặc can thiệp môi trường thi an toàn). Phiên thi bị đình chỉ và hủy kết quả bài làm (0 điểm).',
    ];

    protected $fillable = [
        'exam_attempt_id',
        'exam_id',
        'user_id',
        'reported_by',
        'slug',
        'is_published',
        'status',
        'suspension_reason',
        'score_deduction_percent',
        'original_score',
        'attached_violation_ids',
        'link_expires_at',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'score_deduction_percent' => 'integer',
            'original_score' => 'float',
            'attached_violation_ids' => 'array',
            'link_expires_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'exam_attempt_id');
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function isExpired(): bool
    {
        return $this->link_expires_at !== null && $this->link_expires_at->isPast();
    }

    public static function generateSlug(int $examId, int $attemptId): string
    {
        return sprintf(
            'vr-%d-%s-%d-%s',
            $examId,
            now()->format('Ymd'),
            $attemptId,
            strtolower(Str::random(10))
        );
    }
}
