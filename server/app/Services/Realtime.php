<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Bridge to the realtime plane (Go services in /realtime): mints the short-lived tokens FoxyClient and the
 * proctor UI use, verifies/creates the HMAC signature of service-to-service calls and tells the ingest
 * gateway about attempt lifecycle changes. The realtime services never query this database: everything
 * they need is in a token, everything they produce comes back through the signed bulk endpoint.
 */
class Realtime
{
    public function enabled(): bool
    {
        return (string) config('services.realtime.jwt_secret') !== '';
    }

    private static function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private function jwt(array $claims, string $secret): string
    {
        $in = self::b64('{"alg":"HS256","typ":"JWT"}') . '.' . self::b64(json_encode($claims, JSON_UNESCAPED_SLASHES));

        return $in . '.' . self::b64(hash_hmac('sha256', $in, $secret, true));
    }

    /** Candidate token: bound to ONE attempt, valid until the exam can no longer be running. */
    public function candidateToken(ExamAttempt $attempt, int $ttlSeconds): string
    {
        $now = time();

        return $this->jwt([
            'role' => 'candidate',
            'aid' => $attempt->id,
            'eid' => $attempt->exam_id,
            'uid' => $attempt->user_id,
            'oid' => (int) $attempt->exam->organization_id,
            'iat' => $now,
            'exp' => $now + max(60, $ttlSeconds),
        ], (string) config('services.realtime.jwt_secret'));
    }

    /** Proctor token: may watch / command / read recordings of the listed exams of one organization. */
    public function proctorToken(User $user, int $orgId, array $examIds, int $ttlSeconds = 3600): string
    {
        $now = time();

        return $this->jwt([
            'role' => 'proctor',
            'uid' => $user->id,
            'oid' => $orgId,
            'eids' => array_values(array_map('intval', $examIds)),
            'iat' => $now,
            'exp' => $now + $ttlSeconds,
        ], (string) config('services.realtime.jwt_secret'));
    }

    /** LiveKit access token: a candidate publishes camera/screen to its exam room and may not subscribe to anyone. */
    public function liveKitToken(ExamAttempt $attempt, int $ttlSeconds): ?array
    {
        $key = (string) config('services.realtime.livekit.api_key');
        $secret = (string) config('services.realtime.livekit.api_secret');
        $url = (string) config('services.realtime.livekit.url');
        if ($key === '' || $secret === '' || $url === '') {
            return null;
        }
        $room = 'exam-' . $attempt->exam_id;
        $identity = 'attempt-' . $attempt->id;
        $now = time();

        return [
            'url' => $url,
            'room' => $room,
            'identity' => $identity,
            'token' => $this->jwt([
                'iss' => $key,
                'sub' => $identity,
                'name' => $attempt->user->name ?? $identity,
                'nbf' => $now - 5,
                'exp' => $now + max(60, $ttlSeconds),
                'metadata' => json_encode(['oid' => (int) $attempt->exam->organization_id, 'role' => 'candidate']),
                'video' => [
                    'room' => $room, 'roomJoin' => true,
                    'canPublish' => true, 'canSubscribe' => false, 'canPublishData' => false,
                ],
            ], $secret),
        ];
    }

    // ------------------------------------------------------------------ phone as a second camera

    private function lk(string $room, string $identity, string $name, array $grants, array $meta, int $ttl): ?array
    {
        $key = (string) config('services.realtime.livekit.api_key');
        $secret = (string) config('services.realtime.livekit.api_secret');
        $url = (string) config('services.realtime.livekit.url');
        if ($key === '' || $secret === '' || $url === '') {
            return null;
        }
        $now = time();

        return [
            'url' => $url,
            'room' => $room,
            'identity' => $identity,
            'token' => $this->jwt([
                'iss' => $key, 'sub' => $identity, 'name' => $name,
                'nbf' => $now - 5, 'exp' => $now + max(60, $ttl),
                'metadata' => json_encode($meta),
                'video' => ['room' => $room, 'roomJoin' => true] + $grants,
            ], $secret),
        ];
    }

    public static function lobbyRoom(int $userId, int $examId): string
    {
        return "lobby-{$userId}-{$examId}";
    }

