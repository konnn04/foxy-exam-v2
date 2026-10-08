<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Exam;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Violation;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FoxyCoreTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed database with default plans, school, teacher, student, and exam
        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Test 1: Health check endpoint.
     */
    public function test_health_check_returns_ok(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'OK',
                'system' => 'FoxyExam Core Server',
                'version' => '2.0.0',
            ]);
    }

    /**
     * Test 2: Student Login with Exam Code.
     */
    public function test_student_can_login_to_exam_room(): void
    {
        $response = $this->postJson('/api/v1/student/login', [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'token',
                    'attempt_id',
                    'student',
                    'exam',
                ],
            ]);

        $this->assertDatabaseHas('exam_attempts', [
            'user_id' => User::where('username', 'student01')->first()->id,
            'status' => 'IN_PROGRESS',
        ]);
    }

    /**
     * Test 2b: `max_attempts` — cho thi lại trong hạn mức, chặn khi vượt hạn mức,
     * và không giới hạn khi `max_attempts` là null.
     */
    public function test_student_login_respects_max_attempts(): void
    {
        $exam = Exam::where('code', 'FOXY-2026')->first();
        $exam->update(['max_attempts' => 2]);

        $credentials = [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ];

        // Lượt 1: đăng nhập rồi nộp bài ngay để kết thúc lượt.
        $login1 = $this->postJson('/api/v1/student/login', $credentials);
        $login1->assertStatus(200)->assertJsonPath('data.attempt_number', 1);
        $token1 = $login1->json('data.token');
        $this->withToken($token1)->postJson('/api/v1/student/finish')->assertStatus(200);

        // Lượt 2: vẫn còn trong hạn mức (2) -> phải đăng nhập được, attempt_number 2.
        $login2 = $this->postJson('/api/v1/student/login', $credentials);
        $login2->assertStatus(200)->assertJsonPath('data.attempt_number', 2);
        $token2 = $login2->json('data.token');
        $this->withToken($token2)->postJson('/api/v1/student/finish')->assertStatus(200);

        // Lượt 3: đã dùng hết 2/2 -> phải bị chặn.
        $login3 = $this->postJson('/api/v1/student/login', $credentials);
        $login3->assertStatus(403)
            ->assertJsonPath('success', false);

        $this->assertEquals(
            2,
            \App\Models\ExamAttempt::where('exam_id', $exam->id)
                ->where('user_id', User::where('username', 'student01')->first()->id)
                ->count(),
        );

        // max_attempts = null -> không giới hạn, luôn đăng nhập được tiếp.
        $exam->update(['max_attempts' => null]);
        $login4 = $this->postJson('/api/v1/student/login', $credentials);
        $login4->assertStatus(200)->assertJsonPath('data.attempt_number', 3);
    }

    /**
     * Test 3: Student gets Exam Paper and Starter Code.
     */
    public function test_student_can_fetch_exam_paper(): void
    {
        $loginRes = $this->postJson('/api/v1/student/login', [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ]);

        $token = $loginRes->json('data.token');

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/student/paper');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'attempt_id',
                    'exam' => ['id', 'title', 'duration_minutes'],
                    'problems' => [
                        '*' => [
                            'id',
                            'title',
                            'description',
                            'allowed_languages',
                            'starter_templates',
                            'sample_test_cases',
                        ],
                    ],
                ],
            ]);
    }

    /**
     * Test 4: Op-Log Telemetry and Bulk Paste Detection.
     */
    public function test_bulk_paste_in_op_log_triggers_violation(): void
    {
        $loginRes = $this->postJson('/api/v1/student/login', [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ]);

        $token = $loginRes->json('data.token');
        $attemptId = $loginRes->json('data.attempt_id');

        // Send Op Log with simulated paste from ChatGPT
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/student/op-log', [
                'batch_seq' => 1,
                'keystroke_count' => 0,
                'paste_event_count' => 1,
                'synthetic_flags' => [
                    'bulk_insert' => true,
                    'chars_count' => 150,
                ],
                'raw_ops_payload' => json_encode(['action' => 'paste', 'length' => 150]),
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        // Verify that a Violation of type BULK_PASTE was automatically logged
        $this->assertDatabaseHas('violations', [
            'exam_attempt_id' => $attemptId,
            'violation_type' => 'BULK_PASTE',
            'severity' => 'CRITICAL',
        ]);

        // Verify risk score increment
        $this->assertDatabaseHas('exam_attempts', [
            'id' => $attemptId,
            'is_flagged' => true,
        ]);
    }

    /**
     * Test 5: Code Submission.
     */
    public function test_student_can_submit_code(): void
    {
        $loginRes = $this->postJson('/api/v1/student/login', [
            'exam_code' => 'FOXY-2026',
            'username' => 'student01',
            'password' => 'student123',
        ]);

        $token = $loginRes->json('data.token');
        $problemId = Exam::where('code', 'FOXY-2026')->first()->programmingProblems->first()->id;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/student/submit', [
                'programming_problem_id' => $problemId,
                'language' => 'cpp',
                'source_code' => "#include <iostream>\nusing namespace std;\nint main() { cout << \"1 9\"; return 0; }",
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => ['submission_id', 'status'],
            ]);

        $this->assertDatabaseHas('submissions', [
            'programming_problem_id' => $problemId,
            'language' => 'cpp',
        ]);
    }

    /**
     * Test 6: SaaS Quota Limit on FREE Plan.
     */
    public function test_saas_quota_blocks_excessive_exams_on_free_plan(): void
    {
        $freePlan = Plan::where('name', 'FREE')->first();

        // Create a Free Organization
        $freeOrg = Organization::create([
            'name' => 'Trung Tâm Dạy Thử',
            'code' => 'FREE_CENTER',
            'slug' => 'free-center',
            'type' => 'CENTER',
        ]);

        Subscription::create([
            'organization_id' => $freeOrg->id,
            'plan_id' => $freePlan->id,
            'starts_at' => now(),
            'status' => 'ACTIVE',
        ]);

        $teacher = User::create([
            'organization_id' => $freeOrg->id,
            'username' => 'free_teacher',
            'name' => 'Giáo viên miễn phí',
            'email' => 'free_teacher@center.edu.vn',
            'password' => 'secret123',
            'role' => 'TEACHER',
        ]);

        $course = Course::create([
            'organization_id' => $freeOrg->id,
            'code' => 'FREE_CS',
            'name' => 'Lớp Test',
            'teacher_id' => $teacher->id,
        ]);

        $token = $teacher->createToken('test')->plainTextToken;

        // 1st Exam Creation -> should succeed (Free plan allows 1 exam/month)
        $res1 = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/admin/exams', [
                'course_id' => $course->id,
                'title' => 'Bài thi đầu tiên',
                'type' => 'PROGRAMMING',
                'duration_minutes' => 60,
            ]);

        $res1->assertStatus(201)
            ->assertJsonPath('success', true);

        // 2nd Exam Creation -> should be blocked by QuotaService (QUOTA_EXCEEDED)
        $res2 = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/admin/exams', [
                'course_id' => $course->id,
                'title' => 'Bài thi thứ hai vượt hạn mức',
                'type' => 'PROGRAMMING',
                'duration_minutes' => 60,
            ]);

        $res2->assertStatus(403)
            ->assertJsonPath('error_code', 'QUOTA_EXCEEDED');

        // Attempting to enable AI Proctoring on Free plan -> should be blocked (FEATURE_NOT_PERMITTED)
        $res3 = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/admin/exams', [
                'course_id' => $course->id,
                'title' => 'Bài thi cố tình bật AI',
                'type' => 'PROGRAMMING',
                'duration_minutes' => 60,
                'monitoring_config' => ['ai_face_check' => true],
            ]);

        $res3->assertStatus(403);
    }

    /**
     * Test: lịch thi — chỉ bắt đầu được lượt MỚI trong khung `start_time`..`end_time`
     * (NULL = không giới hạn phía đó).
     */
    public function test_exam_start_respects_schedule(): void
    {
        $student = User::where('username', 'student01')->first();
        $exam = Exam::where('type', 'QUIZ')->firstOrFail();
        $exam->update(['monitoring_config' => ['prevent_tab_switch' => true], 'max_attempts' => null]);
        \Laravel\Sanctum\Sanctum::actingAs($student);

        $exam->update(['start_time' => now()->addHour(), 'end_time' => now()->addHours(3)]);
        $this->postJson("/api/v1/student/exams/{$exam->id}/start")
            ->assertStatus(403)
            ->assertJson(['error_code' => 'OUTSIDE_SCHEDULE']);

        $exam->update(['start_time' => now()->subHours(3), 'end_time' => now()->subHour()]);
        $this->postJson("/api/v1/student/exams/{$exam->id}/start")
            ->assertStatus(403)
            ->assertJson(['error_code' => 'OUTSIDE_SCHEDULE']);

        $exam->update(['start_time' => null, 'end_time' => null]);
        $this->postJson("/api/v1/student/exams/{$exam->id}/start")->assertStatus(200);
    }

    /**
     * Test: admin tạo kỳ thi kèm lịch thi + số lượt tối đa; giờ đóng phải sau giờ mở.
     */
    public function test_admin_can_set_exam_schedule_and_max_attempts(): void
    {
        $exam = Exam::where('type', 'QUIZ')->firstOrFail();
        $admin = User::where('username', 'admin')->first();
        $this->asSchoolAdmin($admin);

        $payload = [
            'course_id' => $exam->course_id,
            'question_set_id' => $exam->question_set_id,
            'title' => $exam->title,
            'duration_minutes' => 60,
            'status' => 'PUBLISHED',
            'start_time' => '2026-11-01T01:00:00.000Z',
            'end_time' => '2026-11-01T05:00:00.000Z',
            'max_attempts' => 3,
        ];

        $this->post("/admin/exams/{$exam->id}/update", $payload)->assertRedirect()->assertSessionHas('success');
        $exam->refresh();
        $this->assertSame(3, $exam->max_attempts);
        $this->assertSame('2026-11-01 01:00:00', $exam->start_time->format('Y-m-d H:i:s'));
        $this->assertSame('2026-11-01 05:00:00', $exam->end_time->format('Y-m-d H:i:s'));

        // Không giới hạn số lượt + chỉ đặt giờ đóng (không có giờ mở) vẫn hợp lệ.
        $this->post("/admin/exams/{$exam->id}/update", [...$payload, 'max_attempts' => null, 'start_time' => null])
            ->assertSessionHasNoErrors();
        $this->assertNull($exam->refresh()->max_attempts);

        // Giờ đóng trước giờ mở -> lỗi validate.
        $this->post("/admin/exams/{$exam->id}/update", [...$payload, 'end_time' => '2026-10-31T00:00:00.000Z'])
            ->assertSessionHasErrors('end_time');
    }

    /**
     * Test: admin xoá 1 phiên thi -> dữ liệu con bị xoá theo, thí sinh được thi lại
     * và lượt mới không đụng số thứ tự đã có (cột unique).
     */
    public function test_admin_can_delete_attempt_and_student_can_retake(): void
    {
        $student = User::where('username', 'student01')->first();
        $exam = Exam::where('type', 'QUIZ')->firstOrFail();
        $exam->update([
            'monitoring_config' => ['prevent_tab_switch' => true],
            'max_attempts' => 2,
            'start_time' => null,
            'end_time' => null,
        ]);

        \App\Models\ExamAttempt::where('exam_id', $exam->id)->where('user_id', $student->id)->delete();
        $first = \App\Models\ExamAttempt::create(['exam_id' => $exam->id, 'user_id' => $student->id, 'attempt_number' => 1, 'status' => 'SUBMITTED', 'started_at' => now()->subHour()]);
        $second = \App\Models\ExamAttempt::create(['exam_id' => $exam->id, 'user_id' => $student->id, 'attempt_number' => 2, 'status' => 'SUBMITTED', 'started_at' => now()->subMinutes(30)]);
        Violation::create(['exam_attempt_id' => $first->id, 'violation_type' => 'TAB_SWITCH', 'severity' => 'LOW', 'timestamp' => now()]);

        // Hết lượt.
        \Laravel\Sanctum\Sanctum::actingAs($student);
        $this->postJson("/api/v1/student/exams/{$exam->id}/start")->assertStatus(403);

        // Admin xoá lượt #1.
        $this->asSchoolAdmin(User::where('username', 'admin')->first());
        $this->post("/admin/exams/{$exam->id}/attempts/{$first->id}/delete")->assertRedirect("/admin/exams/{$exam->id}");
        $this->assertDatabaseMissing('exam_attempts', ['id' => $first->id]);
        $this->assertDatabaseMissing('violations', ['exam_attempt_id' => $first->id]);
        $this->assertDatabaseHas('exam_attempts', ['id' => $second->id]);

        // Thí sinh thi lại được, lượt mới là #3 (không trùng #2).
        \Laravel\Sanctum\Sanctum::actingAs($student);
        $this->postJson("/api/v1/student/exams/{$exam->id}/start")
            ->assertStatus(200)
            ->assertJsonPath('data.attempt_number', 3);

        // Danh sách kỳ thi trả số lượt để client hiện nút "Thi lại".
        $this->getJson("/api/v1/student/courses/{$exam->course_id}/exams")
            ->assertJsonFragment(['id' => $exam->id, 'max_attempts' => 2, 'attempts_count' => 2]);
    }
}
