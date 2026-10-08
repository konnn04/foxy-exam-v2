<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\User;
use App\Services\AiService;
use App\Support\FaceReference;
use App\Support\MonitoringConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MonitoringOptionsTest extends TestCase
{
    use RefreshDatabase;

    private const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('local');
        Cache::flush();
    }

    protected function tearDown(): void
    {
        AiService::resetFake();
        parent::tearDown();
    }

    public function test_a_sub_option_never_stays_on_when_its_main_option_is_off(): void
    {
        $c = MonitoringConfig::normalize([
            'ai_face_check' => false, 'ai_identity' => true, 'ai_objects' => true,
            'extra_camera' => 'off', 'extra_camera_objects' => true, 'extra_camera_spot_check' => true,
        ]);
        $this->assertFalse($c['ai_identity']);
        $this->assertFalse($c['ai_objects']);
        $this->assertFalse($c['extra_camera_objects']);
        $this->assertFalse($c['extra_camera_spot_check']);

        $on = MonitoringConfig::normalize(['ai_face_check' => true, 'ai_identity' => true, 'extra_camera' => 'required', 'extra_camera_spot_check' => true]);
        $this->assertTrue($on['ai_identity']);
        $this->assertTrue($on['extra_camera_spot_check']);
        $this->assertSame('off', MonitoringConfig::normalize(['extra_camera' => 'bogus'])['extra_camera']);
    }

    public function test_switching_an_ai_feature_on_needs_its_service_to_answer_a_ping(): void
    {
        config(['services.ai_face.url' => 'http://face.test', 'services.ai_objects.url' => 'http://obj.test']);
        Http::fake(['face.test/health' => Http::response('down', 503), 'obj.test/health' => Http::response(['ok' => true])]);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        MonitoringConfig::assertServicesReachable(['ai_identity' => true]);
    }

    public function test_a_feature_that_was_already_on_survives_an_outage_and_the_object_service_can_be_enabled(): void
    {
        config(['services.ai_face.url' => 'http://face.test', 'services.ai_objects.url' => 'http://obj.test']);
        Http::fake(['face.test/health' => Http::response('down', 503), 'obj.test/health' => Http::response(['ok' => true])]);

        MonitoringConfig::assertServicesReachable(['ai_identity' => true, 'ai_objects' => true], ['ai_identity' => true]);
        $this->assertTrue(true);
    }

    public function test_a_student_enrols_once_and_staff_manage_the_photo(): void
    {
        $student = User::where('username', 'student01')->first();
        $frame = fn () => UploadedFile::fake()->createWithContent('f.jpg', base64_decode(self::JPEG));

        $this->actingAs($student, 'sanctum')->post('/api/v1/student/face/enroll', ['frame' => $frame()], ['Accept' => 'application/json'])->assertOk();
        $this->assertTrue(FaceReference::has($student->fresh()));
        $this->actingAs($student, 'sanctum')->post('/api/v1/student/face/enroll', ['frame' => $frame()], ['Accept' => 'application/json'])->assertStatus(423);
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/student/face')->assertJson(['data' => ['enrolled' => true, 'locked' => true]]);

        $admin = User::where('username', 'admin_hcmus')->first();
        $this->actingAs($admin)->post("/admin/users/{$student->id}/face/lock", ['locked' => false])->assertRedirect();
        $this->assertNull($student->fresh()->face_locked_at);
        $this->actingAs($admin)->get("/admin/users/{$student->id}/face-photo")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->actingAs($admin)->post("/admin/users/{$student->id}/face/delete")->assertRedirect();
        $this->assertFalse(FaceReference::has($student->fresh()));
        $this->actingAs($admin)->get("/admin/users/{$student->id}/face-photo")->assertStatus(404);
    }

    public function test_the_exam_needs_the_services_it_asks_for(): void
    {
        $exam = Exam::where('code', 'FOXY-2026')->first();
        AiService::fakeAvailable(false);

        $exam->update(['monitoring_config' => ['ai_face_check' => true]]);
        $this->assertTrue(AiService::checkExamRequirement($exam->fresh())['available'], 'MediaPipe alone runs on the candidate machine');

        $exam->update(['monitoring_config' => ['ai_face_check' => true, 'ai_objects' => true]]);
        $this->assertFalse(AiService::checkExamRequirement($exam->fresh())['available']);

        $exam->update(['monitoring_config' => ['ai_face_check' => true, 'extra_camera_objects' => true]]);
        $this->assertFalse(AiService::checkExamRequirement($exam->fresh())['available'], 'objects on the phone camera need the object service too');
    }
}
