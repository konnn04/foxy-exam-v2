<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\FaceChangeRequest;
use App\Models\User;
use App\Models\Violation;
use App\Support\FaceReference;
use App\Support\MonitoringConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BiometricAndClipTest extends TestCase
{
    use RefreshDatabase;

    private const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        config(['services.biometric_consent' => true, 'services.realtime.jwt_secret' => 'jwt', 'services.realtime.internal_secret' => 'internal', 'services.realtime.ingest_internal_url' => 'http://ingest:8081']);
    }

    private function student(): User
    {
        return User::where('username', 'student01')->first();
    }

    private function bearer(User $u): array
    {
        return ['Authorization' => 'Bearer ' . $u->createToken('t', ['student'])->plainTextToken, 'Accept' => 'application/json'];
    }

    private function attempt(): ExamAttempt
    {
        return ExamAttempt::create(['exam_id' => Exam::where('code', 'FOXY-2026')->value('id'), 'user_id' => $this->student()->id, 'attempt_number' => 1, 'status' => 'IN_PROGRESS', 'started_at' => now()]);
    }

    public function test_biometric_endpoints_need_the_consent_of_this_login_and_every_login_asks_again(): void
    {
        $this->getJson('/api/v1/public/biometric-policy')->assertOk()->assertJsonPath('data.version', \App\Support\BiometricPolicy::VERSION);
        $h = $this->bearer($this->student());
        $frame = UploadedFile::fake()->createWithContent('f.jpg', base64_decode(self::JPEG));

        $this->withHeaders($h)->post('/api/v1/student/face/enroll', ['frame' => $frame])->assertStatus(403)->assertJsonPath('code', 'BIOMETRIC_CONSENT_REQUIRED');
        $this->withHeaders($h)->getJson('/api/v1/student/biometric')->assertJsonPath('data.accepted', false);
        $this->withHeaders($h)->postJson('/api/v1/student/biometric/consent', [])->assertStatus(422);

        $this->withHeaders($h)->postJson('/api/v1/student/biometric/consent', ['agree' => true])->assertOk();
        $this->withHeaders($h)->getJson('/api/v1/student/biometric')->assertJsonPath('data.accepted', true);
        $this->withHeaders($h)->post('/api/v1/student/face/enroll', ['frame' => UploadedFile::fake()->createWithContent('f.jpg', base64_decode(self::JPEG))])->assertOk();
        $this->assertDatabaseHas('biometric_consents', ['user_id' => $this->student()->id, 'policy_version' => \App\Support\BiometricPolicy::VERSION]);

        // a second login is a new token: consent is asked again
        $h2 = $this->bearer($this->student());
        $this->app['auth']->forgetGuards();
        $this->withHeaders($h2)->getJson('/api/v1/student/biometric')->assertJsonPath('data.accepted', false);
    }

    public function test_a_locked_face_is_changed_through_a_request_that_staff_approve_or_reject(): void
    {
        Http::fake(['*' => Http::response(['ok' => true])]);
        $student = $this->student();
        FaceReference::enroll($student, (string) base64_decode(self::JPEG));
        $student->forceFill(['face_locked_at' => now()])->save();
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/student/face/change-request', ['reason' => 'x'])->assertStatus(422);
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/student/face/change-request', ['reason' => 'Đã đổi kiểu tóc và đeo kính'])->assertCreated();
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/student/face/change-request', ['reason' => 'Gửi lần nữa cho chắc'])->assertStatus(409);

        $admin = User::where('username', 'admin_hcmus')->first();
        $this->assertDatabaseHas('user_notifications', ['user_id' => $admin->id, 'type' => 'face_request']);
        $this->actingAs($admin)->get('/admin/faces?tab=requests')->assertOk();

        $req = FaceChangeRequest::first();
        $this->actingAs($admin)->post("/admin/faces/requests/{$req->id}", ['decision' => 'approve'])->assertRedirect();
        $this->assertNull($student->fresh()->face_locked_at);
        $this->assertEquals('APPROVED', $req->fresh()->status);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $student->id, 'type' => 'face_decision']);
        $this->actingAs($admin)->post("/admin/faces/requests/{$req->id}", ['decision' => 'reject'])->assertStatus(409);
    }

    public function test_a_phone_link_takes_the_photo_once_and_expires(): void
    {
        $student = $this->student();
        $url = $this->actingAs($student, 'sanctum')->postJson('/api/v1/student/face/phone-link')->assertOk()->json('data.url');
        $token = basename($url);

        $this->postJson("/api/v1/public/face-enroll/{$token}/info")->assertOk()->assertJsonPath('name', $student->name);
        $this->post("/api/v1/public/face-enroll/{$token}/submit", ['frame' => UploadedFile::fake()->createWithContent('f.jpg', base64_decode(self::JPEG))], ['Accept' => 'application/json'])->assertOk();
        $this->assertTrue(FaceReference::has($student->fresh()));
        $this->postJson("/api/v1/public/face-enroll/{$token}/info")->assertStatus(410);
        $this->postJson('/api/v1/public/face-enroll/' . str_repeat('a', 48) . '/info')->assertStatus(410);
    }

    public function test_the_face_page_lists_only_this_organisation_and_bulk_actions_work(): void
    {
        $admin = User::where('username', 'admin_hcmus')->first();
        $mine = $this->student();
        FaceReference::enroll($mine, (string) base64_decode(self::JPEG));
        $other = User::where('role', 'STUDENT')->where('organization_id', '!=', $admin->organization_id)->first();

        $this->actingAs($admin)->get('/admin/faces')->assertOk();
        $this->actingAs($admin)->post('/admin/faces/bulk', ['ids' => [$mine->id, $other?->id ?? 999999], 'action' => 'lock'])->assertRedirect();
        $this->assertNotNull($mine->fresh()->face_locked_at);
        $this->actingAs($admin)->post('/admin/faces/bulk', ['ids' => [$mine->id], 'action' => 'unlock']);
        $this->assertNull($mine->fresh()->face_locked_at);
        $this->actingAs($admin)->post('/admin/faces/lock-all')->assertRedirect();
        $this->assertNotNull($mine->fresh()->face_locked_at);
        $this->actingAs($admin)->post('/admin/faces/bulk', ['ids' => [$mine->id], 'action' => 'delete']);
        $this->assertFalse(FaceReference::has($mine->fresh()));
        if ($other) {
            $this->assertNull($other->fresh()->face_locked_at);
        }
        $this->actingAs($this->student())->get('/admin/faces')->assertForbidden();
    }

    public function test_the_clip_option_needs_a_camera_or_a_screen_share(): void
    {
        $this->assertFalse(MonitoringConfig::normalize(['violation_clips' => true])['violation_clips']);
        $this->assertTrue(MonitoringConfig::normalize(['violation_clips' => true, 'require_screen' => true])['violation_clips']);
        $this->assertTrue(MonitoringConfig::normalize(['violation_clips' => true, 'ai_face_check' => true])['violation_clips']);
    }

    public function test_a_clip_is_attached_to_the_violation_by_type_and_time_and_the_proctors_are_told(): void
    {
        Http::fake(['http://ingest:8081/*' => Http::response(['ok' => true])]);
        $a = $this->attempt();
        $at = now()->subSeconds(8);
        $v = Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => 'TAB_SWITCH', 'severity' => 'MEDIUM', 'details' => ['message' => 'x'], 'timestamp' => $at]);
        $student = $this->student();
        $body = ['type' => 'TAB_SWITCH', 'at_ms' => $at->getTimestampMs() + 400, 'clips' => ['camera' => 'abcdef0123456789', 'screen' => 'fedcba9876543210'], 'from_ms' => $at->getTimestampMs() - 6000, 'to_ms' => $at->getTimestampMs() + 5000];

        $this->actingAs($student, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $a->id)->postJson('/api/v1/student/violation-clip', $body)->assertOk()->assertJsonPath('violation_id', $v->id);
        $details = $v->fresh()->details;
        $this->assertEquals('abcdef0123456789', $details['clips']['camera']);
        $this->assertEquals(5000, $details['clip_range']['to_ms'] - $at->getTimestampMs());
        $this->assertTrue(Http::recorded()->contains(fn ($p) => (json_decode($p[0]->body(), true)['field'] ?? null) === 'ev'));

        // not found yet (the violation batch has not arrived): the client retries
        $this->actingAs($student, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $a->id)->postJson('/api/v1/student/violation-clip', ['at_ms' => $at->getTimestampMs() + 60000] + $body)->assertStatus(404)->assertJsonPath('retry', true);
        $this->actingAs($student, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $a->id)->postJson('/api/v1/student/violation-clip', ['clips' => ['camera' => 'bad id!'], 'type' => 'TAB_SWITCH', 'at_ms' => 1])->assertStatus(422);
    }

    public function test_the_attempt_page_flags_candidates_who_started_from_the_same_machine(): void
    {
        $exam = Exam::where('code', 'FOXY-2026')->first();
        $other = User::where('role', 'STUDENT')->where('id', '!=', $this->student()->id)->first();
        $mk = fn (User $u, string $fp) => ExamAttempt::create(['exam_id' => $exam->id, 'user_id' => $u->id, 'attempt_number' => 1, 'status' => 'IN_PROGRESS', 'started_at' => now(), 'device_info' => ['fingerprint' => $fp, 'ip' => '1.2.3.4']]);
        $a = $mk($this->student(), 'same-machine');
        $mk($other, 'same-machine');
        $admin = User::where('username', 'admin_hcmus')->first();

        $page = $this->actingAs($admin)->get("/admin/attempts/{$a->id}")->assertOk();
        $props = $page->viewData('page')['props'];
        $this->assertEquals($other->username, $props['attempt']['shared_device_with'][0]['username']);
        $this->assertEquals('1.2.3.4', $props['attempt']['device_info']['ip']);
    }

    public function test_prohibited_classes_are_per_exam_and_fall_back_to_the_default_set(): void
    {
        $on = ['ai_face_check' => true, 'ai_objects' => true];
        $this->assertSame(['book'], MonitoringConfig::normalize($on + ['prohibited_labels' => ['book', 'spaceship', 'book']])['prohibited_labels']);
        $this->assertSame(\App\Support\ProhibitedObjects::DEFAULT, MonitoringConfig::normalize($on + ['prohibited_labels' => ['nope']])['prohibited_labels']);
        $this->assertSame([], MonitoringConfig::normalize(['ai_face_check' => true, 'prohibited_labels' => ['book']])['prohibited_labels'], 'no object check, no list');
    }

    public function test_the_violation_log_is_hash_chained_and_tampering_is_found(): void
    {
        $a = $this->attempt();
        $admin = User::where('username', 'admin_hcmus')->first();
        $mk = fn (string $t) => Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => $t, 'severity' => 'LOW', 'details' => ['m' => 1], 'timestamp' => now()]);
        $first = $mk('TAB_SWITCH');
        $mk('BANNED_APP');
        $third = $mk('SYSTEM_SHORTCUT');

        $this->actingAs($admin)->getJson("/admin/attempts/{$a->id}/verify-chain")->assertOk()->assertJson(['ok' => true, 'checked' => 3]);
        // details, reviews and clips change legitimately and are not part of the chain
        $first->update(['details' => ['edited' => true], 'is_reviewed' => true]);
        $this->actingAs($admin)->getJson("/admin/attempts/{$a->id}/verify-chain")->assertJson(['ok' => true]);

        $third->update(['severity' => 'CRITICAL']);
        $this->actingAs($admin)->getJson("/admin/attempts/{$a->id}/verify-chain")->assertJson(['ok' => false, 'broken_at' => $third->id]);
        Violation::withoutGlobalScopes()->where('id', $first->id)->delete();
        $this->actingAs($admin)->getJson("/admin/attempts/{$a->id}/verify-chain")->assertJson(['ok' => false]);
        $this->actingAs($this->student())->getJson("/admin/attempts/{$a->id}/verify-chain")->assertForbidden();
    }

    public function test_a_teacher_grades_an_essay_and_the_attempt_score_is_recomputed(): void
    {
        $a = $this->attempt();
        $a->update(['status' => 'SUBMITTED', 'submitted_at' => now(), 'score' => 1]);
        $admin = User::where('username', 'admin_hcmus')->first();
        $set = \App\Models\QuestionSet::where('organization_id', $admin->organization_id)->first();
        $essay = \App\Models\ClassicalQuestion::create(['question_set_id' => $set->id, 'type' => 'ESSAY', 'content' => 'Giải thích', 'points' => 5, 'difficulty' => 'EASY', 'created_by' => $admin->id]);
        $auto = \App\Models\ExamAttemptAnswer::create(['exam_attempt_id' => $a->id, 'classical_question_id' => $essay->id, 'answer_content' => 'Bài viết', 'is_correct' => null, 'score' => 0]);

        $this->actingAs($admin)->get("/admin/attempts/{$a->id}/grading")->assertOk();
        $this->actingAs($admin)->get("/admin/attempts/{$a->id}")->assertOk()->assertInertia(fn ($p) => $p->where('attempt.pending_grading', 1));

        $this->actingAs($admin)->post("/admin/attempts/{$a->id}/grading", ['grades' => [['id' => $auto->id, 'score' => 99, 'feedback' => 'Thiếu ý cuối']]])->assertRedirect();
        $auto->refresh();
        $this->assertEquals(5.0, $auto->score, 'a score above the maximum is capped');
        $this->assertTrue($auto->is_correct);
        $this->assertEquals('Thiếu ý cuối', $auto->feedback);
        $this->assertEquals(5.0, $a->fresh()->score);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $a->user_id, 'type' => 'graded']);

        $this->actingAs($admin)->post("/admin/attempts/{$a->id}/grading", ['grades' => [['id' => 999999, 'score' => 1]]])->assertStatus(422);
        $this->actingAs($this->student())->get("/admin/attempts/{$a->id}/grading")->assertForbidden();
    }
}
