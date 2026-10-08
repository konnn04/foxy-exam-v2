<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\Violation;
use App\Services\AiService;
use App\Support\AttemptResolver;
use App\Support\Risk;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
        ]);
        $attempt = AttemptResolver::for($request);
        if (!$attempt) {
            return response()->json(['success' => false, 'message' => 'Không có phiên làm bài đang diễn ra.'], 404);
        }
        $exam = $attempt->exam;
        if (empty(($exam->monitoring_config ?? [])['ai_face_check']) || AiService::endpoints() === [] || AiService::getStatus() !== 'ONLINE') {
            return response()->json(['success' => true, 'checked' => false]);
        }

        $frame = (string) file_get_contents($request->file('frame')->getRealPath());
        $evidence = $request->input('evidence_id');
        $this->created = [];
        $out = ['success' => true, 'checked' => true, 'prohibited' => [], 'match' => null];

        $objects = AiService::detectObjects($frame);
        if ($objects && $objects['prohibited'] !== []) {
            $out['prohibited'] = $objects['prohibited'];
            $this->raise($attempt, 'PROHIBITED_DEVICE', 'HIGH', [
                'message' => 'Phát hiện vật cấm: ' . implode(', ', $objects['prohibited']),
                'labels' => $objects['prohibited'],
                'objects' => array_slice($objects['objects'], 0, 10),
                'source' => 'ai:objects',
            ], $evidence);
        }

        $out['match'] = $this->checkIdentity($attempt, $frame, $evidence);
        $out['violation_ids'] = $this->created; // the client uploads the picture and attaches it with evidence()

        return response()->json($out);
    }

    /** POST /student/ai/evidence: attach an uploaded picture to the violations the last frame raised. */
    public function evidence(Request $request): JsonResponse
    {
        $data = $request->validate(['violation_ids' => ['required', 'array', 'max:10'], 'violation_ids.*' => ['integer'], 'evidence_id' => ['required', 'string', 'max:64']]);
        $attempt = AttemptResolver::for($request, false);
        if (!$attempt) {
            return response()->json(['success' => false], 404);
        }
        $n = Violation::whereIn('id', $data['violation_ids'])->where('exam_attempt_id', $attempt->id)->whereNull('evidence_id')->update(['evidence_id' => $data['evidence_id']]);

        return response()->json(['success' => true, 'attached' => $n]);
    }

    /** The first single-face frame of the attempt becomes the reference; later frames must match it. */
    private function checkIdentity(ExamAttempt $attempt, string $frame, ?string $evidence): ?bool
    {
        $disk = Storage::disk('local');
        $path = "ai-reference/{$attempt->id}.jpg";

        if (!$disk->exists($path)) {
            $faces = AiService::faces($frame);
            if ($faces && ($faces['count'] ?? 0) === 1) {
                $disk->put($path, $frame);
            }

            return null;
        }

        $result = AiService::verify((string) $disk->get($path), $frame);
        if (!$result || ($result['match'] ?? null) === null) {
            return null; // no / several faces: the on-device checks report those
        }
        if ($result['match'] === false) {
            $this->raise($attempt, 'FACE_MISMATCH', 'HIGH', [
                'message' => 'Khuôn mặt khác với khuôn mặt lúc bắt đầu bài thi',
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
