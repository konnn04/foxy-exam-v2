<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\FaceEnrollToken;
use App\Support\FaceReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The phone page behind the QR code of the face enrolment: the single-use token is the credential. */
class FaceEnrollPhoneController extends Controller
{
    private function gone(): JsonResponse
    {
        return response()->json(['message' => 'Liên kết đã hết hạn hoặc đã được dùng. Tạo mã QR mới trên máy tính.', 'code' => 'token_invalid'], 410);
    }

    public function info(string $token): JsonResponse
    {
        $row = FaceEnrollToken::findValid($token)?->load('user');

        return $row ? response()->json(['name' => $row->user->name, 'expires_at' => $row->expires_at->toIso8601String()]) : $this->gone();
    }

    public function submit(Request $request, string $token): JsonResponse
    {
        $request->validate(['frame' => ['required', 'file', 'mimetypes:image/jpeg,image/png', 'max:6144']]);
        $row = FaceEnrollToken::findValid($token)?->load('user');
        if (!$row) {
            return $this->gone();
        }
        $user = $row->user;
        if ($user->face_locked_at !== null) {
            return response()->json(['message' => 'Khuôn mặt đã được đăng ký và khoá.'], 423);
        }
        $result = FaceReference::enroll($user, (string) file_get_contents($request->file('frame')->getRealPath()));
        if (!$result['ok']) {
            return response()->json(['message' => $result['message']], 422);
        }
        $user->forceFill(['face_locked_at' => now()])->save();
        $row->update(['used_at' => now()]);

        return response()->json(['message' => 'Đã lưu khuôn mặt. Bạn có thể quay lại máy tính.']);
    }
}
