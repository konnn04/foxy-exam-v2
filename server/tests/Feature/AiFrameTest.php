<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Models\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AiFrameTest extends TestCase
{
    use RefreshDatabase;

    private const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    private User $student;
    private ExamAttempt $attempt;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('local');
        Cache::flush();
        config(['services.ai_face.url' => 'http://face.test', 'services.ai_objects.url' => 'http://obj.test']);

        $exam = Exam::where('code', 'FOXY-2026')->first();
        $exam->update(['monitoring_config' => array_merge($exam->monitoring_config ?? [], ['ai_face_check' => true])]);
        $this->student = User::where('username', 'student01')->first();
        $this->attempt = ExamAttempt::create(['exam_id' => $exam->id, 'user_id' => $this->student->id, 'attempt_number' => 1, 'status' => 'IN_PROGRESS', 'started_at' => now()]);
    }

    private function send(?string $evidence = 'ev1'): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->student, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $this->attempt->id)
            ->post('/api/v1/student/ai/frame', ['frame' => UploadedFile::fake()->createWithContent('f.jpg', base64_decode(self::JPEG)), 'evidence_id' => $evidence], ['Accept' => 'application/json']);
    }

    private function fakeServices(array $objects = [], array $verify = [], int $faces = 1): void
    {
        Http::fake([
            'face.test/health' => Http::response(['ok' => true]),
            'obj.test/health' => Http::response(['ok' => true]),
            'obj.test/v1/detect*' => Http::response(['objects' => [], 'prohibited' => $objects]),
            'face.test/v1/faces' => Http::response(['count' => $faces]),
            'face.test/v1/verify' => Http::response($verify + ['match' => true, 'similarity' => 0.9, 'threshold' => 0.35, 'reason' => null]),
        ]);
    }

    public function test_the_first_single_face_frame_becomes_the_reference(): void
    {
        $this->fakeServices();
        $this->send()->assertOk()->assertJson(['checked' => true, 'match' => null]);
        Storage::disk('local')->assertExists("ai-reference/{$this->attempt->id}.jpg");
    }

    public function test_a_different_face_raises_a_pending_violation_with_the_evidence(): void
    {
        $this->fakeServices(verify: ['match' => false, 'similarity' => 0.05]);
        $this->send(); // the first frame is only stored as the reference
        $this->send()->assertOk()->assertJson(['match' => false]);

        $v = Violation::where('exam_attempt_id', $this->attempt->id)->where('violation_type', 'FACE_MISMATCH')->first();
        $this->assertNotNull($v);
        $this->assertFalse((bool) $v->is_reviewed, 'AI findings wait for a proctor');
        $this->assertSame('ev1', $v->evidence_id);
    }

    public function test_the_client_attaches_the_picture_to_what_a_frame_raised(): void
    {
        $this->fakeServices(objects: ['book']);
        $ids = $this->send(null)->json('violation_ids');
        $this->assertCount(1, $ids);
        $this->actingAs($this->student, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $this->attempt->id)
            ->postJson('/api/v1/student/ai/evidence', ['violation_ids' => $ids, 'evidence_id' => 'late'])->assertOk()->assertJson(['attached' => 1]);
        $this->assertSame('late', Violation::find($ids[0])->evidence_id);
    }

    public function test_prohibited_objects_raise_one_violation_per_minute(): void
    {
        $this->fakeServices(objects: ['cell phone']);
        $this->send()->assertJson(['prohibited' => ['cell phone']]);
        $this->send();
        $this->assertSame(1, Violation::where('exam_attempt_id', $this->attempt->id)->where('violation_type', 'PROHIBITED_DEVICE')->count());
    }

    public function test_nothing_happens_when_the_ai_services_are_not_configured_or_the_exam_does_not_ask(): void
    {
        config(['services.ai_face.url' => null, 'services.ai_objects.url' => null, 'services.ai_worker.url' => null]);
        Cache::flush();
        $this->send()->assertOk()->assertJson(['checked' => false]);

        config(['services.ai_face.url' => 'http://face.test', 'services.ai_objects.url' => 'http://obj.test']);
        $this->attempt->exam->update(['monitoring_config' => ['ai_face_check' => false]]);
        $this->fakeServices(objects: ['book']);
        $this->send()->assertJson(['checked' => false]);
        $this->assertSame(0, Violation::where('exam_attempt_id', $this->attempt->id)->count());
    }

    public function test_the_reference_is_deleted_when_the_attempt_is_submitted(): void
    {
        $this->fakeServices();
        $this->send();
        app(\App\Services\AttemptFinisher::class)->submit($this->attempt);
        Storage::disk('local')->assertMissing("ai-reference/{$this->attempt->id}.jpg");
    }

    public function test_status_needs_every_configured_service_to_answer(): void
    {
        Http::fake(['face.test/health' => Http::response(['ok' => true]), 'obj.test/health' => Http::response('x', 503)]);
        Cache::flush();
        $this->assertSame('OFFLINE', \App\Services\AiService::getStatus());
    }

    public function test_status_is_online_when_all_services_answer(): void
    {
        $this->fakeServices();
        Cache::flush();
        $this->assertSame('ONLINE', \App\Services\AiService::getStatus());
    }
}
