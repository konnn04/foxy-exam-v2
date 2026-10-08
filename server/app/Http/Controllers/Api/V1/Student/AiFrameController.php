<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\Violation;
use App\Services\AiService;
use App\Support\AttemptResolver;
use App\Support\FaceReference;
use App\Support\Risk;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A camera frame sent now and then by FoxyClient. The face service checks that it is still the same person as at
 * the start of the attempt, the object service looks for prohibited objects. Findings are stored as violations
 * that wait for a proctor (they are estimates, see App\Support\ViolationCatalog).
 */
class AiFrameController extends Controller
{
    /** @var int[] violations raised by the current request */
    private array $created = [];

    /** Same finding is not raised again within this many seconds. */
    private const COOLDOWN_S = 60;

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'frame' => ['required', 'file', 'mimetypes:image/jpeg,image/png', 'max:2048'],
            'evidence_id' => ['nullable', 'string', 'max:64'],
            'source' => ['nullable', 'in:camera,phone'],
        ]);
        $attempt = AttemptResolver::for($request);
        if (!$attempt) {
            return response()->json(['success' => false, 'message' => 'Không có phiên làm bài đang diễn ra.'], 404);
        }
        $cfg = $attempt->exam->monitoring_config ?? [];
        $phone = $request->input('source') === 'phone';
        // what each picture is checked for: identity only on the main camera, objects on the camera(s) the exam names
        $identity = !$phone && !empty($cfg['ai_identity']);
        $objects = $phone ? !empty($cfg['extra_camera_objects']) : !empty($cfg['ai_objects']);
        if ((!$identity && !$objects) || AiService::endpoints() === [] || AiService::getStatus() !== 'ONLINE') {
            return response()->json(['success' => true, 'checked' => false]);
        }

        $frame = (string) file_get_contents($request->file('frame')->getRealPath());
        $evidence = $request->input('evidence_id');
        $this->created = [];
        $out = ['success' => true, 'checked' => true, 'prohibited' => [], 'match' => null];

        if ($objects && ($found = AiService::detectObjects($frame)) && $found['prohibited'] !== []) {
            $out['prohibited'] = $found['prohibited'];
            $this->raise($attempt, 'PROHIBITED_DEVICE', 'HIGH', [
                'message' => ($phone ? 'Camera phụ phát hiện vật cấm: ' : 'Phát hiện vật cấm: ') . implode(', ', $found['prohibited']),
                'labels' => $found['prohibited'],
                'objects' => array_slice($found['objects'], 0, 10),
                'source' => $phone ? 'ai:objects:phone' : 'ai:objects',
            ], $evidence);
        }

        if ($identity) {
            $out['match'] = $this->checkIdentity($attempt, $frame, $evidence);
        }
        $out['violation_ids'] = $this->created; // the client uploads the picture and attaches it with evidence()

        return response()->json($out);
    }

    /** POST /student/ai/evidence: attach an uploaded picture to the violations the last frame raised. */
    public function evidence(Request $request): JsonResponse
    {
        $data = $request->validate(['violation_ids' => ['required', 'array', 'max:10'], 'violation_ids.*' => ['integer'], 'evidence_id' => ['required', 'string', 'max:64'], 'evidence' => ['nullable', 'array', 'max:6'], 'evidence.*' => ['string', 'max:64']]);
        $attempt = AttemptResolver::for($request, false);
        if (!$attempt) {
            return response()->json(['success' => false], 404);
        }
        $n = 0;
        foreach (Violation::whereIn('id', $data['violation_ids'])->where('exam_attempt_id', $attempt->id)->whereNull('evidence_id')->get() as $v) {
            $details = (array) $v->details;
            if (!empty($data['evidence'])) {
                $details['evidence'] = $data['evidence']; // screen / camera / phone pictures of the same moment
            }
            $v->update(['evidence_id' => $data['evidence_id'], 'details' => $details]);
            $n++;
        }

        return response()->json(['success' => true, 'attached' => $n]);
    }

    /** The camera picture must show the student whose face is enrolled. Students without an enrolled photo are not judged. */
    private function checkIdentity(ExamAttempt $attempt, string $frame, ?string $evidence): ?bool
    {
        $reference = FaceReference::bytes($attempt->user);
        if ($reference === null) {
            return null;
        }
        $result = AiService::verify($reference, $frame);
        if (!$result || ($result['match'] ?? null) === null) {
            return null; // no / several faces: the on-device checks report those
        }
        if ($result['match'] === false) {
            $this->raise($attempt, 'FACE_MISMATCH', 'HIGH', [
                'message' => 'Khuôn mặt khác với khuôn mặt đã đăng ký của sinh viên',
                'similarity' => $result['similarity'],
                'threshold' => $result['threshold'],
                'source' => 'ai:face',
            ], $evidence);
        }

        return (bool) $result['match'];
    }

    private function raise(ExamAttempt $attempt, string $type, string $severity, array $details, ?string $evidence): void
    {
        $recent = Violation::where('exam_attempt_id', $attempt->id)
            ->where('violation_type', $type)
            ->where('timestamp', '>=', now()->subSeconds(self::COOLDOWN_S))
            ->exists();
        if ($recent) {
            return;
        }
        $this->created[] = Violation::create([
            'exam_attempt_id' => $attempt->id,
            'violation_type' => $type,
            'severity' => $severity,
            'details' => $details,
            'evidence_id' => $evidence,
            'timestamp' => now(),
        ])->id;
        Risk::apply($attempt, Risk::weight($severity));
    }
}
