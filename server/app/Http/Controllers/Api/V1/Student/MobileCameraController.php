<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\MobileCameraToken;
use App\Models\User;
use App\Services\AiService;
use App\Services\Realtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The phone as an extra camera. The candidate's computer asks for a link (shown as a QR code) in the lobby; the phone
 * opens it, exchanges the token for LiveKit credentials and publishes its camera. The token belongs to (student, exam)
 * until the attempt starts and is then bound to that attempt.
 */
class MobileCameraController extends Controller
{
    public const TTL_HOURS = 8;

    public function __construct(private Realtime $realtime)
    {
    }

    /** Called when an attempt is created or resumed: the lobby's phone link now belongs to this attempt. */
    public static function bind(User $user, Exam $exam, ExamAttempt $attempt): bool
    {
        return MobileCameraToken::where('user_id', $user->id)->where('exam_id', $exam->id)
            ->whereNull('attempt_id')->where('expires_at', '>', now())
            ->update(['attempt_id' => $attempt->id]) > 0;
    }

    /** POST /student/exams/{exam}/mobile-camera: a fresh link (any earlier unused one stops working). */
    public function issue(Request $request, Exam $exam): JsonResponse
    {
        $user = $request->user();
        if (($exam->monitoring_config['extra_camera'] ?? 'off') === 'off') {
            return response()->json(['success' => false, 'message' => 'Kỳ thi này không dùng camera mở rộng.'], 422);
        }
        MobileCameraToken::where('user_id', $user->id)->where('exam_id', $exam->id)->whereNull('attempt_id')->delete();

        $raw = MobileCameraToken::generate();
        $row = MobileCameraToken::create([
            'user_id' => $user->id,
            'exam_id' => $exam->id,
            'token_hash' => MobileCameraToken::hash($raw),
            'expires_at' => now()->addHours(self::TTL_HOURS),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'url' => url("/m/camera/{$raw}"),
                'expires_at' => $row->expires_at->toIso8601String(),
                // the lobby joins the room the phone publishes into, to show its preview and to tell it when the exam starts
                'viewer' => $this->realtime->lobbyViewerCredentials($user, $exam),
            ],
        ]);
    }

    /** POST /student/exams/{exam}/mobile-camera/verify (multipart frame): is the candidate and the laptop in the phone's picture? */
    public function verify(Request $request, Exam $exam): JsonResponse
    {
        $request->validate(['frame' => ['required', 'file', 'mimetypes:image/jpeg,image/png', 'max:4096']]);
        if (AiService::endpoints() === [] || AiService::getStatus() !== 'ONLINE') {
            return response()->json(['success' => true, 'ok' => true, 'skipped' => true, 'message' => 'Chưa có dịch vụ AI để kiểm tra góc đặt điện thoại.']);
        }
        $result = AiService::detectObjects((string) file_get_contents($request->file('frame')->getRealPath()), 0.35);
        if (!$result) {
            return response()->json(['success' => true, 'ok' => true, 'skipped' => true, 'message' => 'Không kiểm tra được góc đặt điện thoại lúc này.']);
        }
        $labels = collect($result['objects'])->pluck('label');
        $person = $labels->contains('person');
        $laptop = $labels->intersect(['laptop', 'tv'])->isNotEmpty();
        $problem = !$person && !$laptop ? 'no_person_no_laptop' : (!$person ? 'no_person' : (!$laptop ? 'no_laptop' : null));

        return response()->json([
            'success' => true,
            'ok' => $problem === null,
            'problem' => $problem,
            'message' => match ($problem) {
                'no_person_no_laptop' => 'Không thấy bạn và laptop trong khung hình. Đặt điện thoại ở góc bàn nhìn chéo vào cả hai.',
                'no_person' => 'Không thấy bạn trong khung hình của điện thoại.',
                'no_laptop' => 'Không thấy laptop trong khung hình. Điều chỉnh góc đặt điện thoại.',
                default => 'Góc đặt điện thoại phù hợp.',
            },
        ]);
    }
}
