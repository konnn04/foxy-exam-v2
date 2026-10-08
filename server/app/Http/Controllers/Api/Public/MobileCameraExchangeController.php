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
     * Credentials for the phone's private room. The room is the same before and during the exam, so the phone never
     * has to move: `state` only says whether the attempt has started. Callable any number of times (reconnects).
     */
    public function exchange(string $token): JsonResponse
    {
        $row = $this->find($token);
        if (!$row) {
            return $this->gone();
        }

        return response()->json(['state' => $row->attempt_id ? 'exam' : 'lobby', 'livekit' => $this->realtime->phoneCredentials($row->user, $row->exam)]);
    }

    /** The phone finished publishing: the computer's lobby may continue. */
    public function ack(string $token): JsonResponse
    {
        $row = $this->find($token);
        if (!$row) {
            return $this->gone();
        }
        $row->update(['relay_ack_at' => now()]);
        if ($row->attempt) {
            $this->realtime->startPhoneRecording($row->attempt); // idempotent: a reconnect never starts a second recording
        }

        return response()->json(['ok' => true]);
    }
}
