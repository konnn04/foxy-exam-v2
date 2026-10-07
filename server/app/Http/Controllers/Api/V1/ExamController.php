<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExamController extends Controller
{
    /**
     * Lấy đề thi và danh sách bài tập lập trình (Client thi độc lập).
     * 
     * Hỗ trợ ứng dụng client tải nội dung bài toán lập trình, mẫu code khởi tạo và các bộ test case ví dụ.
     */
    public function getPaper(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get the student's active attempt
        $attempt = \App\Support\AttemptResolver::for($request);

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy phiên làm bài đang hoạt động.',
            ], 404);
        }

        $exam = $attempt->exam()->with([
            'programmingProblems' => function ($query) {
                $query->with('sampleTestCases');
            }
        ])->first();

        // Calculate remaining seconds
        $elapsedSeconds = now()->diffInSeconds($attempt->started_at);
        $totalSeconds = $exam->duration_minutes * 60;
        $remainingSeconds = max(0, $totalSeconds - $elapsedSeconds);

        return response()->json([
            'success' => true,
            'data' => [
                'attempt_id' => $attempt->id,
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'description' => $exam->description,
                    'duration_minutes' => $exam->duration_minutes,
                    'remaining_seconds' => $remainingSeconds,
                    'monitoring_config' => $exam->monitoring_config,
                ],
                'problems' => $exam->programmingProblems->map(function ($p) {
                    return [
                        'id' => $p->id,
                        'order' => $p->order,
                        'title' => $p->title,
                        'description' => $p->description,
                        'difficulty' => $p->difficulty,
                        'time_limit_ms' => $p->time_limit_ms,
                        'memory_limit_mb' => $p->memory_limit_mb,
                        'allowed_languages' => $p->allowed_languages,
                        'starter_templates' => $p->starter_templates,
                        'sample_test_cases' => $p->sampleTestCases->map(fn($tc) => [
                            'input' => $tc->input_data,
                            'output' => $tc->expected_output,
                        ]),
                    ];
                }),
            ],
        ]);
    }

    /**
     * Gửi nhịp tim duy trì phiên thi và đồng bộ thời gian thực (Heartbeat).
     * 
     * Client định kỳ gửi tín hiệu báo sống để cập nhật thời gian còn lại của bài thi và nhận cảnh báo nếu bị phát hiện vi phạm quy chế.
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $user = $request->user();

        $attempt = \App\Support\AttemptResolver::for($request);

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'Phiên thi đã kết thúc.',
                'action' => 'FORCE_LOGOUT',
            ], 403);
        }

        $attempt->touch(); // Update updated_at timestamp

        $exam = $attempt->exam;
        $elapsed = now()->diffInSeconds($attempt->started_at);
        $remaining = max(0, ($exam->duration_minutes * 60) - $elapsed);

        return response()->json([
            'success' => true,
            'status' => $attempt->status,
            'remaining_seconds' => $remaining,
            'is_flagged' => $attempt->is_flagged,
        ]);
    }

    /**
     * Nộp bài thi và kết thúc phiên làm bài (Client thi độc lập).
     * 
     * Đánh dấu hoàn tất bài làm và chuyển trạng thái lượt thi sang SUBMITTED.
     */
    public function finishExam(Request $request): JsonResponse
    {
        $user = $request->user();

        $attempt = \App\Support\AttemptResolver::for($request);

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy phiên làm bài hợp lệ.',
            ], 404);
        }

        $attempt->update([
            'status' => 'SUBMITTED',
            'submitted_at' => now(),
        ]);
        app(\App\Services\Realtime::class)->lifecycle($attempt, 'ended');

        return response()->json([
            'success' => true,
            'message' => 'Bài thi đã được nộp thành công.',
        ]);
    }
}
