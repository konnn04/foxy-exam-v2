<?php

namespace Tests\Feature;

use App\Models\ClassicalQuestion;
use App\Models\ClassicalQuestionAnswer;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Organization;
use App\Models\QuestionSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StudentApiV1Test extends TestCase
{
    use RefreshDatabase;

    protected User $student;
    protected User $teacher;
    protected Organization $org;
    protected Course $course;
    protected Exam $classicalExam;
    protected QuestionSet $questionSet;
    protected ClassicalQuestion $q1;
    protected ClassicalQuestionAnswer $q1_correct;
    protected ClassicalQuestionAnswer $q1_wrong;

    protected function setUp(): void
    {
        parent::setUp();

        $this->org = Organization::create([
            'name' => 'HCMUS Test Org',
            'code' => 'HCMUS',
            'slug' => 'hcmus-test',
            'type' => 'UNIVERSITY',
            'status' => 'ACTIVE',
        ]);

        $this->teacher = User::create([
            'organization_id' => $this->org->id,
            'username' => 'teacher_test',
            'name' => 'Thầy Giáo Test',
            'email' => 'teacher@test.com',
            'password' => Hash::make('password123'),
            'role' => 'TEACHER',
            'status' => 'ACTIVE',
        ]);

        $this->student = User::create([
            'organization_id' => $this->org->id,
            'username' => 'student_test',
            'name' => 'Sinh Viên Test',
            'email' => 'student@test.com',
            'password' => Hash::make('student123'),
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);

        $this->course = Course::create([
            'organization_id' => $this->org->id,
            'code' => 'CS101',
            'name' => 'Lập trình C++',
            'teacher_id' => $this->teacher->id,
        ]);

        // Enroll student into course
        $this->student->enrolledCourses()->syncWithoutDetaching([$this->course->id]);

        $this->questionSet = QuestionSet::create([
            'organization_id' => $this->org->id,
            'course_id' => $this->course->id,
            'name' => 'Bộ đề trắc nghiệm C++',
            'code' => 'SET-TEST-01',
            'type' => 'CLASSICAL',
            'status' => 'PUBLISHED',
            'max_score' => 10.0,
            'created_by' => $this->teacher->id,
        ]);

        $this->q1 = ClassicalQuestion::create([
            'question_set_id' => $this->questionSet->id,
            'type' => 'SINGLE_CHOICE',
            'content' => 'Câu hỏi trắc nghiệm 1?',
            'points' => 2.0,
            'order' => 1,
            'created_by' => $this->teacher->id,
        ]);

        $this->q1_wrong = ClassicalQuestionAnswer::create([
            'classical_question_id' => $this->q1->id,
            'content' => 'Sai A',
            'is_correct' => false,
            'order' => 1,
        ]);

        $this->q1_correct = ClassicalQuestionAnswer::create([
            'classical_question_id' => $this->q1->id,
            'content' => 'Đúng B',
            'is_correct' => true,
            'order' => 2,
        ]);

        $this->classicalExam = Exam::create([
            'organization_id' => $this->org->id,
            'course_id' => $this->course->id,
            'question_set_id' => $this->questionSet->id,
            'title' => 'Thi Giữa Kỳ C++',
            'code' => 'EXAM-GK-01',
            'type' => 'QUIZ',
            'status' => 'PUBLISHED',
            'start_time' => now()->subHour(),
            'end_time' => now()->addHours(2),
            'duration_minutes' => 60,
            'created_by' => $this->teacher->id,
        ]);
    }

    public function test_student_can_login_with_valid_credentials()
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'student_test',
            'password' => 'student123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'access_token',
                'data' => [
                    'token',
                    'token_type',
                    'user' => ['id', 'username', 'role', 'name'],
                ],
            ]);
    }

    public function test_student_can_login_via_student_login_route_without_exam_code()
    {
        $response = $this->postJson('/api/v1/student/login', [
            'username' => 'student_test',
            'password' => 'student123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'access_token',
                'data' => ['token', 'user'],
            ]);
    }

    public function test_student_can_login_via_oauth_token_route()
    {
        $response = $this->postJson('/oauth/token', [
            'grant_type' => 'password',
            'username' => 'student_test',
            'password' => 'student123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'access_token',
                'data' => ['token', 'user'],
            ]);
    }

    public function test_student_login_fails_with_invalid_password()
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'student_test',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(401);
    }

    public function test_non_student_role_cannot_login_to_student_portal()
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'login' => 'teacher_test',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('message', 'Tài khoản này không phải là tài khoản sinh viên.');
    }

    public function test_authenticated_student_can_fetch_profile_and_dashboard()
    {
        $token = $this->student->createToken('test_token')->plainTextToken;

        // Test Profile
        $profileRes = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->getJson('/api/v1/auth/me');

        $profileRes->assertStatus(200)
            ->assertJsonPath('data.username', 'student_test')
            ->assertJsonPath('data.role', 'STUDENT');

        // Test Dashboard
        $dashRes = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->getJson('/api/v1/student/dashboard');

        $dashRes->assertStatus(200)
            ->assertJsonPath('data.statistics.total_courses', 1);

        $this->assertCount(1, $dashRes->json('data.upcoming_exams'));
    }

    public function test_student_can_view_enrolled_courses_and_course_exams()
    {
        $token = $this->student->createToken('test_token')->plainTextToken;

        $coursesRes = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->getJson('/api/v1/student/courses');

        $coursesRes->assertStatus(200)
            ->assertJsonPath('data.0.code', 'CS101');

        $examsRes = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->getJson("/api/v1/student/courses/{$this->course->id}/exams");

        $examsRes->assertStatus(200)
            ->assertJsonPath('data.0.code', 'EXAM-GK-01');
    }

    public function test_student_exam_taking_flow_and_auto_grading()
    {
        $token = $this->student->createToken('test_token')->plainTextToken;
        $headers = ['Authorization' => "Bearer {$token}"];

        // 1. Exam overview
        $overviewRes = $this->withHeaders($headers)
            ->getJson("/api/v1/student/exams/{$this->classicalExam->id}");
        $overviewRes->assertStatus(200)
            ->assertJsonPath('data.code', 'EXAM-GK-01');

        // 2. Start exam
        $startRes = $this->withHeaders($headers)
            ->postJson("/api/v1/student/exams/{$this->classicalExam->id}/start");
        $startRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $attemptId = $startRes->json('data.attempt_id');
        $this->assertNotNull($attemptId);

        // 3. Take exam (Verify is_correct is NOT exposed in options)
        $takeRes = $this->withHeaders($headers)
            ->getJson("/api/v1/student/exams/{$this->classicalExam->id}/take/{$attemptId}");
        $takeRes->assertStatus(200);

        $questions = $takeRes->json('data.questions');
        $this->assertNotEmpty($questions);
        $firstOption = $questions[0]['options'][0];
        $this->assertArrayNotHasKey('is_correct', $firstOption, 'Security flaw: is_correct must NOT be returned to student');

        // 4. Save answer (Correct option)
        $saveRes = $this->withHeaders($headers)
            ->postJson("/api/v1/student/exams/{$this->classicalExam->id}/take/{$attemptId}/save-answer", [
                'type' => 'CLASSICAL',
                'question_id' => $this->q1->id,
                'answer_id' => $this->q1_correct->id,
            ]);
        $saveRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 5. Submit exam
        $submitRes = $this->withHeaders($headers)
            ->postJson("/api/v1/student/exams/{$this->classicalExam->id}/submit/{$attemptId}");
        $submitRes->assertStatus(200)
            ->assertJsonPath('data.status', 'SUBMITTED')
            ->assertJsonPath('data.score', 2); // q1 has 2.0 points

        // Verify attempt record in DB
        $attempt = ExamAttempt::find($attemptId);
        $this->assertEquals('SUBMITTED', $attempt->status);
        $this->assertEquals(2.0, (float) $attempt->score);

        // 6. Review exam
        $reviewRes = $this->withHeaders($headers)
            ->getJson("/api/v1/student/exams/{$this->classicalExam->id}/review/{$attemptId}");
        $reviewRes->assertStatus(200)
            ->assertJsonPath('data.attempt_id', $attemptId)
            ->assertJsonPath('data.score', 2);
    }
}
