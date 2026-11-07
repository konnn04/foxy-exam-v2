<?php

namespace App\Http\Controllers;

use App\Models\AttemptMessage;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Violation;
use App\Models\ViolationReport;
use App\Services\Realtime;
use App\Services\TenantContext;
use App\Support\ViolationCatalog;
use App\Support\ViolationChain;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class ViolationReportController extends Controller
{
    public function __construct(private TenantContext $tenant) {}

    private function guardStaff(): void
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'LECTURER']), 403);
    }

    private function attemptOrFail(int $attemptId): ExamAttempt
    {
        $attempt = ExamAttempt::with(['exam.course:id,code,name', 'exam.organization:id,code,name', 'user:id,name,username,email'])->findOrFail($attemptId);
        $this->tenant->enforceOwnership($attempt->exam);

        return $attempt;
    }

    /**
     * POST /admin/attempts/{id}/violation-report
     * Giảng viên chọn các vi phạm đính kèm, kết luận xử lý và bấm Xuất bản (hoặc Cập nhật) biên bản chia sẻ qua link web.
     */
    public function publish(Request $request, int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);

        $validated = $request->validate([
            'status' => ['required', 'in:no_violation,warning,suspended'],
            'suspension_reason' => ['nullable', 'string', 'max:2000'],
            'score_deduction_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'attached_violation_ids' => ['nullable', 'array', 'max:2000'],
            'attached_violation_ids.*' => ['integer'],
            'link_expires_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'notify_student' => ['nullable', 'boolean'],
            'regenerate_slug' => ['nullable', 'boolean'],
        ]);

        $status = $validated['status'];
        $deduction = $status === ViolationReport::STATUS_WARNING
            ? (int) ($validated['score_deduction_percent'] ?? 25)
            : ($status === ViolationReport::STATUS_SUSPENDED ? 100 : 0);

        $reason = trim((string) ($validated['suspension_reason'] ?? ''));
        if ($reason === '') {
            $reason = ViolationReport::REASON_TEMPLATES[$status] ?? '';
        }

        // Filter attached violation IDs so they strictly belong to this attempt
        $requestedIds = collect($validated['attached_violation_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
        $validViolationIds = Violation::withoutGlobalScope('counted')
            ->where('exam_attempt_id', $attempt->id)
            ->when($requestedIds->isNotEmpty(), fn ($q) => $q->whereIn('id', $requestedIds))
            ->when($requestedIds->isEmpty() && $status !== ViolationReport::STATUS_NO_VIOLATION, fn ($q) => $q->where('is_false_positive', false))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        if ($status === ViolationReport::STATUS_NO_VIOLATION && $requestedIds->isEmpty()) {
            $validViolationIds = [];
        }

        // Mark ticked violations as reviewed & confirmed
        if (!empty($validViolationIds)) {
            Violation::withoutGlobalScope('counted')
                ->where('exam_attempt_id', $attempt->id)
                ->whereIn('id', $validViolationIds)
                ->update(['is_reviewed' => true, 'is_false_positive' => false]);
        }

        $existing = ViolationReport::where('exam_attempt_id', $attempt->id)->first();
        $originalScore = $existing && $existing->original_score !== null
            ? $existing->original_score
            : $attempt->score;

        // Calculate new score on attempt based on report conclusion
        if ($originalScore !== null) {
            $newScore = match ($status) {
                ViolationReport::STATUS_SUSPENDED => 0.0,
                ViolationReport::STATUS_WARNING => round(max(0.0, (float) $originalScore * (1.0 - $deduction / 100.0)), 2),
                default => (float) $originalScore,
            };
            $attempt->score = $newScore;
        } elseif ($status === ViolationReport::STATUS_SUSPENDED) {
            $attempt->score = 0.0;
        }

        if ($status === ViolationReport::STATUS_SUSPENDED) {
            if ($attempt->status === 'IN_PROGRESS') {
                $attempt->status = 'FORCE_ENDED';
                $attempt->submitted_at = now();
                app(Realtime::class)->lifecycle($attempt, 'force_ended');
            }
            $attempt->is_flagged = true;
        }
        $attempt->save();

        $expiresDays = (int) ($validated['link_expires_days'] ?? 30);
        $slug = ($existing && empty($validated['regenerate_slug']))
            ? $existing->slug
            : ViolationReport::generateSlug($attempt->exam_id, $attempt->id);

        $notifyStudent = (bool) ($validated['notify_student'] ?? false);

        $report = ViolationReport::updateOrCreate(
            ['exam_attempt_id' => $attempt->id],
            [
                'exam_id' => $attempt->exam_id,
                'user_id' => $attempt->user_id,
                'reported_by' => Auth::id(),
                'slug' => $slug,
                'is_published' => true,
                'status' => $status,
                'suspension_reason' => $reason,
                'score_deduction_percent' => $deduction,
                'original_score' => $originalScore,
                'attached_violation_ids' => $validViolationIds,
                'link_expires_at' => now()->addDays($expiresDays),
                'sent_at' => $notifyStudent ? now() : ($existing?->sent_at),
            ]
        );

        $publicUrl = url("/violation-report/{$report->slug}");

        if ($notifyStudent) {
            $statusLabel = match ($status) {
                ViolationReport::STATUS_SUSPENDED => 'Đình chỉ thi & hủy kết quả (0 điểm)',
                ViolationReport::STATUS_WARNING => "Cảnh cáo vi phạm (Trừ {$deduction}% điểm)",
                default => 'Không vi phạm (Bảo lưu kết quả)',
            };
            $body = "Kỳ thi: {$attempt->exam->title} ({$attempt->exam->code}) — Phiên #{$attempt->id}\n"
                . "Kết luận xử lý: {$statusLabel}\n"
                . "Số sự kiện đính kèm: " . count($validViolationIds) . " vi phạm\n"
                . "Nhận xét của Hội đồng thi: {$reason}\n"
                . "Xem biên bản điện tử & video minh chứng tại: {$publicUrl}";

            UserNotification::create([
                'user_id' => $attempt->user_id,
                'type' => 'violation_report',
                'title' => "Biên bản xử lý vi phạm đã xuất bản: {$attempt->exam->title}",
                'body' => $body,
                'url' => "/violation-report/{$report->slug}",
            ]);

            AttemptMessage::create([
                'exam_attempt_id' => $attempt->id,
                'sender_id' => Auth::id(),
                'sender_role' => 'PROCTOR',
                'body' => "[BIÊN BẢN ĐIỆN TỬ] Đã xuất bản biên bản giám sát ({$statusLabel}). Xem chi tiết & video minh chứng tại: {$publicUrl}",
            ]);
        }

        return back()->with('success', 'Đã xuất bản biên bản vi phạm thành công. Liên kết chia sẻ đã sẵn sàng.');
    }

    /**
     * POST /admin/attempts/{id}/violation-report/unpublish
     * Gỡ xuất bản (thu hồi link chia sẻ công khai) và khôi phục điểm gốc cho thí sinh.
     */
    public function unpublish(int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);

        $report = ViolationReport::where('exam_attempt_id', $attempt->id)->first();
        if (!$report) {
            return back()->with('error', 'Phiên thi này chưa có biên bản xuất bản.');
        }

        if ($report->original_score !== null) {
            $attempt->score = $report->original_score;
            $attempt->save();
        }

        $report->update([
            'is_published' => false,
        ]);

        return back()->with('success', 'Đã gỡ xuất bản biên bản. Liên kết chia sẻ công khai đã bị vô hiệu hóa và điểm gốc đã được khôi phục.');
    }

    /**
     * GET /violation-report/{slug}
     * Trang web công khai hiển thị Biên bản vi phạm & Trình phát đồng bộ đa luồng Video + Hình ảnh minh chứng.
     */
    public function show(string $slug)
    {
        $report = ViolationReport::with([
            'attempt.user:id,name,username,email',
            'exam.course:id,code,name',
            'exam.organization:id,code,name',
            'reporter:id,name,username',
        ])->where('slug', $slug)->first();

        if (!$report || !$report->is_published || $report->isExpired() || !$report->attempt || !$report->exam) {
            return Inertia::render('Public/ViolationReport', [
                'expiredOrRevoked' => true,
                'reason' => !$report
                    ? 'Không tìm thấy biên bản vi phạm theo đường dẫn này.'
                    : (!$report->is_published
                        ? 'Biên bản vi phạm này đã được giảng viên gỡ xuất bản (thu hồi).'
                        : 'Đường dẫn chia sẻ biên bản vi phạm này đã hết hạn truy cập.'),
            ]);
        }

        $attempt = $report->attempt;
        $exam = $report->exam;
        $attachedIds = collect($report->attached_violation_ids ?? [])->map(fn ($id) => (int) $id)->values();

        $violations = Violation::withoutGlobalScope('counted')
            ->where('exam_attempt_id', $attempt->id)
            ->when($attachedIds->isNotEmpty(), fn ($q) => $q->whereIn('id', $attachedIds))
            ->when($attachedIds->isEmpty() && $report->status === ViolationReport::STATUS_NO_VIOLATION, fn ($q) => $q->whereRaw('1 = 0'))
            ->orderBy('timestamp')
            ->get()
            ->map(fn ($v) => [
                'id' => $v->id,
                'type' => $v->violation_type,
                'label' => ViolationCatalog::label($v->violation_type),
                'severity' => $v->severity,
                'details' => $v->details,
                'evidence_url' => $v->evidence_url,
                'evidence_id' => $v->evidence_id,
                'is_reviewed' => (bool) $v->is_reviewed,
                'is_false_positive' => (bool) $v->is_false_positive,
                'timestamp' => $v->timestamp?->toIso8601String(),
            ]);

        $chain = ViolationChain::verify($attempt->id);

        return Inertia::render('Public/ViolationReport', [
            'expiredOrRevoked' => false,
            'report' => [
                'id' => $report->id,
                'slug' => $report->slug,
                'status' => $report->status,
                'suspension_reason' => $report->suspension_reason,
                'score_deduction_percent' => $report->score_deduction_percent,
                'original_score' => $report->original_score,
                'final_score' => $attempt->score,
                'attached_violation_ids' => $attachedIds->all(),
                'published_at' => $report->updated_at?->toIso8601String(),
                'link_expires_at' => $report->link_expires_at?->toIso8601String(),
                'reporter_name' => $report->reporter?->name ?? 'Hội đồng Giám sát Khảo thí',
            ],
            'attempt' => [
                'id' => $attempt->id,
                'attempt_number' => $attempt->attempt_number,
                'status' => $attempt->status,
                'score' => $attempt->score,
                'risk_score' => (int) $attempt->risk_score,
                'started_at' => $attempt->started_at?->toIso8601String(),
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                'device_info' => $attempt->device_info,
                'user' => [
                    'id' => $attempt->user?->id,
                    'name' => $attempt->user?->name ?? 'Thí sinh',
                    'username' => $attempt->user?->username ?? '—',
                    'email' => $attempt->user?->email ?? '—',
                ],
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'code' => $exam->code,
                    'type' => $exam->type,
                    'duration_minutes' => $exam->duration_minutes,
                    'course' => $exam->course ? ['code' => $exam->course->code, 'name' => $exam->course->name] : null,
                    'organization' => $exam->organization ? ['code' => $exam->organization->code, 'name' => $exam->organization->name] : null,
                ],
            ],
            'violations' => $violations,
            'chain' => $chain,
            'recordingsEndpoint' => "/violation-report/{$report->slug}/recordings",
        ]);
    }

    /**
     * GET /violation-report/{slug}/recordings
     * Trả về danh sách presigned URL của các luồng video (camera, screen, camera2) & ảnh/clip minh chứng cho trang biên bản công khai.
     */
    public function recordings(string $slug)
    {
        $report = ViolationReport::with('exam')->where('slug', $slug)->first();
        if (!$report || !$report->is_published || $report->isExpired() || !$report->exam) {
            return response()->json(['recordings' => []], 404);
        }

        $rt = app(Realtime::class);
        if (!$rt->enabled()) {
            return response()->json(['recordings' => [], 'enabled' => false]);
        }

        // Mint a short-lived read-only proctor token scoped strictly to this exam so we can fetch presigned URLs
        $dummyViewer = new User(['role' => 'LECTURER']);
        $dummyViewer->id = (int) ($report->reported_by ?: 1);
        $token = $rt->proctorToken($dummyViewer, (int) $report->exam->organization_id, [(int) $report->exam_id], 900);
        $recordUrl = rtrim((string) config('services.realtime.record_url'), '/');

        try {
            $resp = Http::timeout(6)
                ->withToken($token)
                ->get("{$recordUrl}/v1/exams/{$report->exam_id}/attempts/{$report->exam_attempt_id}/recordings");

            if ($resp->successful()) {
                return response()->json($resp->json());
            }
        } catch (\Throwable) {
            // Fallback below if record service is unreachable in local dev
        }

        return response()->json([
            'recordings' => [],
            'fallback_token' => $token,
            'record_url' => $recordUrl,
            'exam_id' => $report->exam_id,
            'attempt_id' => $report->exam_attempt_id,
        ]);
    }

    public static function formatForAdmin(?ViolationReport $report): ?array
    {
        if (!$report) {
            return null;
        }

        return [
            'id' => $report->id,
            'slug' => $report->slug,
            'public_url' => url("/violation-report/{$report->slug}"),
            'is_published' => (bool) $report->is_published,
            'status' => $report->status,
            'suspension_reason' => $report->suspension_reason,
            'score_deduction_percent' => (int) $report->score_deduction_percent,
            'original_score' => $report->original_score,
            'attached_violation_ids' => array_map('intval', $report->attached_violation_ids ?? []),
            'link_expires_at' => $report->link_expires_at?->toIso8601String(),
            'sent_at' => $report->sent_at?->toIso8601String(),
            'updated_at' => $report->updated_at?->toIso8601String(),
        ];
    }
}
