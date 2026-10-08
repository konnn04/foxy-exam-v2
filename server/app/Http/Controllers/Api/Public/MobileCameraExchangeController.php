<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\MobileCameraToken;
use App\Services\Realtime;
use Illuminate\Http\JsonResponse;

/** Endpoints the phone page calls with the token from the QR link (no login: the token is the credential). */
class MobileCameraExchangeController extends Controller
{
    public function __construct(private Realtime $realtime)
    {
    }

    private function find(string $token): ?MobileCameraToken
    {
        $row = MobileCameraToken::findByRaw($token);

        return $row && $row->isValid() ? $row->load(['user', 'exam', 'attempt']) : null;
    }

    private function gone(): JsonResponse
    {
        return response()->json(['message' => 'Liên kết không hợp lệ hoặc phiên thi đã kết thúc.', 'code' => 'token_invalid'], 410);
    }

    /**
     * state "lobby": publish into the private lobby room. state "exam": the attempt started, publish into the exam room
     * as attempt-N-mobile and upload snapshots (the `snapshots` block). Callable any number of times.
     */
    public function exchange(string $token): JsonResponse
    {
        $row = $this->find($token);
        if (!$row) {
            return $this->gone();
        }

        if ($row->attempt) {
            $attempt = $row->attempt;
            $ttl = max(900, (int) $attempt->started_at?->diffInSeconds(now(), true) + $attempt->exam->duration_minutes * 60 + 900);
            $creds = $this->realtime->phoneExamCredentials($attempt, $ttl);
            $record = rtrim((string) config('services.realtime.record_url'), '/');

            return response()->json([
                'state' => 'exam',
                'livekit' => $creds,
                'snapshots' => [
                    'presign_url' => $record . '/v1/evidence/presign',
                    'commit_url' => $record . '/v1/evidence/{id}/commit',
                    'content_base' => $record,
                    'token' => $this->realtime->candidateToken($attempt, $ttl),
                    'interval_ms' => 20_000,
                ],
            ]);
        }

        return response()->json(['state' => 'lobby', 'livekit' => $this->realtime->phoneLobbyCredentials($row->user, $row->exam)]);
    }

    /** The phone finished publishing: the computer's lobby may continue. */
    public function ack(string $token): JsonResponse
    {
        $row = $this->find($token);
        if (!$row) {
            return $this->gone();
        }
        if (!$row->relay_ack_at) {
            $row->update(['relay_ack_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }

    /** Cheap state check for the phone page: lets it notice that the exam started (lobby -> exam) or ended. */
    public function state(string $token): JsonResponse
    {
        $row = $this->find($token);

        return response()->json(['active' => $row !== null, 'state' => $row?->attempt_id ? 'exam' : 'lobby']);
    }
}
