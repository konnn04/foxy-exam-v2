<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\FaceChangeRequest;
use App\Models\FaceEnrollToken;
use App\Support\BiometricPolicy;
use App\Support\FaceReference;
use App\Support\Notify;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The candidate's side of biometrics: the consent given at every login, change requests, and the phone enrolment link. */
class BiometricController extends Controller
{
    /** Public: the policy text (the client shows it before login completes, the web page renders the same sections). */
    public function policy(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => ['version' => BiometricPolicy::VERSION, 'sections' => BiometricPolicy::sections(), 'url' => url('/biometric-policy')]]);
    }

    public function status(Request $request): JsonResponse
    {
        $consent = BiometricPolicy::forRequest($request);

        return response()->json(['success' => true, 'data' => [
            'accepted' => $consent !== null || !$request->user()->currentAccessToken() instanceof \Laravel\Sanctum\PersonalAccessToken,
            'version' => BiometricPolicy::VERSION,
            'accepted_at' => $consent?->accepted_at?->toIso8601String(),
        ]]);
    }

    public function accept(Request $request): JsonResponse
    {
        $request->validate(['agree' => ['required', 'accepted']]);
        $consent = BiometricPolicy::record($request, $request->user(), (string) $request->input('source', 'login'));

        return response()->json(['success' => true, 'data' => ['version' => $consent->policy_version, 'accepted_at' => $consent->accepted_at->toIso8601String()]]);
    }

    /** POST /student/face/change-request — only for a locked photo, one pending request at a time. */
    public function requestChange(Request $request): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        $user = $request->user();
        if ($user->face_locked_at === null) {
            return response()->json(['success' => false, 'message' => 'Khuôn mặt của bạn chưa bị khoá, bạn có thể đăng ký lại ngay.'], 422);
        }
        if (FaceChangeRequest::where('user_id', $user->id)->where('status', 'PENDING')->exists()) {
            return response()->json(['success' => false, 'message' => 'Bạn đã có một yêu cầu đang chờ duyệt.'], 409);
        }
        $row = FaceChangeRequest::create(['user_id' => $user->id, 'reason' => trim($data['reason']), 'status' => 'PENDING']);
        if ($user->organization_id) {
            Notify::staff($user->organization_id, 'face_request', "{$user->name} xin đổi khuôn mặt", $row->reason, '/admin/faces?tab=requests');
        }

        return response()->json(['success' => true, 'message' => 'Đã gửi yêu cầu. Giảng viên sẽ duyệt và mở khoá cho bạn.', 'data' => ['id' => $row->id]], 201);
    }

    public function changeStatus(Request $request): JsonResponse
    {
        $row = FaceChangeRequest::where('user_id', $request->user()->id)->latest('id')->first();

        return response()->json(['success' => true, 'data' => $row ? ['status' => $row->status, 'reason' => $row->reason, 'note' => $row->decision_note, 'at' => $row->created_at?->toIso8601String()] : null]);
    }

    /** POST /student/face/phone-link — a QR link so the phone camera can take the photo. */
    public function phoneLink(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->face_locked_at !== null) {
            return response()->json(['success' => false, 'message' => 'Khuôn mặt đã được đăng ký và khoá. Gửi yêu cầu đổi khuôn mặt nếu cần thay.'], 423);
        }
        FaceEnrollToken::where('user_id', $user->id)->whereNull('used_at')->delete();
        $raw = FaceEnrollToken::generate();
        $row = FaceEnrollToken::create(['user_id' => $user->id, 'token_hash' => FaceEnrollToken::hash($raw), 'expires_at' => now()->addMinutes(FaceEnrollToken::TTL_MINUTES)]);

        return response()->json(['success' => true, 'data' => ['url' => url("/m/face/{$raw}"), 'expires_at' => $row->expires_at->toIso8601String()]]);
    }

    /** Whether the photo has arrived (the computer waits for the phone with this; no polling loop is forced on the client). */
    public function enrolled(Request $request): JsonResponse
    {
        $u = $request->user();

        return response()->json(['success' => true, 'data' => ['enrolled' => FaceReference::has($u), 'locked' => $u->face_locked_at !== null]]);
    }
}
