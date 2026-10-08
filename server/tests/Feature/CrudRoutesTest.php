<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Exam;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\ProgrammingProblem;
use App\Models\User;
use App\Services\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CrudRoutesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_platform_context_only_offers_organizations_plans_and_root_accounts(): void
    {
        $admin = User::where('username', 'admin')->first();
        $this->assertNotNull($admin);
        $org = Organization::where('code', '!=', 'ROOT')->first();

        // platform pages
        foreach (['/admin/organizations/new', "/admin/organizations/{$org->id}/edit", '/admin/users/new', "/admin/users/{$admin->id}/edit", '/admin/organizations', '/admin/saas-plans', '/admin/users'] as $url) {
            $this->actingAs($admin)->get($url)->assertOk();
        }

        // everything that belongs to a school is out of reach until the Super Admin switches into one
        $course = Course::first();
        $exam = Exam::first();
        foreach (['/admin', '/admin/courses', '/admin/courses/new', "/admin/courses/{$course->id}", '/admin/exams', "/admin/exams/{$exam->id}", '/admin/problem-banks', '/admin/reports', '/admin/live', '/admin/settings'] as $url) {
            $this->actingAs($admin)->get($url)->assertRedirect('/admin/organizations');
        }
    }

    public function test_school_context_pages_for_a_super_admin(): void
    {
        $admin = User::where('username', 'admin')->first();
        $this->asSchoolAdmin($admin);

        foreach (['/admin/courses/new', '/admin/exams/new/general', '/admin/exams/new/programming', '/admin/users/new', '/admin/courses', '/admin/exams', '/admin/problem-banks'] as $url) {
            $this->get($url)->assertOk();
        }

        $course = Course::first();
        $this->get("/admin/courses/{$course->id}")->assertOk();
        $this->get("/admin/courses/{$course->id}/edit")->assertOk();

        $exam = Exam::first();
        $this->get("/admin/exams/{$exam->id}")->assertOk();
        $this->get("/admin/exams/{$exam->id}/edit")->assertOk();

        // "Tạo kỳ thi" is a dialog on the list, not a page
        $this->get('/admin/exams/new')->assertRedirect('/admin/exams?create=1');

        // the school has no platform pages
        $this->get('/admin/organizations')->assertRedirect('/admin');
        $this->get('/admin/billing')->assertRedirect('/admin');
    }

    public function test_can_create_update_and_delete_course(): void
    {
        $admin = User::where('username', 'admin')->first();
        $this->asSchoolAdmin($admin);
        $hcmus = Organization::where('code', 'HCMUS')->first();

        // 1. Create
        $res = $this->post('/admin/courses', [
            'name' => 'Lập trình C++ Nâng cao',
            'code' => 'CPP201',
            'description' => 'Môn học mới test CRUD',
            'teacher_id' => User::where('username', 'teacher_hcmus')->value('id'),
        ]);
        $res->assertRedirect('/admin/courses');

        $createdCourse = Course::where('code', 'CPP201')->first();
        $this->assertNotNull($createdCourse);
        $this->assertEquals('Lập trình C++ Nâng cao', $createdCourse->name);
        $this->assertEquals($hcmus->id, $createdCourse->organization_id); // the ACTIVE org, not the admin's own (ROOT)

        // 2. Update
        $this->post("/admin/courses/{$createdCourse->id}/update", [
            'name' => 'Lập trình C++ Chuyên sâu',
            'code' => 'CPP201_V2',
            'description' => 'Cập nhật môn học',
        ])->assertRedirect()->assertSessionHas('success');

        $createdCourse->refresh();
        $this->assertEquals('Lập trình C++ Chuyên sâu', $createdCourse->name);
        $this->assertEquals('CPP201_V2', $createdCourse->code);

        // 3. Delete
        $this->post("/admin/courses/{$createdCourse->id}/delete")->assertRedirect('/admin/courses');
        $this->assertNull(Course::where('code', 'CPP201_V2')->first());
    }

    public function test_course_teacher_must_belong_to_the_organization(): void
    {
        $admin = User::where('username', 'admin')->first(); // a ROOT account
        $this->asSchoolAdmin($admin);

        $this->post('/admin/courses', ['name' => 'X', 'code' => 'X1', 'teacher_id' => $admin->id])
            ->assertSessionHasErrors('teacher_id');
        $this->assertNull(Course::where('code', 'X1')->first());
    }

    public function test_standalone_problem_routes_were_folded_into_question_sets(): void
    {
        $admin = User::where('username', 'admin')->first();
        $this->asSchoolAdmin($admin);
        $prob = ProgrammingProblem::whereNotNull('question_set_id')->first();

        $this->get('/admin/problems/new')->assertRedirect('/admin/question-sets/new/programming');
        $this->get("/admin/problems/{$prob->id}/edit")->assertRedirect("/admin/question-sets/{$prob->question_set_id}/problems/{$prob->id}");

        // the old mutation endpoints no longer exist (problems are saved with their question set)
        $this->post('/admin/problems', ['title' => 'x'])->assertStatus(404);
        $this->post("/admin/problems/{$prob->id}/delete")->assertStatus(404);
    }

    public function test_cannot_access_organizations_outside_root_context(): void
    {
        $orgAdmin = User::where('username', 'admin_hcmus')->first();
        $this->assertNotNull($orgAdmin);

        // 1. Org admin: pages bounce home, mutations are refused
        $this->actingAs($orgAdmin)->get('/admin/organizations/new')->assertRedirect('/admin');
        $this->actingAs($orgAdmin)->post('/admin/organizations', ['name' => 'x', 'code' => 'XX', 'type' => 'CENTER'])->assertForbidden();
        $this->actingAs($orgAdmin)->post('/admin/plans', ['name' => 'X'])->assertForbidden();

        // 2. Super admin inside a school is just that school's admin
        $superAdmin = User::where('username', 'admin')->first();
        $this->asSchoolAdmin($superAdmin)->get('/admin/organizations/new')->assertRedirect('/admin');
        $this->post('/admin/organizations', ['name' => 'x', 'code' => 'XX', 'type' => 'CENTER'])->assertForbidden();
        $this->post('/admin/plans', ['name' => 'X'])->assertForbidden();

        // 3. Organizations tab while scoped to a school goes to the school overview
        $this->get('/admin?tab=organizations')->assertRedirect('/admin');
    }

    public function test_user_creation_preserves_scoped_organization_and_redirects_with_org_id(): void
    {
        $superAdmin = User::where('username', 'admin')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();
        $this->assertNotNull($hcmus);

        // Tạo user khi đang ở ngữ cảnh HCMUS (?org_id=...)
        $response = $this->asSchoolAdmin($superAdmin)
            ->post("/admin/users", [
                'username' => 'teacher_test_hcmus',
                'name' => 'Nguyễn Văn Test',
                'email' => 'test_hcmus@edu.vn',
                'password' => 'secret123',
                'role' => 'TEACHER',
            ]);

        $response->assertRedirect("/admin/users?org_id={$hcmus->id}");
        $response->assertCookie('foxy_active_org_id', (string)$hcmus->id);

        $createdUser = User::where('username', 'teacher_test_hcmus')->first();
        $this->assertNotNull($createdUser);
        $this->assertEquals($hcmus->id, $createdUser->organization_id);
        $this->assertNotEquals(1, $createdUser->organization_id);
        $this->assertEquals('TEACHER', $createdUser->role);
    }

    public function test_cannot_create_super_admin_in_non_root_organization(): void
    {
        $superAdmin = User::where('username', 'admin')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();

        // Cố tình gán SUPER_ADMIN cho trường học HCMUS
        // inside HCMUS (switched context): the role may not be SUPER_ADMIN
        $response = $this->asSchoolAdmin($superAdmin)->post("/admin/users", [
            'username' => 'illegal_super_admin',
            'name' => 'Hacker Admin',
            'email' => 'illegal@hcmus.edu.vn',
            'password' => 'secret123',
            'role' => 'SUPER_ADMIN',
        ]);

        $response->assertSessionHasErrors('role');
        $this->assertNull(User::where('username', 'illegal_super_admin')->first());
    }

    public function test_can_create_super_admin_in_root_organization(): void
    {
        $superAdmin = User::where('username', 'admin')->first();
        $rootOrg = Organization::where('code', 'ROOT')->first();

        $response = $this->actingAs($superAdmin)->post("/admin/users", [
            'organization_id' => $rootOrg->id,
            'username' => 'legal_root_admin',
            'name' => 'Legal Root Admin',
            'email' => 'legal_root@foxyexam.com',
            'password' => 'secret123',
            'role' => 'SUPER_ADMIN',
        ]);

        $response->assertRedirect("/admin/users?org_id={$rootOrg->id}");
        $created = User::where('username', 'legal_root_admin')->first();
        $this->assertNotNull($created);
        $this->assertEquals($rootOrg->id, $created->organization_id);
        $this->assertEquals('SUPER_ADMIN', $created->role);
    }

    public function test_cannot_update_non_root_user_to_super_admin(): void
    {
        $superAdmin = User::where('username', 'admin')->first();
        $teacher = User::where('username', 'teacher_hcmus')->first();
        $this->assertNotNull($teacher);

        $response = $this->asSchoolAdmin($superAdmin)->post("/admin/users/{$teacher->id}/update", [
            'name' => $teacher->name,
            'username' => $teacher->username,
            'email' => $teacher->email,
            'role' => 'SUPER_ADMIN',
            'status' => 'ACTIVE',
            'organization_id' => $teacher->organization_id,
        ]);

        $response->assertSessionHasErrors('role');
        $teacher->refresh();
        $this->assertNotEquals('SUPER_ADMIN', $teacher->role);
    }

    public function test_tenant_admin_cannot_access_or_edit_cross_tenant_user(): void
    {
        $hcmusAdmin = User::where('username', 'admin_hcmus')->first();
        $rootAdmin = User::where('username', 'admin')->first();
        $this->assertNotNull($hcmusAdmin);
        $this->assertNotNull($rootAdmin);

        // Org admin của HCMUS cố tình xem hoặc sửa tài khoản của ROOT
        $this->actingAs($hcmusAdmin)
            ->get("/admin/users/{$rootAdmin->id}")
            ->assertForbidden();

        $this->actingAs($hcmusAdmin)
            ->get("/admin/users/{$rootAdmin->id}/edit")
            ->assertForbidden();

        $this->actingAs($hcmusAdmin)
            ->post("/admin/users/{$rootAdmin->id}/update", [
                'username' => 'hacked_admin',
                'email' => 'hacked@root.com',
                'role' => 'TEACHER',
                'status' => 'ACTIVE',
            ])
            ->assertForbidden();

        $rootAdmin->refresh();
        $this->assertEquals('admin', $rootAdmin->username);
    }

    public function test_tenant_admin_cannot_access_or_edit_cross_tenant_course(): void
    {
        $hcmusAdmin = User::where('username', 'admin_hcmus')->first();
        $rootOrg = Organization::where('code', 'ROOT')->first();

        // Tạo khóa học thuộc ROOT
        $rootCourse = Course::create([
            'organization_id' => $rootOrg->id,
            'name' => 'Khóa học ROOT bí mật',
            'code' => 'ROOT101',
        ]);

        // Org admin HCMUS không được phép xem hoặc sửa khóa học của ROOT (bị chặn bởi 403 hoặc 404)
        $res1 = $this->actingAs($hcmusAdmin)->get("/admin/courses/{$rootCourse->id}");
        $this->assertTrue(in_array($res1->status(), [403, 404]));

        $res2 = $this->actingAs($hcmusAdmin)->get("/admin/courses/{$rootCourse->id}/edit");
        $this->assertTrue(in_array($res2->status(), [403, 404]));

        $res3 = $this->actingAs($hcmusAdmin)->post("/admin/courses/{$rootCourse->id}/update", [
            'name' => 'Bị sửa bởi HCMUS',
            'code' => 'HACKED',
        ]);
        $this->assertTrue(in_array($res3->status(), [403, 404]));

        $rootCourse->refresh();
        $this->assertEquals('Khóa học ROOT bí mật', $rootCourse->name);
    }

    public function test_tenant_admin_cannot_access_or_edit_cross_tenant_exam(): void
    {
        $hcmusAdmin = User::where('username', 'admin_hcmus')->first();
        $rootOrg = Organization::where('code', 'ROOT')->first();
        $rootCourse = Course::where('organization_id', $rootOrg->id)->first() ?? Course::first();

        $rootExam = Exam::create([
            'organization_id' => $rootOrg->id,
            'course_id' => $rootCourse->id,
            'title' => 'Đề thi ROOT Tuyệt mật',
            'code' => 'EXAM-ROOT-SEC',
            'type' => 'QUIZ',
            'duration_minutes' => 60,
            'status' => 'PUBLISHED',
        ]);

        // Org admin HCMUS không được phép xem/sửa đề thi của ROOT
        $res1 = $this->actingAs($hcmusAdmin)->get("/admin/exams/{$rootExam->id}");
        $this->assertTrue(in_array($res1->status(), [403, 404]));

        $res2 = $this->actingAs($hcmusAdmin)->get("/admin/exams/{$rootExam->id}/edit");
        $this->assertTrue(in_array($res2->status(), [403, 404]));

        $res3 = $this->actingAs($hcmusAdmin)->post("/admin/exams/{$rootExam->id}/update", [
            'title' => 'Đã bị chiếm quyền',
            'course_id' => $rootCourse->id,
            'duration_minutes' => 120,
            'status' => 'DRAFT',
        ]);
        $this->assertTrue(in_array($res3->status(), [403, 404]));

        $rootExam->refresh();
        $this->assertEquals('Đề thi ROOT Tuyệt mật', $rootExam->title);
    }

    public function test_switch_organization_updates_session_and_cookie_and_redirects_safely(): void
    {
        $superAdmin = User::where('username', 'admin')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();

        $response = $this->actingAs($superAdmin)->post('/admin/switch-organization', [
            'org_id' => $hcmus->id,
            'redirect_to' => '/admin/users?org_id=1',
        ]);

        // the query string of the old page is dropped; accounts exist in every context so the page stays
        $response->assertRedirect('/admin/users');
        $response->assertSessionHas('foxy_active_org_id', $hcmus->id);
        $response->assertCookie('foxy_active_org_id', (string)$hcmus->id);
    }

    public function test_switching_to_non_root_redirects_away_from_root_only_tabs(): void
    {
        $superAdmin = User::where('username', 'admin')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();

        $response = $this->actingAs($superAdmin)->post('/admin/switch-organization', [
            'org_id' => $hcmus->id,
            'redirect_to' => '/admin/organizations',
        ]);

        // When switching from ROOT to HCMUS while on organizations management, land on the school overview
        $response->assertRedirect('/admin');
    }

    public function test_switch_organization_forbidden_for_non_super_admin(): void
    {
        $hcmusAdmin = User::where('username', 'admin_hcmus')->first();
        $rootOrg = Organization::where('code', 'ROOT')->first();

        $response = $this->actingAs($hcmusAdmin)->post('/admin/switch-organization', [
            'org_id' => $rootOrg->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_tenant_admin_teams_list_only_contains_their_own_organization(): void
    {
        $hcmusAdmin = User::where('username', 'admin_hcmus')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();

        $this->actingAs($hcmusAdmin);
        $tenantContext = app(TenantContext::class);
        $teams = $tenantContext->teams();

        $this->assertCount(1, $teams);
        $this->assertEquals($hcmus->id, $teams[0]['id']);
        $this->assertEquals('HCMUS', $teams[0]['code']);

        // Test in Inertia shared props
        $response = $this->get('/admin/users');
        $response->assertOk();
        $response->assertInertia(fn ($page) => 
            $page->has('tenant.teams', 1)
                ->where('tenant.teams.0.code', 'HCMUS')
                ->where('tenant.is_root', false)
        );
    }
}

