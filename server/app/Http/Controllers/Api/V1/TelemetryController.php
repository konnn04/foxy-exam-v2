<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\RecordOpLogRequest;
use App\Http\Requests\Api\V1\Student\RecordViolationRequest;
use App\Models\EditOpLog;
use App\Models\ExamAttempt;
use App\Models\Violation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class TelemetryController extends Controller
{
    /**
     * Ghi nhận nhật ký gõ phím và thao tác biên tập (Keystroke Dynamics Op-Log).
     * 
     * Tiếp nhận luồng dữ liệu thao tác từ trình soạn thảo mã nguồn, tự động phân tích hành vi dán lượng lớn code (Bulk paste) hoặc chèn mã bất thường từ AI.
     */
    public function recordOpLog(RecordOpLogRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $attempt = ExamAttempt::where('user_id', $request->user()->id)
            ->where('status', 'IN_PROGRESS')
            ->latest()
            ->first();

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'Phiên làm bài không tồn tại hoặc đã kết thúc.',
            ], 404);
        }

        // 1. Save Op Log batch
        $log = EditOpLog::create([
            'exam_attempt_id' => $attempt->id,
            'programming_problem_id' => $validated['programming_problem_id'] ?? null,
            'batch_seq' => $validated['batch_seq'],
            'keystroke_count' => $validated['keystroke_count'],
            'paste_event_count' => $validated['paste_event_count'],
            'synthetic_flags' => $validated['synthetic_flags'] ?? null,
            'raw_ops_payload' => $validated['raw_ops_payload'] ?? null,
        ]);

        // 2. Anti-cheat analysis: Detect Bulk Paste or AI Code Injection
        $flags = $validated['synthetic_flags'] ?? [];
        $isBulkPaste = ($validated['paste_event_count'] > 0) || !empty($flags['bulk_insert']);

        if ($isBulkPaste) {
            $charsCount = $flags['chars_count'] ?? 0;
            
            Violation::create([
                'exam_attempt_id' => $attempt->id,
                'violation_type' => 'BULK_PASTE',
                'severity' => $charsCount > 100 ? 'CRITICAL' : 'HIGH',
                'details' => [
                    'message' => 'Phát hiện hành vi dán một lượng lớn mã nguồn bất thường vào bài làm.',
                    'paste_event_count' => $validated['paste_event_count'],
                    'flags' => $flags,
                ],
                'timestamp' => now(),
            ]);

            $scoreInc = $charsCount > 100 ? 50 : 25;
            $attempt->increment('risk_score', $scoreInc);
            if ($attempt->risk_score >= 40) {
                $attempt->update(['is_flagged' => true]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Đã ghi nhận op log.',
            'log_id' => $log->id,
        ]);
    }

    /**
     * Ghi nhận sự kiện vi phạm an ninh phòng thi (Security Violation Event).
     * 
     * Lưu lại các hành vi đáng ngờ được Client phát hiện như chuyển tab (Tab switch), bật DevTools, cắm thiết bị cấm, hoặc AI phát hiện gian lận.
     */
    public function recordViolation(RecordViolationRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $attempt = ExamAttempt::where('user_id', $request->user()->id)
            ->where('status', 'IN_PROGRESS')
            ->latest()
            ->first();

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'Phiên làm bài không tồn tại.',
            ], 404);
        }

        $violation = Violation::create([
            'exam_attempt_id' => $attempt->id,
            'violation_type' => $validated['violation_type'],
            'severity' => $validated['severity'],
            'details' => $validated['details'] ?? [],
            'evidence_url' => $validated['evidence_url'] ?? null,
            'timestamp' => now(),
        ]);

        // Accumulate risk score based on severity
        $scoreWeight = match ($validated['severity']) {
            'LOW' => 5,
            'MEDIUM' => 15,
            'HIGH' => 30,
            'CRITICAL' => 60,
            default => 10,
        };

        $attempt->increment('risk_score', $scoreWeight);
        if ($attempt->risk_score >= 40) {
            $attempt->update(['is_flagged' => true]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Đã ghi nhận vi phạm.',
            'violation_id' => $violation->id,
            'current_risk_score' => $attempt->risk_score,
            'is_flagged' => $attempt->is_flagged,
        ]);
    }

    /**
     * Kiểm tra trạng thái máy chủ AI Worker giám sát.
     * 
     * Proxy kiểm tra kết nối trực tiếp tới máy chủ AI Worker chuyên trách phân tích khuôn mặt và chống gian lận qua Cloudflare Tunnel.
     */
    public function aiStatusProxy(): JsonResponse
    {
        $status = \App\Services\AiService::getStatus();
        $isAvailable = \App\Services\AiService::isAvailable();

        if ($status === 'UNCONFIGURED') {
            return response()->json([
                'status' => 'UNCONFIGURED',
                'is_available' => false,
                'message' => 'Chưa cấu hình domain Cloudflare Tunnel hoặc địa chỉ cho AI Worker.',
            ]);
        }

        if ($status === 'ONLINE') {
            return response()->json([
                'status' => 'ONLINE',
                'is_available' => true,
                'message' => 'Máy chủ AI Worker đang hoạt động bình thường.',
            ]);
        }

        return response()->json([
            'status' => 'OFFLINE',
            'is_available' => false,
            'message' => 'Laptop AI Worker đang tắt hoặc không có kết nối. Các tính năng thi yêu cầu AI sẽ bị khóa.',
        ], 503);
    }

    /**
     * Kiểm tra trạng thái máy chủ (Health Check).
     * 
     * Kiểm tra tình trạng hoạt động của FoxyExam Core Server API và trả về phiên bản cùng thời gian hiện tại.
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'OK',
            'system' => 'FoxyExam Core Server',
            'version' => '2.0.0',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
