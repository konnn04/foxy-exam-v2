<?php

namespace Tests\Feature;

use App\Models\ClassicalQuestion;
use App\Models\ClassicalQuestionAnswer;
use App\Models\Course;
use App\Models\Organization;
use App\Models\ProgrammingProblem;
use App\Models\QuestionSet;
use App\Models\TestCase as ProblemTestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuestionSetsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_view_question_sets_tab(): void
    {
        $admin = User::where('username', 'admin')->first();

        $response = $this->asSchoolAdmin($admin)->get('/admin/problem-banks');
        $response->assertOk();
        $response->assertInertia(fn ($page) => 
            $page->component('Admin/Dashboard')
                ->has('questionSets', 4)
        );
    }

    public function test_admin_can_create_classical_and_programming_question_sets(): void
    {
        $admin = User::where('username', 'admin')->first();
        $course = Course::first();

        // 1. Create Classical Question Set
        $response1 = $this->asSchoolAdmin($admin)->post('/admin/question-sets', [
            'name' => 'Bộ đề thi Triết học & Pháp luật',
            'code' => 'SET-CLAS-PHILO',
            'type' => 'CLASSICAL',
            'course_id' => $course->id,
            'description' => 'Trắc nghiệm và tự luận triết học',
            'max_score' => 10.0,
        ]);
        $response1->assertRedirect();
        $this->assertDatabaseHas('question_sets', [
            'code' => 'SET-CLAS-PHILO',
            'type' => 'CLASSICAL',
        ]);

        // 2. Create Programming Question Set
        $response2 = $this->asSchoolAdmin($admin)->post('/admin/question-sets', [
            'name' => 'Ngân hàng Thuật toán Đồ thị',
            'code' => 'SET-PROG-GRAPH',
            'type' => 'PROGRAMMING',
            'course_id' => $course->id,
            'description' => 'Các bài toán DFS, BFS, Dijkstra',
            'max_score' => 10.0,
        ]);
        $response2->assertRedirect();
        $this->assertDatabaseHas('question_sets', [
            'code' => 'SET-PROG-GRAPH',
            'type' => 'PROGRAMMING',
        ]);
    }

    public function test_admin_can_access_question_set_editor(): void
    {
        $admin = User::where('username', 'admin')->first();
        $classicalSet = QuestionSet::where('type', 'CLASSICAL')->first();
        $progSet = QuestionSet::where('type', 'PROGRAMMING')->first();

        // Classical Editor Show
        $this->asSchoolAdmin($admin)
            ->get("/admin/question-sets/{$classicalSet->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => 
                $page->component('Admin/QuestionSets/Show')
                    ->has('classicalQuestions')
                    ->where('questionSet.type', 'CLASSICAL')
            );

        // Programming Editor Show
        $this->asSchoolAdmin($admin)
            ->get("/admin/question-sets/{$progSet->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => 
                $page->component('Admin/QuestionSets/Show')
                    ->has('programmingProblems')
                    ->where('questionSet.type', 'PROGRAMMING')
            );
    }

    public function test_can_author_all_5_classical_question_types(): void
    {
        $admin = User::where('username', 'admin')->first();
        $classicalSet = QuestionSet::where('type', 'CLASSICAL')->first();

        // Type 1: Single Choice (2-4 options)
        $this->asSchoolAdmin($admin)->post("/admin/question-sets/{$classicalSet->id}/classical-questions", [
            'type' => 'SINGLE_CHOICE',
            'content' => 'Trong C++, toán tử nào dùng để truy xuất thành viên qua con trỏ?',
            'points' => 1.0,
            'difficulty' => 'EASY',
            'explanation' => 'Sử dụng toán tử mũi tên ->',
            'answers' => [
                ['content' => '.', 'is_correct' => false],
                ['content' => '->', 'is_correct' => true],
                ['content' => '::', 'is_correct' => false],
                ['content' => '*', 'is_correct' => false],
            ],
        ])->assertRedirect();

        $this->assertDatabaseHas('classical_questions', [
            'question_set_id' => $classicalSet->id,
            'type' => 'SINGLE_CHOICE',
            'content' => 'Trong C++, toán tử nào dùng để truy xuất thành viên qua con trỏ?',
        ]);

        // Type 2: Multiple Choice (2-8 options)
        $this->asSchoolAdmin($admin)->post("/admin/question-sets/{$classicalSet->id}/classical-questions", [
            'type' => 'MULTIPLE_CHOICE',
            'content' => 'Đâu là các kiểu dữ liệu nguyên thủy trong C++?',
            'points' => 2.0,
            'difficulty' => 'MEDIUM',
            'answers' => [
                ['content' => 'int', 'is_correct' => true],
                ['content' => 'float', 'is_correct' => true],
                ['content' => 'char', 'is_correct' => true],
                ['content' => 'string', 'is_correct' => false],
            ],
        ])->assertRedirect();

        // Type 3: Short Answer (1 line)
        $this->asSchoolAdmin($admin)->post("/admin/question-sets/{$classicalSet->id}/classical-questions", [
            'type' => 'SHORT_ANSWER',
            'content' => 'Viết từ khóa khai báo hàm ảo thuần túy trong C++.',
            'points' => 1.0,
            'difficulty' => 'MEDIUM',
            'explanation' => 'virtual ... = 0;',
        ])->assertRedirect();

        // Type 4: Essay (1 paragraph)
        $this->asSchoolAdmin($admin)->post("/admin/question-sets/{$classicalSet->id}/classical-questions", [
            'type' => 'ESSAY',
            'content' => 'Trình bày cơ chế bắt ngoại lệ try-catch trong C++.',
            'points' => 3.0,
            'difficulty' => 'HARD',
            'explanation' => 'Rubric: 1.5đ cho cú pháp try/catch/throw, 1.5đ cho ví dụ ngoại lệ.',
        ])->assertRedirect();

        // Type 5: Group Question (Reading Passage) with child questions
        $this->asSchoolAdmin($admin)->post("/admin/question-sets/{$classicalSet->id}/classical-questions", [
            'type' => 'GROUP_QUESTION',
            'content' => 'Đoạn văn đọc hiểu về Microservices: Microservices architecture divides an application into smaller services...',
            'points' => 2.0,
            'difficulty' => 'MEDIUM',
            'children' => [
                [
                    'type' => 'SINGLE_CHOICE',
                    'content' => 'What is the main benefit of Microservices?',
                    'points' => 1.0,
                    'difficulty' => 'EASY',
                    'answers' => [
                        ['content' => 'Independent deployment', 'is_correct' => true],
                        ['content' => 'Monolithic database', 'is_correct' => false],
                    ],
                ],
            ],
        ])->assertRedirect();

        $groupQ = ClassicalQuestion::where('type', 'GROUP_QUESTION')
            ->where('content', 'like', '%Microservices architecture%')
            ->first();
        $this->assertNotNull($groupQ);
        $this->assertDatabaseHas('classical_questions', [
            'parent_id' => $groupQ->id,
            'content' => 'What is the main benefit of Microservices?',
        ]);
    }

    public function test_can_author_programming_problem_with_test_cases(): void
    {
        $admin = User::where('username', 'admin')->first();
        $progSet = QuestionSet::where('type', 'PROGRAMMING')->first();

        $response = $this->asSchoolAdmin($admin)->post("/admin/question-sets/{$progSet->id}/programming-problems", [
            'title' => 'Bài 3: Đảo Ngược Chuỗi',
            'description' => "### Mô tả\nĐảo ngược chuỗi ký tự.\n\n### Input\nMột chuỗi S.",
            'difficulty' => 'EASY',
            'time_limit_ms' => 1000,
            'memory_limit_mb' => 128,
            'allowed_languages' => ['cpp', 'python'],
            'test_cases' => [
                [
                    'input_data' => 'hello',
                    'expected_output' => 'olleh',
                    'is_sample' => true,
                    'score_weight' => 5.0,
                ],
                [
                    'input_data' => 'foxyexam',
                    'expected_output' => 'maxeyxof',
                    'is_sample' => false,
                    'score_weight' => 5.0,
                ],
            ],
        ]);
        $response->assertRedirect();

        $problem = ProgrammingProblem::where('title', 'Bài 3: Đảo Ngược Chuỗi')->first();
        $this->assertNotNull($problem);
        $this->assertEquals(2, $problem->testCases()->count());
    }

    public function test_can_import_questions_from_bank(): void
    {
        $admin = User::where('username', 'admin')->first();
        $course = Course::first();

        // Create target set
        $targetSet = QuestionSet::create([
            'organization_id' => Organization::where('code', 'HCMUS')->value('id'), // the school the admin switched into
            'course_id' => $course->id,
            'name' => 'Đề Tổng Hợp Đợt 2',
            'code' => 'SET-IMPORT-TEST',
            'type' => 'CLASSICAL',
            'status' => 'PUBLISHED',
            'created_by' => $admin->id,
        ]);

        $sourceQuestion = ClassicalQuestion::whereNull('parent_id')->first();
        $this->assertNotNull($sourceQuestion);

        $response = $this->asSchoolAdmin($admin)->post("/admin/question-sets/{$targetSet->id}/import-questions", [
            'selected_ids' => [$sourceQuestion->id],
        ]);
        $response->assertRedirect();

        $this->assertDatabaseHas('classical_questions', [
            'question_set_id' => $targetSet->id,
            'content' => $sourceQuestion->content,
        ]);
    }
}
