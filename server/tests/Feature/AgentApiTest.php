<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Services\AiService;
use App\Services\Realtime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AgentApiTest extends TestCase
{
    use RefreshDatabase;

    private ExamAttempt $attempt;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('local');
        Cache::flush();
        config(['services.realtime.internal_secret' => 'internal-secret']);
        $exam = Exam::where('code', 'FOXY-2026')->first();
        $exam->update(['monitoring_config' => ['ai_face_check' => true, 'ai_identity' => true, 'ai_objects' => false, 'extra_camera' => 'optional', 'extra_camera_objects' => true]]);
        $this->student = User::where('username', 'student01')->first();
        $this->attempt = ExamAttempt::create(['exam_id' => $exam->id, 'user_id' => $this->student->id, 'attempt_number' => 1, 'status' => 'IN_PROGRESS', 'started_at' => now()]);
    }

    protected function tearDown(): void
    {
        AiService::resetFake();
        parent::tearDown();
    }

    private function signed(string $path): \Illuminate\Testing\TestResponse
    {
        [$ts, $sig] = app(Realtime::class)->sign('');

        return $this->withHeaders(['X-Foxy-Timestamp' => $ts, 'X-Foxy-Signature' => $sig])->get($path);
    }

    public function test_the_agent_must_sign_its_requests(): void
    {
        $this->getJson("/api/internal/v1/agent/attempts/{$this->attempt->id}")->assertStatus(401);
        $this->signed("/api/internal/v1/agent/attempts/{$this->attempt->id}")->assertOk();
    }

    public function test_it_describes_what_to_check_and_whether_the_attempt_still_runs(): void
    {
        $res = $this->signed("/api/internal/v1/agent/attempts/{$this->attempt->id}")->assertOk()->assertJson([
            'attempt_id' => $this->attempt->id, 'running' => true, 'has_reference' => false,
            'config' => ['ai_identity' => true, 'ai_objects' => false, 'extra_camera_objects' => true],
        ]);
        $this->assertSame($this->student->id, $res->json('user_id'));

        $this->attempt->update(['status' => 'SUBMITTED']);
        $this->signed("/api/internal/v1/agent/attempts/{$this->attempt->id}")->assertJson(['running' => false]);
        $this->signed('/api/internal/v1/agent/attempts/999999')->assertStatus(404);
    }

    public function test_a_sub_option_is_off_for_the_agent_when_its_main_option_is_off(): void
    {
        Exam::find($this->attempt->exam_id)->update(['monitoring_config' => ['ai_face_check' => false, 'ai_identity' => true, 'ai_objects' => true, 'extra_camera' => 'off', 'extra_camera_objects' => true]]);
        $this->signed("/api/internal/v1/agent/attempts/{$this->attempt->id}")->assertJson(['config' => ['ai_identity' => false, 'ai_objects' => false, 'extra_camera_objects' => false]]);
    }

    public function test_the_phone_room_resolves_to_the_running_attempt_and_the_reference_is_served(): void
    {
        $this->signed("/api/internal/v1/agent/attempts/lookup?user={$this->student->id}&exam={$this->attempt->exam_id}")->assertOk()->assertJson(['attempt_id' => $this->attempt->id]);
        $this->signed('/api/internal/v1/agent/attempts/lookup?user=999&exam=1')->assertStatus(404);

        $this->signed("/api/internal/v1/agent/attempts/{$this->attempt->id}/face-reference")->assertStatus(404);
        Storage::disk('local')->put("faces/{$this->student->id}.jpg", 'jpeg-bytes');
        $this->student->forceFill(['face_enrolled_at' => now()])->save();
        $this->signed("/api/internal/v1/agent/attempts/{$this->attempt->id}/face-reference")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->signed("/api/internal/v1/agent/attempts/{$this->attempt->id}")->assertJson(['has_reference' => true]);
    }

    public function test_a_needed_service_also_needs_the_agent_to_be_online(): void
    {
        config(['services.ai_face.url' => 'http://face.test', 'services.ai_objects.url' => 'http://obj.test', 'services.ai_agent.url' => 'http://agent.test']);
        Http::fake(['face.test/health' => Http::response(['ok' => true]), 'obj.test/health' => Http::response(['ok' => true]), 'agent.test/health' => Http::response('down', 503)]);

        $this->assertFalse(AiService::checkExamRequirement(Exam::find($this->attempt->exam_id))['available'], 'the agent does the per-second analysis');
        $this->assertSame('OFFLINE', AiService::getStatus());
    }
}
