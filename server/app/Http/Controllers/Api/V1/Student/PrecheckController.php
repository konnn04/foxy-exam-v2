<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Support\Precheck;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Kiểm tra thiết bị trước khi vào thi (precheck), do máy chủ quyết định.
 *
 * FoxyClient gửi kết quả phòng chờ và thông tin môi trường (hệ điều hành, máy ảo, camera ảo, điều khiển từ xa,
 * số màn hình, thiết bị capture). Đạt thì nhận `precheck_token` dùng một lần cho `POST /exams/{exam}/start`.
 */
class PrecheckController extends Controller
{
    public function store(Request $request, Exam $exam): JsonResponse
    {
        $user = $request->user();
        if ($exam->course_id && !$user->enrolledCourses()->where('courses.id', $exam->course_id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Bạn chưa ghi danh vào môn học này.'], 403);
        }

        $v = $request->validate([
            'checks' => ['required', 'array'],
            'checks.*' => ['nullable', 'string', 'in:idle,checking,ok,warn,fail'],
            'env' => ['nullable', 'array'],
            'env.os_family' => ['nullable', 'string', 'in:windows,macos,linux'],
            'env.vm' => ['nullable', 'array'],
            'env.boot_time' => ['nullable', 'integer', 'min:0'],
            'env.displays' => ['nullable', 'integer', 'min:0', 'max:32'],
            'env.virtual_cameras' => ['nullable', 'array', 'max:20'],
            'env.capture_devices' => ['nullable', 'array', 'max:20'],
            'device_info' => ['nullable', 'array'],
        ]);

        [$row, $token] = Precheck::record($request, $user, $exam, $v['checks'], (array) $request->input('env', []), (array) ($v['device_info'] ?? []));

        if (!$token) {
            return response()->json([
                'success' => false,
                'error_code' => 'PRECHECK_FAILED',
                'message' => $row->reasons[0] ?? 'Máy chưa đạt yêu cầu để vào thi.',
                'reasons' => $row->reasons,
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data' => ['precheck_token' => $token, 'expires_at' => $row->expires_at->toIso8601String()],
        ]);
    }
}