    /** The phone while the candidate is still in the lobby: it publishes its camera into a private room. */
    public function phoneLobbyCredentials(User $user, Exam $exam): ?array
    {
        return $this->lk(self::lobbyRoom($user->id, $exam->id), 'phone', 'Điện thoại', ['canPublish' => true, 'canSubscribe' => true, 'canPublishData' => false], ['role' => 'phone-lobby'], 3600);
    }

    /** The lobby of the computer: sees the phone preview and tells it when the exam has started. */
    public function lobbyViewerCredentials(User $user, Exam $exam): ?array
    {
        return $this->lk(self::lobbyRoom($user->id, $exam->id), 'viewer-' . $user->id, $user->name ?? 'viewer', ['canPublish' => false, 'canSubscribe' => true, 'canPublishData' => true], ['role' => 'lobby-viewer'], 3600);
    }

    /** The phone during the exam: same room as the candidate, identity attempt-N-mobile (the record service records it as camera2). */
    public function phoneExamCredentials(ExamAttempt $attempt, int $ttl): ?array
    {
        return $this->lk('exam-' . $attempt->exam_id, 'attempt-' . $attempt->id . '-mobile', 'Điện thoại', ['canPublish' => true, 'canSubscribe' => false, 'canPublishData' => false], ['oid' => (int) $attempt->exam->organization_id, 'role' => 'candidate'], $ttl);
    }

    /** LiveKit token for a proctor: hidden, subscribe-only, limited to the exam's room. */
    public function proctorLiveKitToken(User $user, \App\Models\Exam $exam, int $ttlSeconds = 3600): ?array
    {
        $key = (string) config('services.realtime.livekit.api_key');
        $secret = (string) config('services.realtime.livekit.api_secret');
        $url = (string) config('services.realtime.livekit.url');
        if ($key === '' || $secret === '' || $url === '') {
            return null;
        }
        $room = 'exam-' . $exam->id;
        $identity = 'proctor-' . $user->id . '-' . bin2hex(random_bytes(3));
        $now = time();

        return [
            'url' => $url,
            'room' => $room,
            'token' => $this->jwt([
                'iss' => $key,
                'sub' => $identity,
                'name' => $user->name,
                'nbf' => $now - 5,
                'exp' => $now + $ttlSeconds,
                'metadata' => json_encode(['oid' => (int) $exam->organization_id, 'role' => 'proctor']),
                'video' => [
                    'room' => $room, 'roomJoin' => true, 'hidden' => true,
                    'canPublish' => false, 'canSubscribe' => true, 'canPublishData' => false,
                ],
            ], $secret),
        ];
    }

    // ------------------------------------------------------------------ service-to-service signatures

    /** @return array{0: string, 1: string} [timestamp, signature] */
    public function sign(string $body): array
    {
        $ts = (string) time();

        return [$ts, hash_hmac('sha256', $ts . '.' . $body, (string) config('services.realtime.internal_secret'))];
    }

    public function verifyRequest(Request $request, int $maxSkew = 300): bool
    {
        $secret = (string) config('services.realtime.internal_secret');
        $ts = (string) $request->header('X-Foxy-Timestamp');
        $sig = (string) $request->header('X-Foxy-Signature');
        if ($secret === '' || $ts === '' || $sig === '' || !ctype_digit($ts) || abs(time() - (int) $ts) > $maxSkew) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $ts . '.' . $request->getContent(), $secret), $sig);
    }

    // ------------------------------------------------------------------ lifecycle (best effort)

    /** Tell ingest an attempt started / paused / ended so the hub and the client's next batch know. Never throws. */
    public function lifecycle(ExamAttempt $attempt, string $status): void
    {
        if (!$this->enabled() || !config('services.realtime.ingest_internal_url')) {
            return;
        }
        try {
            $body = json_encode([
                'attempt_id' => $attempt->id,
                'exam_id' => $attempt->exam_id,
                'user_id' => $attempt->user_id,
                'status' => $status,
            ]);
            [$ts, $sig] = $this->sign($body);
            Http::withHeaders(['X-Foxy-Timestamp' => $ts, 'X-Foxy-Signature' => $sig])
                ->withBody($body, 'application/json')
                ->connectTimeout(1)->timeout(2)
                ->post(rtrim((string) config('services.realtime.ingest_internal_url'), '/') . '/internal/v1/lifecycle');
        } catch (\Throwable $e) {
            Log::warning('realtime lifecycle notify failed', ['attempt' => $attempt->id, 'status' => $status, 'error' => $e->getMessage()]);
        }
    }
}
