<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\SubmitCodeRequest;
use App\Models\ExamAttempt;
use App\Models\ProgrammingProblem;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubmissionController extends Controller
{
    /**
     * Nộp bài giải lập trình và chấm điểm tự động.
     * 
     * Ghi nhận mã nguồn nộp bài của sinh viên cho một bài toán lập trình cụ thể trong phiên thi đang hoạt động, khởi tạo trạng thái chấm PENDING.
     */
    public function submitCode(SubmitCodeRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $attempt = \App\Support\AttemptResolver::for($request);

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'Phiên làm bài không hợp lệ hoặc đã kết thúc.',
            ], 404);
        }

        $problem = ProgrammingProblem::with('testCases')->findOrFail($validated['programming_problem_id']);

        // Check if language is allowed
        if (!empty($problem->allowed_languages) && !in_array($validated['language'], $problem->allowed_languages)) {
            return response()->json([
                'success' => false,
                'message' => 'Ngôn ngữ lập trình không được hỗ trợ cho bài toán này.',
            ], 422);
        }

        $totalCases = $problem->testCases->count();

        // Create submission entry
        $submission = Submission::create([
            'exam_attempt_id' => $attempt->id,
            'programming_problem_id' => $problem->id,
            'language' => $validated['language'],
            'source_code' => $validated['source_code'],
            'passed_cases_count' => 0,
            'total_cases_count' => $totalCases,
            'status' => 'PENDING',
            'submitted_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Mã nguồn đã được ghi nhận thành công.',
            'data' => [
                'submission_id' => $submission->id,
                'status' => $submission->status,
                'submitted_at' => $submission->submitted_at,
            ],
        ]);
    }

    /**
     * Lấy lịch sử các lần nộp bài lập trình của lượt thi hiện tại.
     * 
     * Trả về danh sách tất cả các bài giải đã nộp, trạng thái chấm điểm (PENDING, GRADED), số lượng test case vượt qua và điểm số đạt được.
     */
    public function getHistory(Request $request): JsonResponse
    {
        $attempt = \App\Support\AttemptResolver::for($request, false);

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy bài làm.',
            ], 404);
        }

        $submissions = $attempt->submissions()->with('problem:id,title')->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $submissions,
        ]);
    }
}
