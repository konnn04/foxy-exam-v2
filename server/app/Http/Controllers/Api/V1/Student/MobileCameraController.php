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
        $row = MobileCameraToken::where('user_id', $user->id)
            ->where('exam_id', $exam->id)
            ->where(fn ($q) => $q->whereNull('attempt_id')->orWhere('attempt_id', $attempt->id))
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();
        if (!$row) {
            return false;
        }
        if ($row->attempt_id !== $attempt->id) {
            $row->update(['attempt_id' => $attempt->id]);
        }
        // Retire older tokens for this student + exam so viewer() always picks the active bound token
        MobileCameraToken::where('user_id', $user->id)
            ->where('exam_id', $exam->id)
            ->where('id', '!=', $row->id)
            ->delete();
        if ($row->relay_ack_at) {
            app(Realtime::class)->startPhoneRecording($attempt); // the phone is already publishing: record from the start
        }

        return true;
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
                // the computer watches the phone through this room (lobby preview now, the exam window later)
                'viewer' => $this->realtime->phoneViewerCredentials($user, $exam),
            ],
        ]);
    }

    /** GET /student/exams/{exam}/mobile-camera: credentials to watch an already linked phone (the exam window uses it). */
    public function viewer(Request $request, Exam $exam): JsonResponse
    {
        $row = MobileCameraToken::where('user_id', $request->user()->id)->where('exam_id', $exam->id)->where('expires_at', '>', now())->latest('id')->first();
        if (!$row || !$row->isValid()) {
            return response()->json(['success' => true, 'data' => null]);
        }

        return response()->json(['success' => true, 'data' => ['viewer' => $this->realtime->phoneViewerCredentials($request->user(), $exam), 'connected' => $row->relay_ack_at !== null]]);
    }

    /** POST /student/exams/{exam}/mobile-camera/verify (multipart frame): is the candidate and the laptop in the phone's picture? */
    public function verify(Request $request, Exam $exam): JsonResponse
    {
        $request->validate(['frame' => ['required', 'file', 'mimetypes:image/jpeg,image/png', 'max:4096']]);
        $bytes = (string) file_get_contents($request->file('frame')->getRealPath());

        // 1. Basic image geometry & brightness check (catches covered camera, black frame, or portrait frame)
        $img = @imagecreatefromstring($bytes);
        if ($img !== false) {
            $w = imagesx($img);
            $h = imagesy($img);
            if ($h > $w) {
                imagedestroy($img);
                return response()->json([
                    'success' => true,
                    'ok' => false,
                    'problem' => 'portrait',
                    'message' => 'Điện thoại đang đặt dọc. Vui lòng xoay ngang điện thoại (Landscape) để bao quát cả người và màn hình laptop.',
                ]);
            }
            // Sample 8x6 grid for luminance & variance
            $sum = 0.0;
            $sqSum = 0.0;
            $count = 0;
            for ($y = 0; $y < 6; $y++) {
                for ($x = 0; $x < 8; $x++) {
                    $px = (int) (($x + 0.5) * $w / 8);
                    $py = (int) (($y + 0.5) * $h / 6);
                    $rgb = imagecolorat($img, $px, $py);
                    $r = ($rgb >> 16) & 0xFF;
                    $g = ($rgb >> 8) & 0xFF;
                    $b = $rgb & 0xFF;
                    $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b;
                    $sum += $lum;
                    $sqSum += $lum * $lum;
                    $count++;
                }
            }
            imagedestroy($img);
            $mean = $sum / max(1, $count);
            $std = sqrt(max(0.0, ($sqSum / max(1, $count)) - ($mean * $mean)));
            if ($mean < 16 || $std < 7) {
                return response()->json([
                    'success' => true,
                    'ok' => false,
                    'problem' => 'camera_covered_or_dark',
                    'message' => $mean < 16
                        ? 'Khung hình từ điện thoại quá tối hoặc bị che khuất. Hãy bật đèn và bỏ vật chắn camera.'
                        : 'Khung hình từ điện thoại bị mờ hoặc chỉ chiếu vào một mặt phẳng đồng màu (bàn/tường). Hãy đặt điện thoại nhìn chéo vào bạn và laptop.',
                ]);
            }
        }

        if (AiService::endpoints() === [] || !AiService::serviceOnline('objects')) {
            return response()->json(['success' => true, 'ok' => true, 'skipped' => true, 'message' => 'Khung hình ngang hợp lệ (chế độ kiểm tra cục bộ).']);
        }
        $result = AiService::detectObjects($bytes, 0.30);
        if (!$result) {
            return response()->json(['success' => true, 'ok' => true, 'skipped' => true, 'message' => 'Khung hình ngang hợp lệ (bỏ qua AI đối tượng tạm thời).']);
        }
        $objects = collect($result['objects'] ?? []);
        $labels = $objects->pluck('label');
        $personObj = $objects->firstWhere('label', 'person');
        $laptopObj = $objects->first(fn ($o) => in_array($o['label'] ?? '', ['laptop', 'tv', 'monitor'], true));
        $person = $personObj !== null;
        $laptop = $laptopObj !== null;
        $problem = !$person && !$laptop ? 'no_person_no_laptop' : (!$person ? 'no_person' : (!$laptop ? 'no_laptop' : null));

        return response()->json([
            'success' => true,
            'ok' => $problem === null,
            'problem' => $problem,
            'objects' => $labels->values()->all(),
            'message' => match ($problem) {
                'no_person_no_laptop' => 'Không thấy thí sinh và laptop trong khung hình. Đặt điện thoại nằm ngang ở góc bàn nhìn chéo (90°) vào cả hai.',
                'no_person' => 'Đã thấy laptop nhưng chưa thấy rõ thí sinh trong khung hình của điện thoại. Hãy lùi điện thoại ra xa hơn một chút.',
                'no_laptop' => 'Đã thấy thí sinh nhưng chưa thấy màn hình laptop trong khung hình. Hãy xoay góc điện thoại để thấy cả hai tay và màn hình laptop.',
                default => 'Góc đặt điện thoại hợp lệ: đã nhận diện rõ thí sinh và màn hình laptop.',
            },
        ]);
    }
}
