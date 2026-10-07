<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\StudentExamLoginRequest;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Services\AiService;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(
        protected QuotaService $quotaService
    ) {}

    /**
     * Đăng nhập trực tiếp phòng thi bằng mã đề (Client Desktop).
     * 
     * Hỗ trợ ứng dụng thi ngoại tuyến/máy trạm (FoxyExam Client) kết nối thẳng vào phòng thi bằng mã đề thi và tài khoản sinh viên.
     */
    public function studentLogin(StudentExamLoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // Nếu không truyền exam_code -> Đây là đăng nhập tài khoản sinh viên thông thường vào hệ thống
        if (empty($validated['exam_code'])) {
            $loginReq = new \App\Http\Requests\Api\V1\Auth\LoginRequest();
            $loginReq->initialize($request->query->all(), $request->request->all(), $request->attributes->all(), $request->cookies->all(), $request->files->all(), $request->server->all(), $request->getContent());
            $loginReq->setContainer(app())->setRedirector(app('redirect'));
            $loginReq->validateResolved();
            return app(\App\Http\Controllers\Api\V1\Auth\AuthController::class)->login($loginReq);
        }

        // 1. Verify exam exists and is open
        $exam = Exam::where('code', strtoupper($validated['exam_code']))->first();

        if (!$exam) {
            return response()->json([
                'success' => false,
                'message' => 'Mã phòng thi không tồn tại.',
            ], 404);
        }

        if ($exam->status !== 'PUBLISHED' && $exam->status !== 'IN_PROGRESS') {
            return response()->json([
                'success' => false,
                'message' => 'Kỳ thi hiện tại chưa mở hoặc đã kết thúc.',
            ], 403);
        }

        // 2. Verify student credentials scoped to organization
        $userQuery = User::where('username', $validated['username']);
        if (!empty($validated['org_code'])) {
            $org = \App\Models\Organization::where('code', strtoupper($validated['org_code']))->first();
            if ($org) {
                $userQuery->where('organization_id', $org->id);
            }
        } elseif ($exam->organization_id) {
            $userQuery->where('organization_id', $exam->organization_id);
        }
        $user = $userQuery->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Tên đăng nhập hoặc mật khẩu sinh viên không chính xác.',
            ], 401);
        }

        // 3. Check SaaS Quota limits
        $quotaCheck = $this->quotaService->canJoinExam($exam);
        if (!$quotaCheck['allowed']) {
            return response()->json([
                'success' => false,
                'message' => $quotaCheck['message'],
            ], 403);
        }

        // 3b. Kiểm tra tính sẵn sàng của AI Service nếu kỳ thi yêu cầu giám sát khuôn mặt
        $aiCheck = AiService::checkExamRequirement($exam);
        if (!$aiCheck['available']) {
            return response()->json([
                'success' => false,
                'error_code' => 'AI_SERVICE_UNAVAILABLE',
                'message' => $aiCheck['message'],
                'ai_status' => $aiCheck['status'],
            ], 503);
        }

        // 4. Resume lượt thi đang dở, hoặc tạo lượt mới nếu còn trong hạn mức
        // `max_attempts` của kỳ thi (NULL = không giới hạn).
        $pastAttempts = ExamAttempt::where('exam_id', $exam->id)
            ->where('user_id', $user->id)
            ->orderByDesc('attempt_number')
            ->get();

        $attempt = $pastAttempts->first(
            fn ($a) => in_array($a->status, ['IN_PROGRESS', 'NOT_STARTED'], true)
        );

        if ($attempt) {
            if ($attempt->status === 'NOT_STARTED') {
                $attempt->update([
                    'status' => 'IN_PROGRESS',
                    'started_at' => now(),
                    'device_info' => $validated['device_info'] ?? null,
                ]);
            }
        } else {
            if ($reason = $exam->scheduleBlockReason()) {
                return response()->json([
                    'success' => false,
                    'error_code' => 'OUTSIDE_SCHEDULE',
                    'message' => $reason,
                ], 403);
            }

            $attemptsUsed = $pastAttempts->count();
            $maxAttempts = $exam->max_attempts; // null = không giới hạn

            if ($maxAttempts !== null && $attemptsUsed >= $maxAttempts) {
                return response()->json([
                    'success' => false,
                    'message' => "Bạn đã dùng hết số lượt thi cho phép ({$attemptsUsed}/{$maxAttempts}) cho kỳ thi này.",
                ], 403);
            }

            $attempt = ExamAttempt::create([
                'exam_id' => $exam->id,
                'user_id' => $user->id,
                // max + 1 thay vì count + 1: admin có thể đã xoá 1 lượt ở giữa (cột unique).
                'attempt_number' => (int) $pastAttempts->max('attempt_number') + 1,
                'status' => 'IN_PROGRESS',
                'started_at' => now(),
                'device_info' => $validated['device_info'] ?? null,
                'session_token' => Str::random(40),
            ]);
        }

        // 5. Generate Sanctum token
        $token = $user->createToken('foxy-exam-client', ['exam:take'])->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập phòng thi thành công.',
            'data' => [
                'token' => $token,
                'attempt_id' => $attempt->id,
                'student' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'name' => $user->name,
                ],
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'code' => $exam->code,
                    'duration_minutes' => $exam->duration_minutes,
                    'monitoring_config' => $exam->monitoring_config,
                ],
                'attempt_number' => $attempt->attempt_number,
                'max_attempts' => $exam->max_attempts, // null = không giới hạn
            ],
        ]);
    }

    /**
     * Logout and revoke student token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Đã đăng xuất thành công.',
        ]);
    }
}
