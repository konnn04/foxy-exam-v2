<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\User;
use App\Services\AiService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiServiceAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    protected function tearDown(): void
    {
        AiService::resetFake();
        parent::tearDown();
    }

    /**
     * Test 1: Kỳ thi yêu cầu AI giám sát (ai_face_check = true) hoạt động bình thường khi AI Service ONLINE.
     */
    public function test_exam_with_ai_face_check_allows_start_and_login_when_ai_is_online(): void
    {
        AiService::fakeAvailable(true);

        $loginResponse = $this->postJson('/api/v1/student/login', [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ]);

        $loginResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $exam = Exam::where('code', 'FOXY-2026')->first();
        $token = $loginResponse->json('data.token');

        // Xem chi tiết kỳ thi
        $showResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson("/api/v1/student/exams/{$exam->id}");

        $showResponse->assertStatus(200)
            ->assertJsonPath('data.ai_service.available', true)
            ->assertJsonPath('data.ai_service.status', 'ONLINE')
            ->assertJsonPath('data.can_start', true);

        // Bắt đầu kỳ thi qua endpoint start
        $startResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/v1/student/exams/{$exam->id}/start");

        $startResponse->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test 2: Kỳ thi yêu cầu AI giám sát (ai_face_check = true) BỊ CHẶN khi AI Service OFFLINE.
     */
    public function test_exam_with_ai_face_check_blocks_start_and_login_when_ai_is_offline(): void
    {
        AiService::fakeAvailable(false);

        // 1. Chặn ngay tại bước student login vào phòng thi
        $loginResponse = $this->postJson('/api/v1/student/login', [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ]);

        $loginResponse->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'AI_SERVICE_UNAVAILABLE')
            ->assertJsonPath('ai_status', 'OFFLINE');

        // 2. Chặn tại endpoint show (báo can_start = false) và start
        $student = User::where('username', 'student01')->first();
        $exam = Exam::where('code', 'FOXY-2026')->first();
        $token = $student->createToken('test-token')->plainTextToken;

        $showResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson("/api/v1/student/exams/{$exam->id}");

        $showResponse->assertStatus(200)
            ->assertJsonPath('data.ai_service.available', false)
            ->assertJsonPath('data.ai_service.status', 'OFFLINE')
            ->assertJsonPath('data.can_start', false);

        $startResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/v1/student/exams/{$exam->id}/start");

        $startResponse->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'AI_SERVICE_UNAVAILABLE')
            ->assertJsonPath('ai_status', 'OFFLINE');
    }

    /**
     * Test 3: Kỳ thi KHÔNG yêu cầu AI giám sát (ai_face_check = false) vẫn vào thi được dù AI OFFLINE.
     */
    public function test_exam_without_ai_face_check_allows_start_even_when_ai_is_offline(): void
    {
        AiService::fakeAvailable(false);

        $exam = Exam::where('code', 'FOXY-2026')->first();
        $config = $exam->monitoring_config;
        $config['ai_face_check'] = false;
        $exam->update(['monitoring_config' => $config]);

        // Đăng nhập phòng thi thành công vì kỳ thi này không cần AI
        $loginResponse = $this->postJson('/api/v1/student/login', [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ]);

        $loginResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $token = $loginResponse->json('data.token');

        // Start bài thi thành công
        $startResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/v1/student/exams/{$exam->id}/start");

        $startResponse->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * Test 4: Endpoint kiểm tra trạng thái AI phản hồi đúng status.
     */
    public function test_ai_status_endpoint_reports_status(): void
    {
        AiService::fakeAvailable(true);
        $resOnline = $this->getJson('/api/v1/ai/status');
        $resOnline->assertStatus(200)
            ->assertJsonPath('status', 'ONLINE')
            ->assertJsonPath('is_available', true);

        AiService::fakeAvailable(false);
        $resOffline = $this->getJson('/api/v1/ai/status');
        $resOffline->assertStatus(503)
            ->assertJsonPath('status', 'OFFLINE')
            ->assertJsonPath('is_available', false);
    }
}
