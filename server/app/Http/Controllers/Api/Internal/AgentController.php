<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Support\FaceReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What the supervisor agent (ai/supervisor-agent) needs to know about an attempt: is it still running, which AI checks
 * the exam asks for, and the student's reference face. It writes violations through the normal bulk endpoint.
 * HMAC-signed like every internal call.
 */
class AgentController extends Controller
{
    private function describe(ExamAttempt $a): array
    {
        $cfg = $a->exam->monitoring_config ?? [];
        $phone = ($cfg['extra_camera'] ?? 'off') !== 'off';

        return [
            'attempt_id' => $a->id,
            'exam_id' => $a->exam_id,
            'user_id' => $a->user_id,
            'org_id' => (int) $a->exam->organization_id,
            'running' => $a->status === 'IN_PROGRESS' && $a->voided_at === null,
            'config' => [
                'ai_objects' => !empty($cfg['ai_face_check']) && !empty($cfg['ai_objects']),
                'ai_identity' => !empty($cfg['ai_face_check']) && !empty($cfg['ai_identity']),
                'extra_camera_objects' => $phone && !empty($cfg['extra_camera_objects']),
            ],
            'has_reference' => FaceReference::has($a->user),
        ];
    }

    public function attempt(int $id): JsonResponse
    {
        $a = ExamAttempt::with(['exam', 'user'])->find($id);

        return $a ? response()->json($this->describe($a)) : response()->json(['message' => 'unknown attempt'], 404);
    }

    /** The phone room is named after (student, exam): find the attempt it belongs to. */
    public function lookup(Request $request): JsonResponse
    {
        $a = ExamAttempt::with(['exam', 'user'])
            ->where('user_id', (int) $request->query('user'))->where('exam_id', (int) $request->query('exam'))
            ->where('status', 'IN_PROGRESS')->orderByDesc('id')->first();

        return $a ? response()->json($this->describe($a)) : response()->json(['message' => 'no running attempt'], 404);
    }

    public function faceReference(int $id)
    {
        $a = ExamAttempt::with('user')->find($id);
        $bytes = $a ? FaceReference::bytes($a->user) : null;

        return $bytes === null ? response()->json(['message' => 'no reference'], 404) : response($bytes, 200, ['Content-Type' => 'image/jpeg']);
    }
}
