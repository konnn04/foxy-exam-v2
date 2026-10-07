<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\CreateExamRequest;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ProgrammingProblem;
use App\Models\TestCase;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function __construct(
        protected QuotaService $quotaService
    ) {}

    /**
     * Xem thông tin gói SaaS và hạn mức sử dụng trong tháng của tổ chức.
     * 
     * Kiểm tra chi tiết gói đăng ký hiện tại, số lượng kỳ thi tối đa, số sinh viên tối đa mỗi phòng, dung lượng lưu trữ và mức tiêu thụ tài nguyên thực tế.
     */
    public function getQuotaStatus(Request $request): JsonResponse
    {
        $user = $request->user();
        $org = $user->organization;

        $plan = $this->quotaService->getActivePlan($org);
        $usage = $this->quotaService->getCurrentUsage($org);

        return response()->json([
            'success' => true,
            'data' => [
                'organization' => [
                    'id' => $org->id,
                    'name' => $org->name,
                    'code' => $org->code,
                ],
                'plan' => [
                    'name' => $plan->name,
                    'display_name' => $plan->display_name,
                    'max_exams_per_month' => $plan->max_exams_per_month,
                    'max_students_per_exam' => $plan->max_students_per_exam,
                    'storage_limit_gb' => $plan->storage_limit_gb,
                    'has_ai_proctoring' => $plan->has_ai_proctoring,
                    'has_code_replay' => $plan->has_code_replay,
                ],
                'current_month_usage' => [
                    'month' => $usage->month_year,
                    'exams_created' => $usage->exams_created_count,
                    'total_attempts' => $usage->total_attempts_count,
                    'storage_used_bytes' => $usage->storage_used_bytes,
                ],
            ],
        ]);
    }

    /**
     * Tạo kỳ thi mới với kiểm tra hạn mức gói SaaS và cấu hình giám sát AI.
     * 
     * Khởi tạo kỳ thi cho khóa học, tự động sinh mã phòng thi (code), kiểm tra quyền sử dụng tính năng AI Anti-Cheat của gói dịch vụ tổ chức.
     */
    public function createExam(CreateExamRequest $request): JsonResponse
    {
        $user = $request->user();
        $org = $user->organization;

        // 1. Enforce SaaS Quota limit
        $quotaCheck = $this->quotaService->canCreateExam($org);
        if (!$quotaCheck['allowed']) {
            return response()->json([
                'success' => false,
                'error_code' => 'QUOTA_EXCEEDED',
                'message' => $quotaCheck['message'],
                'current' => $quotaCheck['current'],
                'limit' => $quotaCheck['limit'],
            ], 403);
        }

        // 2. Validate input
        $validated = $request->validated();

        // Check if AI proctoring is enabled and if the plan allows it
        if (!empty($validated['monitoring_config']['ai_face_check'])) {
            if (!$this->quotaService->hasFeature($org, 'ai_proctoring')) {
                return response()->json([
                    'success' => false,
                    'error_code' => 'FEATURE_NOT_PERMITTED',
                    'message' => 'Tính năng Giám sát AI (Khuôn mặt & Vật cấm) chỉ khả dụng từ gói Pro trở lên. Vui lòng nâng cấp gói!',
                ], 403);
            }
        }

        // 3. Create the exam
        $exam = Exam::create([
            'organization_id' => $org->id,
            'course_id' => $validated['course_id'],
            'title' => $validated['title'],
            'code' => 'FOXY-' . strtoupper(Str::random(6)),
            'description' => $validated['description'] ?? null,
            'type' => $validated['type'],
            'status' => 'PUBLISHED',
            'start_time' => now(),
            'end_time' => now()->addDays(7),
            'duration_minutes' => $validated['duration_minutes'],
            'max_attempts' => $validated['max_attempts'] ?? 1,
            'monitoring_config' => $validated['monitoring_config'] ?? [],
            'created_by' => $user->id,
        ]);

        // 4. Record usage count
        $this->quotaService->recordExamCreated($org);

        return response()->json([
            'success' => true,
            'message' => 'Tạo kỳ thi thành công.',
            'data' => $exam,
        ], 201);
    }

    /**
     * Lấy danh sách các sự kiện vi phạm an ninh phòng thi theo thời gian thực.
     * 
     * Cung cấp dữ liệu vi phạm (loại hành vi, mức độ nghiêm trọng, ảnh chụp webcam bằng chứng) cho cán bộ coi thi và giảng viên giám sát.
     */
    public function getExamViolations(Request $request, int $examId): JsonResponse
    {
        $exam = Exam::findOrFail($examId);

        $violations = $exam->attempts()
            ->with(['user:id,username,name', 'violations'])
            ->get()
            ->flatMap(function ($attempt) {
                return $attempt->violations->map(function ($v) use ($attempt) {
                    return [
                        'violation_id' => $v->id,
                        'student' => $attempt->user,
                        'attempt_id' => $attempt->id,
                        'type' => $v->violation_type,
                        'severity' => $v->severity,
                        'details' => $v->details,
                        'evidence_url' => $v->evidence_url,
                        'timestamp' => $v->timestamp,
                        'is_reviewed' => $v->is_reviewed,
                    ];
                });
            })
            ->sortByDesc('timestamp')
            ->values();

        return response()->json([
            'success' => true,
            'data' => $violations,
        ]);
    }
}
