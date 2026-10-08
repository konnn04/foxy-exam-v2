<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Support\FaceReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A student registers their own face photo from the camera (once; staff unlock to change it). */
class FaceEnrollmentController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $u = $request->user();

        return response()->json(['success' => true, 'data' => ['enrolled' => FaceReference::has($u), 'locked' => $u->face_locked_at !== null, 'enrolled_at' => $u->face_enrolled_at?->toIso8601String()]]);
    }

    public function enroll(Request $request): JsonResponse
    {
        $request->validate(['frame' => ['required', 'file', 'mimetypes:image/jpeg,image/png', 'max:4096']]);
        $user = $request->user();
        if ($user->face_locked_at !== null) {
            return response()->json(['success' => false, 'message' => 'Khuôn mặt của bạn đã được đăng ký và khoá. Liên hệ giảng viên để đăng ký lại.'], 423);
        }
        $result = FaceReference::enroll($user, (string) file_get_contents($request->file('frame')->getRealPath()));
        if (!$result['ok']) {
            return response()->json(['success' => false, 'message' => $result['message']], 422);
        }
        $user->forceFill(['face_locked_at' => now()])->save();

        return response()->json(['success' => true, 'message' => $result['message']]);
    }
}
