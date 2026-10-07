<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Exam;
use App\Models\Organization;
use App\Models\QuestionSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamQuestionSetBindingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_create_exam_bound_to_classical_question_set(): void
    {
        $admin = User::where('username', 'admin')->first();
        $course = Course::first();
        $questionSet = QuestionSet::where('type', 'CLASSICAL')->first();

        $response = $this->asSchoolAdmin($admin)->post('/admin/exams', [
            'course_id' => $course->id,
            'question_set_id' => $questionSet->id,
            'title' => 'Kỳ thi Trắc nghiệm Lập trình C++',
            'duration_minutes' => 60,
            'prevent_tab_switch' => true,
            'ai_face_check' => true,
            'is_shuffle_questions' => true,
            'is_shuffle_answers' => true,
            'is_hide_score' => true,
            'is_allow_review' => true,
            'number_questions_per_page' => 1,
            'require_mic' => false,
        ]);

        $response->assertRedirect('/admin/exams');

        $exam = Exam::where('title', 'Kỳ thi Trắc nghiệm Lập trình C++')->first();
        $this->assertNotNull($exam);
        $this->assertEquals($questionSet->id, $exam->question_set_id);
        $this->assertEquals('QUIZ', $exam->type);
        $this->assertTrue($exam->monitoring_config['is_shuffle_questions']);
        $this->assertTrue($exam->monitoring_config['is_shuffle_answers']);
        $this->assertTrue($exam->monitoring_config['is_hide_score']);
        $this->assertEquals('CLASSICAL', $exam->monitoring_config['type']);
    }

    public function test_can_create_exam_bound_to_programming_question_set(): void
    {
        $admin = User::where('username', 'admin')->first();
        $course = Course::first();
        $questionSet = QuestionSet::where('type', 'PROGRAMMING')->first();

        $response = $this->asSchoolAdmin($admin)->post('/admin/exams', [
            'course_id' => $course->id,
            'question_set_id' => $questionSet->id,
            'title' => 'Kỳ thi Lập trình Giải thuật Đồ thị',
            'duration_minutes' => 90,
            'prevent_tab_switch' => true,
            'ai_face_check' => true,
            'prevent_paste' => true,
            'max_paste_chars' => 50,
            'track_keystroke' => true,
        ]);

        $response->assertRedirect('/admin/exams');

        $exam = Exam::where('title', 'Kỳ thi Lập trình Giải thuật Đồ thị')->first();
        $this->assertNotNull($exam);
        $this->assertEquals($questionSet->id, $exam->question_set_id);
        $this->assertEquals('PROGRAMMING', $exam->type);
        $this->assertTrue($exam->monitoring_config['prevent_paste']);
        $this->assertEquals(50, $exam->monitoring_config['max_paste_chars']);
        $this->assertTrue($exam->monitoring_config['track_keystroke_dynamics']);
    }

    public function test_root_user_query_only_returns_root_users(): void
    {
        $admin = User::where('username', 'admin')->first();

        // At ROOT (/admin/users without tenant org_id)
        $response = $this->actingAs($admin)->get('/admin/users');
        $response->assertOk();
        $response->assertInertia(fn ($page) => 
            $page->component('Admin/Dashboard')
                // Seeded DB has 1 user belonging to ROOT (id=1, username=admin)
                ->has('usersList', 1)
                ->where('usersList.0.username', 'admin')
        );
    }

    public function test_school_context_has_no_billing_and_redirects_home(): void
    {
        $admin = User::where('username', 'admin')->first();

        // /admin/billing now lives inside the platform's "Gói cước" page; a school has no billing at all
        $this->asSchoolAdmin($admin)->get('/admin/billing')->assertRedirect('/admin');
        $this->asSchoolAdmin($admin)->post('/admin/invoices/1/confirm')->assertForbidden();
    }

    public function test_switching_organization_persists_in_cookie_and_session(): void
    {
        $admin = User::where('username', 'admin')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();

        // 1. Truy cập với ?org_id=HCMUS -> Server phải set cookie foxy_active_org_id
        $response = $this->actingAs($admin)->get('/admin/users?org_id=' . $hcmus->id);
        $response->assertOk();
        $response->assertCookie('foxy_active_org_id', (string)$hcmus->id);

        // 2. Lần truy cập tiếp theo vào /admin/users KHÔNG kèm ?org_id= vẫn duy trì ở HCMUS
        $response2 = $this->actingAs($admin)
            ->withCookie('foxy_active_org_id', (string)$hcmus->id)
            ->get('/admin/users');
        $response2->assertOk();
        $response2->assertInertia(fn ($page) => 
            $page->component('Admin/Dashboard')
                ->where('selectedOrgId', $hcmus->id)
        );
    }
}
