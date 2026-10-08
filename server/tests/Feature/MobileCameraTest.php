<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V1\Student\MobileCameraController;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\MobileCameraToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MobileCameraTest extends TestCase
{
    use RefreshDatabase;

    private const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    private Exam $exam;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Cache::flush();
        config([
            'services.realtime.livekit' => ['url' => 'wss://lk.test', 'api_key' => 'key', 'api_secret' => 'secret-secret-secret-secret-1234'],
            'services.realtime.jwt_secret' => 'jwt-secret',
            'services.realtime.record_url' => 'https://rec.test',
            'services.realtime.record_internal_url' => 'http://rec.internal',
            'services.realtime.internal_secret' => 'internal-secret',
        ]);
        $this->exam = Exam::where('code', 'FOXY-2026')->first();
        $this->exam->update(['monitoring_config' => array_merge($this->exam->monitoring_config ?? [], ['extra_camera' => 'required'])]);
        $this->student = User::where('username', 'student01')->first();
    }

    private function issue(): array
    {
        return $this->actingAs($this->student, 'sanctum')->postJson("/api/v1/student/exams/{$this->exam->id}/mobile-camera")->assertOk()->json('data');
    }

    private function raw(array $data): string
    {
        return basename($data['url']);
    }

    private function claims(string $jwt): array
    {
        return json_decode(base64_decode(strtr(explode('.', $jwt)[1], '-_', '+/')), true);
    }

    private function attempt(): ExamAttempt
    {
        return ExamAttempt::create(['exam_id' => $this->exam->id, 'user_id' => $this->student->id, 'attempt_number' => 1, 'status' => 'IN_PROGRESS', 'started_at' => now()]);
    }

    public function test_the_lobby_gets_a_link_and_a_viewer_and_the_phone_joins_the_private_room(): void
    {
        $data = $this->issue();
        $this->assertMatchesRegularExpression('#/m/camera/[A-Za-z0-9]{48}$#', $data['url']);
        $room = "cam2-{$this->student->id}-{$this->exam->id}";
        $this->assertSame($room, $data['viewer']['room']);
        $this->assertStringStartsWith('viewer-', $data['viewer']['identity']);
        $viewer = $this->claims($data['viewer']['token'])['video'];
        $this->assertTrue($viewer['canSubscribe']);
        $this->assertFalse($viewer['canPublish']);

        $res = $this->postJson('/api/v1/public/mobile-camera/' . $this->raw($data) . '/exchange')->assertOk();
        $this->assertSame('lobby', $res->json('state'));
        $this->assertSame($room, $res->json('livekit.room'));
        $this->assertSame('phone', $res->json('livekit.identity'));
        $grants = $this->claims($res->json('livekit.token'))['video'];
        $this->assertTrue($grants['canPublish']);
        $this->assertFalse($grants['canSubscribe'], 'the phone sees nobody');
    }

    public function test_the_token_is_stored_only_as_a_hash_and_a_new_link_replaces_the_old_one(): void
    {
        $first = $this->issue();
        $second = $this->issue();
        $this->assertSame(1, MobileCameraToken::count());
        $this->assertNull(MobileCameraToken::where('token_hash', $this->raw($first))->first(), 'the raw token is never stored');
        $this->postJson('/api/v1/public/mobile-camera/' . $this->raw($first) . '/exchange')->assertStatus(410);
        $this->postJson('/api/v1/public/mobile-camera/' . $this->raw($second) . '/exchange')->assertOk();
    }

    public function test_starting_the_exam_keeps_the_phone_in_its_room_and_records_it(): void
    {
        Http::fake(['rec.internal/*' => Http::response(['ok' => true])]);
        $token = $this->raw($this->issue());
        $this->postJson("/api/v1/public/mobile-camera/{$token}/ack")->assertOk(); // the phone is publishing
        Http::assertNothingSent(); // no attempt yet: nothing to record

        $attempt = $this->attempt();
        MobileCameraController::bind($this->student, $this->exam, $attempt);

        $res = $this->postJson("/api/v1/public/mobile-camera/{$token}/exchange")->assertOk();
        $this->assertSame('exam', $res->json('state'));
        $this->assertSame("cam2-{$this->student->id}-{$this->exam->id}", $res->json('livekit.room'), 'the phone never changes room');

        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/internal/v1/egress/start')
            && $r['kind'] === 'camera2' && $r['attempt_id'] === $attempt->id && $r['room'] === "cam2-{$this->student->id}-{$this->exam->id}" && $r['identity'] === 'phone'
            && $r->hasHeader('X-Foxy-Signature'));
    }

    public function test_a_phone_that_connects_after_the_exam_started_is_recorded_on_its_ack(): void
    {
        Http::fake(['rec.internal/*' => Http::response(['ok' => true])]);
        $token = $this->raw($this->issue());
        $attempt = $this->attempt();
        MobileCameraController::bind($this->student, $this->exam, $attempt);
        Http::assertNothingSent();

        $this->postJson("/api/v1/public/mobile-camera/{$token}/ack")->assertOk();
        Http::assertSentCount(1);
        $this->postJson("/api/v1/public/mobile-camera/{$token}/ack")->assertOk(); // a reconnect asks again; the record service is idempotent
        Http::assertSentCount(2);
    }

    public function test_the_computer_can_get_viewer_credentials_for_an_already_linked_phone(): void
    {
        $this->actingAs($this->student, 'sanctum')->getJson("/api/v1/student/exams/{$this->exam->id}/mobile-camera")->assertOk()->assertJson(['data' => null]);
        $this->issue();
        $res = $this->actingAs($this->student, 'sanctum')->getJson("/api/v1/student/exams/{$this->exam->id}/mobile-camera")->assertOk();
        $this->assertSame("cam2-{$this->student->id}-{$this->exam->id}", $res->json('data.viewer.room'));
        $this->assertFalse($res->json('data.connected'));
    }

    public function test_the_link_dies_with_the_attempt_and_with_its_expiry(): void
    {
        $token = $this->raw($this->issue());
        $attempt = $this->attempt();
        MobileCameraController::bind($this->student, $this->exam, $attempt);
        $attempt->update(['status' => 'SUBMITTED']);
        $this->postJson("/api/v1/public/mobile-camera/{$token}/exchange")->assertStatus(410);

        $other = $this->raw($this->issue());
        MobileCameraToken::query()->update(['expires_at' => now()->subMinute(), 'attempt_id' => null]);
        $this->postJson("/api/v1/public/mobile-camera/{$other}/ack")->assertStatus(410);
    }

    public function test_an_exam_without_the_extra_camera_issues_no_link(): void
    {
        $this->exam->update(['monitoring_config' => ['extra_camera' => 'off']]);
        $this->actingAs($this->student, 'sanctum')->postJson("/api/v1/student/exams/{$this->exam->id}/mobile-camera")->assertStatus(422);
    }

    public function test_the_layout_check_needs_the_candidate_and_the_laptop(): void
    {
        config(['services.ai_objects.url' => 'http://obj.test']);
        $verify = fn () => $this->actingAs($this->student, 'sanctum')->post(
            "/api/v1/student/exams/{$this->exam->id}/mobile-camera/verify",
            ['frame' => UploadedFile::fake()->createWithContent('f.jpg', base64_decode(self::JPEG))],
            ['Accept' => 'application/json'],
        );

        Http::fake(['obj.test/health' => Http::response(['ok' => true]), 'obj.test/v1/detect*' => Http::response(['objects' => [['label' => 'person']], 'prohibited' => []])]);
        $verify()->assertOk()->assertJson(['ok' => false, 'problem' => 'no_laptop']);
    }

    public function test_the_layout_check_passes_with_both_in_view_and_is_skipped_without_ai(): void
    {
        config(['services.ai_objects.url' => 'http://obj.test']);
        Http::fake(['obj.test/health' => Http::response(['ok' => true]), 'obj.test/v1/detect*' => Http::response(['objects' => [['label' => 'person'], ['label' => 'laptop']], 'prohibited' => []])]);
        $post = fn () => $this->actingAs($this->student, 'sanctum')->post(
            "/api/v1/student/exams/{$this->exam->id}/mobile-camera/verify",
            ['frame' => UploadedFile::fake()->createWithContent('f.jpg', base64_decode(self::JPEG))],
            ['Accept' => 'application/json'],
        );
        $post()->assertOk()->assertJson(['ok' => true, 'problem' => null]);

        config(['services.ai_objects.url' => null, 'services.ai_face.url' => null, 'services.ai_worker.url' => null]);
        Cache::flush();
        $post()->assertOk()->assertJson(['ok' => true, 'skipped' => true]);
    }

    public function test_the_phone_page_is_public(): void
    {
        $this->get('/m/camera/' . str_repeat('a', 48))->assertOk();
    }
}
