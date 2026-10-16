<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Violation;
use App\Services\Realtime;
use App\Support\AttemptResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The client records ~10 s of camera and screen around a violation, uploads them as evidence and then tells the core
 * which violation they belong to. The violation itself was reported earlier (it must not wait for the upload), so it is
 * found by type and time.
 */
class ViolationClipController extends Controller
{
    private const WINDOW_MS = 3000;

    public function attach(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'max:64'],
            'at_ms' => ['required', 'integer', 'min:1'],
            'clips' => ['required', 'array'],
            'clips.camera' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'clips.screen' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'from_ms' => ['nullable', 'integer'],
            'to_ms' => ['nullable', 'integer'],
        ]);
        $attempt = AttemptResolver::for($request);
        if (!$attempt) {
            return response()->json(['success' => false, 'message' => 'Phiên làm bài không tồn tại.'], 404);
        }
        $clips = array_filter(['camera' => $data['clips']['camera'] ?? null, 'screen' => $data['clips']['screen'] ?? null]);
        if (!$clips) {
            return response()->json(['success' => false, 'message' => 'Không có clip nào.'], 422);
        }

        $at = \Carbon\Carbon::createFromTimestampMs($data['at_ms']);
        $violation = Violation::withoutGlobalScope('counted')->where('exam_attempt_id', $attempt->id)->where('violation_type', $data['type'])
            ->whereBetween('timestamp', [$at->copy()->subMilliseconds(self::WINDOW_MS), $at->copy()->addMilliseconds(self::WINDOW_MS)])
            ->get()->sortBy(fn ($v) => abs($v->timestamp->getTimestampMs() - $data['at_ms']))->first();
        if (!$violation) {
            return response()->json(['success' => false, 'message' => 'Chưa thấy vi phạm tương ứng.', 'retry' => true], 404);
        }

        $details = (array) $violation->details;
        $details['clips'] = array_merge((array) ($details['clips'] ?? []), $clips);
        if (isset($data['from_ms'], $data['to_ms'])) {
            $details['clip_range'] = ['from_ms' => $data['from_ms'], 'to_ms' => $data['to_ms']];
        }
        $violation->update(['details' => $details]);
        app(Realtime::class)->signal($attempt, ['field' => 'ev', 'value' => $violation->id]);

        return response()->json(['success' => true, 'violation_id' => $violation->id]);
    }
}
