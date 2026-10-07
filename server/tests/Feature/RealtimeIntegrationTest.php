<?php

namespace Tests\Feature;

use App\Models\EditOpLog;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Organization;
use App\Models\User;
use App\Models\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RealtimeIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private const JWT = 'test-jwt-secret';
    private const INTERNAL = 'test-internal-secret';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        config([
            'services.realtime.jwt_secret' => self::JWT,
            'services.realtime.internal_secret' => self::INTERNAL,
            'services.realtime.ingest_url' => 'https://rt.test/ingest',
            'services.realtime.ingest_internal_url' => 'http://ingest:8081',
            'services.realtime.hub_url' => 'wss://rt.test/hub',
            'services.realtime.record_url' => 'https://rt.test/record',
            'services.realtime.livekit.url' => 'wss://lk.test',
            'services.realtime.livekit.api_key' => 'devkey',
            'services.realtime.livekit.api_secret' => 'devsecret',
        ]);
    }

    private function attempt(int $number = 1): ExamAttempt
    {
        $exam = Exam::where('code', 'FOXY-2026')->first();
        $student = User::where('username', 'student01')->first();

        return ExamAttempt::create([
            'exam_id' => $exam->id, 'user_id' => $student->id, 'attempt_number' => $number,
            'status' => 'IN_PROGRESS', 'started_at' => now(),
        ]);
    }

    /** POST a JSON body with the internal HMAC the realtime worker would send. */
    private function signed(string $uri, array $payload, ?string $secret = null, ?int $ts = null)
    {
        $body = json_encode($payload);
        $ts = (string) ($ts ?? time());
        $sig = hash_hmac('sha256', $ts . '.' . $body, $secret ?? self::INTERNAL);

        return $this->call('POST', $uri, [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_FOXY_TIMESTAMP' => $ts, 'HTTP_X_FOXY_SIGNATURE' => $sig,
        ], $body);
    }

    private function decodeJwt(string $jwt, string $secret): array
    {
        [$h, $p, $s] = explode('.', $jwt);
        $b64 = fn ($x) => base64_decode(strtr($x, '-_', '+/'));
        $this->assertTrue(hash_equals(rtrim(strtr(base64_encode(hash_hmac('sha256', "$h.$p", $secret, true)), '+/', '-_'), '='), $s), 'JWT signature');

        return json_decode($b64($p), true);
    }

    // ------------------------------------------------------------------ the signed bulk endpoint

    public function test_bulk_rejects_missing_wrong_and_replayed_signatures(): void
    {
        $this->postJson('/api/internal/v1/events/bulk', ['violations' => []])->assertStatus(401);
        $this->signed('/api/internal/v1/events/bulk', ['violations' => []], 'wrong')->assertStatus(401);
        $this->signed('/api/internal/v1/events/bulk', ['violations' => []], null, time() - 3600)->assertStatus(401);
        $this->signed('/api/internal/v1/events/bulk', ['violations' => []])->assertOk();

        // a user session is not enough: the endpoint is for the worker only
        $student = User::where('username', 'student01')->first();
        $this->actingAs($student, 'sanctum')->postJson('/api/internal/v1/events/bulk', ['violations' => []])->assertStatus(401);
    }

    public function test_bulk_records_violations_once_and_scores_the_attempt(): void
    {
        $a = $this->attempt();
        $payload = ['batch_id' => 'w-1', 'violations' => [
            ['client_event_id' => "{$a->id}:1", 'attempt_id' => $a->id, 'violation_type' => 'TAB_SWITCH', 'severity' => 'MEDIUM', 'details' => ['to' => 'chrome'], 'occurred_at' => 1_760_000_000_000],
            ['client_event_id' => "{$a->id}:2", 'attempt_id' => $a->id, 'violation_type' => 'MULTIPLE_PEOPLE', 'severity' => 'HIGH', 'evidence_id' => 'ev123', 'occurred_at' => 1_760_000_001_000],
        ]];

        $this->signed('/api/internal/v1/events/bulk', $payload)->assertOk()->assertJson(['violations' => 2, 'duplicates' => 0]);
        $this->assertEquals(2, Violation::where('exam_attempt_id', $a->id)->count());
        $a->refresh();
        $this->assertEquals(15 + 30, $a->risk_score);
        $this->assertTrue($a->is_flagged);
        $this->assertEquals('ev123', Violation::where('client_event_id', "{$a->id}:2")->value('evidence_id'));
        $this->assertEquals(1_760_000_000, Violation::where('client_event_id', "{$a->id}:1")->first()->timestamp->getTimestamp());

        // the worker retries the same batch: nothing changes
        $this->signed('/api/internal/v1/events/bulk', $payload)->assertOk()->assertJson(['violations' => 0, 'duplicates' => 2]);
        $this->assertEquals(2, Violation::where('exam_attempt_id', $a->id)->count());
        $this->assertEquals(45, $a->fresh()->risk_score);
    }

    public function test_bulk_is_tolerant_one_bad_item_never_fails_the_batch(): void
    {
        $a = $this->attempt();
        $this->signed('/api/internal/v1/events/bulk', ['violations' => [
            ['client_event_id' => '9999:1', 'attempt_id' => 999999, 'violation_type' => 'TAB_SWITCH', 'severity' => 'LOW'], // unknown attempt
            ['client_event_id' => "{$a->id}:1", 'attempt_id' => $a->id, 'violation_type' => 'NOT_A_TYPE', 'severity' => 'LOW'],
            ['client_event_id' => "{$a->id}:2", 'attempt_id' => $a->id, 'violation_type' => 'DEVTOOLS_OPENED', 'severity' => 'LOW'],
        ]])->assertOk()->assertJson(['violations' => 1, 'skipped' => 2]);
    }

    public function test_bulk_oplog_applies_the_paste_rule_and_stays_idempotent(): void
    {
        $a = $this->attempt();
        $payload = ['oplogs' => [[
            'client_event_id' => "{$a->id}:7", 'attempt_id' => $a->id, 'batch_seq' => 3, 'keystroke_count' => 12, 'paste_event_count' => 1,
            'synthetic_flags' => ['bulk_insert' => true, 'chars_count' => 150], 'payload_ref' => 'telemetry/2/5/1-9.jsonl.gz', 'occurred_at' => 1_760_000_000_000,
        ]]];

        $this->signed('/api/internal/v1/events/bulk', $payload)->assertOk()->assertJson(['oplogs' => 1, 'violations' => 1]);
        $this->assertDatabaseHas('edit_op_logs', ['exam_attempt_id' => $a->id, 'batch_seq' => 3, 'payload_ref' => 'telemetry/2/5/1-9.jsonl.gz']);
        $this->assertDatabaseHas('violations', ['exam_attempt_id' => $a->id, 'violation_type' => 'BULK_PASTE', 'severity' => 'CRITICAL']);
        $this->assertEquals(50, $a->fresh()->risk_score);

        $this->signed('/api/internal/v1/events/bulk', $payload)->assertOk()->assertJson(['oplogs' => 0, 'violations' => 0, 'duplicates' => 1]);
        $this->assertEquals(1, EditOpLog::where('exam_attempt_id', $a->id)->count());
        $this->assertEquals(50, $a->fresh()->risk_score);
    }

    public function test_bulk_heartbeats_only_move_last_seen_forward(): void
    {
        $a = $this->attempt();
        $this->signed('/api/internal/v1/events/bulk', ['heartbeats' => [['attempt_id' => $a->id, 'last_seen_at' => 1_760_000_100_000]]])->assertOk();
        $this->assertEquals(1_760_000_100, $a->fresh()->last_seen_at->getTimestamp());
        $this->signed('/api/internal/v1/events/bulk', ['heartbeats' => [['attempt_id' => $a->id, 'last_seen_at' => 1_760_000_000_000]]])->assertOk();
        $this->assertEquals(1_760_000_100, $a->fresh()->last_seen_at->getTimestamp(), 'an old heartbeat must not rewind presence');
    }

    // ------------------------------------------------------------------ the client session

    public function test_session_returns_scoped_tokens_for_the_running_attempt(): void
    {
        $a = $this->attempt();
        $student = User::where('username', 'student01')->first();

        $res = $this->actingAs($student, 'sanctum')->postJson('/api/v1/student/realtime/session', ['attempt_id' => $a->id])->assertOk();
        $d = $res->json('data');

        $this->assertEquals('https://rt.test/ingest/v1/batch', $d['ingest']['url']);
        $this->assertEquals(1000, $d['ingest']['flush_interval_ms']);
        $claims = $this->decodeJwt($d['ingest']['token'], self::JWT);
        $this->assertEquals(['candidate', $a->id, $a->exam_id, $student->id], [$claims['role'], $claims['aid'], $claims['eid'], $claims['uid']]);
        $this->assertGreaterThan(time() + 600, $claims['exp']);

        $this->assertEquals('exam-' . $a->exam_id, $d['livekit']['room']);
        $this->assertEquals('attempt-' . $a->id, $d['livekit']['identity']);
        $lk = $this->decodeJwt($d['livekit']['token'], 'devsecret');
        $this->assertTrue($lk['video']['canPublish']);
        $this->assertFalse($lk['video']['canSubscribe'], 'a candidate must never see other candidates');
        $this->assertEquals('devkey', $lk['iss']);

        $this->assertStringContainsString('/v1/evidence/presign', $d['evidence']['presign_url']);
    }

    public function test_session_refuses_foreign_or_finished_attempts_and_works_when_disabled(): void
    {
        $a = $this->attempt();
        $other = User::where('username', 'student01')->first();
        $teacher = User::where('username', 'teacher_hcmus')->first();

        // somebody else's attempt id
        $this->actingAs($teacher, 'sanctum')->postJson('/api/v1/student/realtime/session', ['attempt_id' => $a->id])->assertStatus(409);

        $a->update(['status' => 'SUBMITTED']);
        $this->actingAs($other, 'sanctum')->postJson('/api/v1/student/realtime/session', ['attempt_id' => $a->id])->assertStatus(409);

        config(['services.realtime.jwt_secret' => '']);
        $this->actingAs($other, 'sanctum')->postJson('/api/v1/student/realtime/session')->assertStatus(503)->assertJson(['error_code' => 'REALTIME_DISABLED']);
    }

    // ------------------------------------------------------------------ lifecycle + proctor

    public function test_login_and_finish_tell_ingest_about_the_attempt_with_a_valid_signature(): void
    {
        Http::fake(['http://ingest:8081/*' => Http::response(['ok' => true])]);

        $res = $this->postJson('/api/v1/student/login', ['exam_code' => 'FOXY-2026', 'username' => 'student01', 'password' => 'student123'])->assertOk();
        $token = $res->json('data.token');
        $attemptId = $res->json('data.attempt_id');

        Http::assertSent(function ($req) use ($attemptId) {
            $body = $req->body();
            $ok = $req->url() === 'http://ingest:8081/internal/v1/lifecycle'
                && json_decode($body, true)['attempt_id'] === $attemptId
                && json_decode($body, true)['status'] === 'active';
            $ts = $req->header('X-Foxy-Timestamp')[0] ?? '';
            $sig = $req->header('X-Foxy-Signature')[0] ?? '';

            return $ok && hash_equals(hash_hmac('sha256', $ts . '.' . $body, self::INTERNAL), $sig);
        });

        $this->withToken($token)->postJson('/api/v1/student/finish')->assertOk();
        Http::assertSent(fn ($req) => json_decode($req->body(), true)['status'] === 'ended');
    }

    public function test_lifecycle_notification_never_breaks_the_client_when_realtime_is_down(): void
    {
        Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('refused'));
        $this->postJson('/api/v1/student/login', ['exam_code' => 'FOXY-2026', 'username' => 'student01', 'password' => 'student123'])->assertOk();
    }

    public function test_proctor_token_is_scoped_to_one_exam_and_one_organization(): void
    {
        $admin = User::where('username', 'admin_hcmus')->first();
        $exam = Exam::where('code', 'FOXY-2026')->first();

        $res = $this->actingAs($admin)->getJson("/admin/exams/{$exam->id}/realtime")->assertOk();
        $this->assertEquals("wss://rt.test/hub/v1/rooms/{$exam->id}/ws", $res->json('hub_ws_url'));
        $claims = $this->decodeJwt($res->json('token'), self::JWT);
        $this->assertEquals(['proctor', [$exam->id], $exam->organization_id], [$claims['role'], $claims['eids'], $claims['oid']]);

        // an exam of another school is not even visible to this admin
        $hcmut = Organization::where('code', 'HCMUT')->first();
        $foreign = Exam::withoutGlobalScopes()->where('organization_id', $hcmut->id)->first();
        $this->actingAs($admin)->getJson("/admin/exams/{$foreign->id}/realtime")->assertStatus(404);

        // students never get one
        $student = User::where('username', 'student01')->first();
        $this->actingAs($student)->getJson("/admin/exams/{$exam->id}/realtime")->assertForbidden();
    }

    public function test_force_end_ends_the_attempt_and_notifies_the_client_channel(): void
    {
        Http::fake(['http://ingest:8081/*' => Http::response(['ok' => true])]);
        $a = $this->attempt();
        $admin = User::where('username', 'admin_hcmus')->first();

        $this->actingAs($admin)->post("/admin/attempts/{$a->id}/force-end")->assertRedirect();
        $this->assertEquals('FORCE_ENDED', $a->fresh()->status);
        Http::assertSent(fn ($req) => json_decode($req->body(), true)['status'] === 'force_ended');

        // other school's admin cannot touch it
        $other = User::withoutGlobalScopes()->where('role', 'ORG_ADMIN')->where('organization_id', Organization::where('code', 'HCMUT')->value('id'))->first();
        $b = $this->attempt(2);
        $this->actingAs($other)->post("/admin/attempts/{$b->id}/force-end")->assertStatus(404);
        $this->assertEquals('IN_PROGRESS', $b->fresh()->status);
    }

    public function test_ai_enforce_false_lets_candidates_in_while_no_ai_worker_exists(): void
    {
        \App\Services\AiService::fakeAvailable(false); // FOXY-2026 asks for face monitoring, the AI worker is down
        $login = ['exam_code' => 'FOXY-2026', 'username' => 'student01', 'password' => 'student123'];

        config(['services.ai_worker.enforce' => true]);
        $this->postJson('/api/v1/student/login', $login)->assertStatus(503)->assertJson(['error_code' => 'AI_SERVICE_UNAVAILABLE']);

        config(['services.ai_worker.enforce' => false]);
        $this->postJson('/api/v1/student/login', $login)->assertOk();
        \App\Services\AiService::resetFake();
    }

    public function test_save_answer_works_without_an_explicit_type(): void
    {
        $a = $this->attempt();
        $student = User::where('username', 'student01')->first();
        $q = \App\Models\ClassicalQuestion::where('type', 'SHORT_ANSWER')->first();

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/exams/{$a->exam_id}/take/{$a->id}/save-answer", ['question_id' => $q->id, 'answer_content' => 'delete'])
            ->assertOk();
    }
}
