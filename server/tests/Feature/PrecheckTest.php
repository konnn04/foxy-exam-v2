<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamPrecheck;
use App\Models\User;
use App\Models\Violation;
use App\Support\Precheck;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrecheckTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private Exam $exam;

    private const OK = ['network' => 'ok', 'exam' => 'ok', 'display' => 'ok', 'apps' => 'ok'];
    private const ENV = ['os_family' => 'windows', 'vm' => ['detected' => false], 'remote_session' => false, 'boot_time' => 1_800_000_000, 'displays' => 1, 'virtual_cameras' => [], 'capture_devices' => [], 'camera_label' => 'Integrated Camera'];
    private const DEVICE = ['fingerprint' => 'abc123', 'os' => 'Windows 11'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        config(['foxy.precheck.required' => true]);
        $this->student = User::where('username', 'student01')->firstOrFail();
        $course = Course::create(['organization_id' => $this->student->organization_id, 'code' => 'PRE1', 'name' => 'Precheck']);
        $course->students()->attach($this->student->id);
        $this->exam = Exam::create([
            'organization_id' => $this->student->organization_id, 'course_id' => $course->id, 'title' => 'Precheck', 'code' => 'PRE-1',
            'type' => 'QUIZ', 'status' => 'PUBLISHED', 'duration_minutes' => 60, 'max_attempts' => 3,
            'monitoring_config' => ['ai_face_check' => false, 'allowed_os' => ['windows', 'linux']],
        ]);
        Sanctum::actingAs($this->student);
    }

    private function precheck(array $env = [], array $checks = [], array $device = self::DEVICE)
    {
        return $this->postJson("/api/v1/student/exams/{$this->exam->id}/precheck", ['checks' => $checks + self::OK, 'env' => $env + self::ENV, 'device_info' => $device]);
    }

    private function start(?string $token, array $device = self::DEVICE)
    {
        return $this->postJson("/api/v1/student/exams/{$this->exam->id}/start", ['precheck_token' => $token, 'device_info' => $device]);
    }

    public function test_the_server_refuses_a_machine_that_breaks_the_policy(): void
    {
        $this->precheck(['vm' => ['detected' => true, 'vendor' => 'VirtualBox']])->assertStatus(422)->assertJsonPath('error_code', 'PRECHECK_FAILED')
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'máy ảo'));
        $this->precheck(['os_family' => 'macos'])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Windows, Linux'));
        $this->precheck(['remote_session' => true])->assertStatus(422);
        $this->precheck(['camera_label' => 'OBS Virtual Camera'])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'camera ảo'));
        $this->precheck(['displays' => 2])->assertStatus(422);
        $this->precheck([], ['apps' => 'fail'])->assertStatus(422)->assertJsonPath('message', 'Chưa đạt: ứng dụng bị cấm.');
        $this->postJson("/api/v1/student/exams/{$this->exam->id}/precheck", ['checks' => self::OK])->assertStatus(422); // old client: no env

        // an exam may allow VMs and virtual cameras explicitly
        $this->exam->update(['monitoring_config' => ['ai_face_check' => false, 'block_vm' => false, 'block_virtual_camera' => false]]);
        $this->precheck(['vm' => ['detected' => true], 'camera_label' => 'OBS Virtual Camera'])->assertOk();

        $this->assertSame(7, ExamPrecheck::where('passed', false)->count(), 'failed checks are kept for the proctor');
        $this->assertNull(ExamPrecheck::where('passed', false)->first()->token_hash);
    }

    public function test_start_needs_a_fresh_single_use_token_from_the_same_machine(): void
    {
        $this->start(null)->assertStatus(428)->assertJsonPath('error_code', 'PRECHECK_REQUIRED');

        $token = $this->precheck()->assertOk()->json('data.precheck_token');
        $this->start($token, ['fingerprint' => 'other-machine'])->assertStatus(428);
        $first = $this->start($token)->assertOk();
        $this->assertNotEmpty($first->json('data.session_key'));
        $this->start($token)->assertStatus(428); // used

        $expired = $this->precheck()->json('data.precheck_token');
        $this->travel(16)->minutes();
        $this->start($expired)->assertStatus(428);
    }

    public function test_a_restart_needs_a_new_precheck_and_the_old_session_stops_working(): void
    {
        $token = $this->precheck()->json('data.precheck_token');
        $key = $this->start($token)->json('data.session_key');
        $attempt = ExamAttempt::where('user_id', $this->student->id)->where('exam_id', $this->exam->id)->firstOrFail();
        $save = fn (?string $k) => $this->withHeader('X-Foxy-Session', (string) $k)->getJson("/api/v1/student/exams/{$this->exam->id}/take/{$attempt->id}");

        $save($key)->assertOk();
        $save(null)->assertStatus(428);

        // the machine reboots: new boot time, new precheck, resume rotates the key
        $again = $this->precheck(['boot_time' => 1_800_009_999])->json('data.precheck_token');
        $newKey = $this->start($again)->assertOk()->assertJsonPath('data.attempt_id', $attempt->id)->json('data.session_key');
        $this->assertNotSame($key, $newKey);

        $save($key)->assertStatus(428)->assertJsonPath('error_code', 'PRECHECK_REQUIRED');
        $save($newKey)->assertOk();
        $this->assertSame(1, Violation::where('exam_attempt_id', $attempt->id)->where('violation_type', 'DEVICE_RESTARTED')->count());
        $this->assertSame($attempt->id, ExamPrecheck::whereNotNull('used_at')->latest('id')->first()->exam_attempt_id);
    }

    public function test_a_network_change_is_noted_once_per_new_address(): void
    {
        $token = $this->precheck()->json('data.precheck_token');
        $key = $this->start($token)->json('data.session_key');
        $attempt = ExamAttempt::where('user_id', $this->student->id)->firstOrFail();
        $take = fn (string $ip) => $this->withServerVariables(['REMOTE_ADDR' => $ip])->withHeader('X-Foxy-Session', $key)->getJson("/api/v1/student/exams/{$this->exam->id}/take/{$attempt->id}");

        $take('10.1.1.1')->assertOk();
        $take('10.1.1.1')->assertOk();
        $take('10.2.2.2')->assertOk();
        $this->assertSame(2, Violation::where('exam_attempt_id', $attempt->id)->where('violation_type', 'IP_CHANGED')->count());
    }

    public function test_virtual_camera_names(): void
    {
        foreach (['OBS Virtual Camera', 'ManyCam Virtual Webcam', 'DroidCam Source 3', 'Dummy video device (0x0000)', 'NVIDIA Broadcast', 'Camo'] as $n) {
            $this->assertTrue(Precheck::isVirtualCamera($n), $n);
        }
        foreach (['Integrated Camera', 'HD Webcam C270', 'FaceTime HD Camera', 'USB2.0 HD UVC WebCam', 'Camouflage HD'] as $n) {
            $this->assertFalse(Precheck::isVirtualCamera($n), $n);
        }
    }
}
