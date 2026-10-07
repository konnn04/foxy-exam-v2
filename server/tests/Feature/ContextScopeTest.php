<?php

namespace Tests\Feature;

use App\Models\ClassicalQuestion;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Organization;
use App\Models\ProgrammingProblem;
use App\Models\QuestionSet;
use App\Models\User;
use App\Models\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What a user can do depends on the ACTIVE organization, decided by the server:
 *  - ROOT (platform) context: only organizations, plans and root accounts;
 *  - a school context (also for a Super Admin who switched in): that school's own data only.
 */
class ContextScopeTest extends TestCase
{
    use RefreshDatabase;

    private Organization $school;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->school = Organization::where('code', 'HCMUS')->firstOrFail();
    }

    private function otherSchool(): array
    {
        $org = Organization::create(['name' => 'Other School', 'code' => 'OTHR', 'slug' => 'othr', 'type' => 'UNIVERSITY', 'status' => 'ACTIVE', 'is_public' => false]);
        $owner = User::create(['organization_id' => $org->id, 'name' => 'B Admin', 'username' => 'badmin', 'email' => 'b@x.test', 'password' => 'x', 'role' => 'ORG_ADMIN', 'status' => 'ACTIVE']);
        $course = Course::create(['organization_id' => $org->id, 'name' => 'CB', 'code' => 'CB1', 'teacher_id' => $owner->id]);
        $set = QuestionSet::create(['organization_id' => $org->id, 'name' => 'SB', 'code' => 'SB1', 'type' => 'CLASSICAL', 'status' => 'DRAFT', 'max_score' => 10, 'created_by' => $owner->id]);
        $question = ClassicalQuestion::create(['question_set_id' => $set->id, 'type' => 'ESSAY', 'content' => 'secret', 'points' => 1, 'difficulty' => 'EASY', 'order' => 1]);
        $progSet = QuestionSet::create(['organization_id' => $org->id, 'name' => 'PB', 'code' => 'PB1', 'type' => 'PROGRAMMING', 'status' => 'DRAFT', 'max_score' => 100, 'created_by' => $owner->id]);
        $problem = ProgrammingProblem::create(['question_set_id' => $progSet->id, 'title' => 'P', 'description' => 'd', 'difficulty' => 'EASY', 'time_limit_ms' => 1000, 'memory_limit_mb' => 64, 'order' => 1]);
        $exam = Exam::create(['organization_id' => $org->id, 'course_id' => $course->id, 'question_set_id' => $set->id, 'title' => 'EB', 'code' => 'EB-1', 'type' => 'QUIZ', 'status' => 'PUBLISHED', 'duration_minutes' => 30, 'created_by' => $owner->id]);
        $attempt = ExamAttempt::create(['exam_id' => $exam->id, 'user_id' => $owner->id, 'attempt_number' => 1, 'status' => 'SUBMITTED']);
        $violation = Violation::create(['exam_attempt_id' => $attempt->id, 'violation_type' => 'LOOKING_AWAY', 'severity' => 'LOW', 'timestamp' => now()]);

        return compact('org', 'owner', 'course', 'set', 'question', 'progSet', 'problem', 'exam', 'attempt', 'violation');
    }

    public function test_capabilities_follow_the_active_organization_not_the_account(): void
    {
        $super = User::where('username', 'admin')->first();

        // platform
        $this->actingAs($super)->get('/admin/organizations')->assertInertia(fn ($p) => $p
            ->where('tenant.is_platform', true)
            ->where('tenant.can.organizations', true)
            ->where('tenant.can.managePlans', true)
            ->where('tenant.can.academic', false)
            ->where('tenant.can.quota', false));

        // the same account inside a school behaves like that school's Org Admin
        $this->asSchoolAdmin($super)->get('/admin')->assertInertia(fn ($p) => $p
            ->where('tenant.is_platform', false)
            ->where('tenant.can.organizations', false)
            ->where('tenant.can.managePlans', false)
            ->where('tenant.can.billing', false)
            ->where('tenant.can.academic', true)
            ->where('tenant.can.quota', true)
            ->where('tenant.can.switchOrganization', true));

        // a teacher: academic only
        $teacher = User::where('username', 'teacher_hcmus')->first();
        $this->actingAs($teacher)->get('/lecturer/courses')->assertInertia(fn ($p) => $p
            ->where('tenant.can.academic', true)->where('tenant.can.users', false)->where('tenant.can.quota', false)->where('tenant.can.orgSettings', false));
    }

    public function test_route_matrix_per_context_and_role(): void
    {
        $super = User::where('username', 'admin')->first();
        $orgAdmin = User::where('username', 'admin_hcmus')->first();
        $teacher = User::where('username', 'teacher_hcmus')->first();
        $student = User::where('username', 'student01')->first();

        // platform: three sections, everything school-related bounces to the organization list
        foreach (['/admin/organizations', '/admin/saas-plans', '/admin/users'] as $url) {
            $this->actingAs($super)->get($url)->assertOk();
        }
        foreach (['/admin', '/admin/courses', '/admin/exams', '/admin/reports', '/admin/live', '/admin/settings'] as $url) {
            $this->actingAs($super)->get($url)->assertRedirect('/admin/organizations');
        }
        // /lecturer is the lecturers' address: an admin is sent back to /admin
        $this->actingAs($super)->get('/lecturer')->assertRedirect('/admin');

        // org admin and a super admin inside the school: identical reach
        foreach ([$orgAdmin, $super] as $who) {
            $this->asSchoolAdmin($who);
            foreach (['/admin', '/admin/courses', '/admin/exams', '/admin/problem-banks', '/admin/live', '/admin/users', '/admin/saas-plans', '/admin/settings'] as $url) {
                $this->get($url)->assertOk();
            }
            $this->get('/admin/organizations')->assertRedirect('/admin');
            $this->get('/admin/reports')->assertRedirect('/admin/live');
            $this->get('/admin/switcher/organizations')->assertStatus($who->role === 'SUPER_ADMIN' ? 200 : 302);
        }

        // teacher: academic pages yes, administration no
        foreach (['/lecturer', '/lecturer/courses', '/lecturer/exams', '/lecturer/problem-banks', '/lecturer/live'] as $url) {
            $this->actingAs($teacher)->get($url)->assertOk();
        }
        foreach (['/lecturer/users', '/lecturer/saas-plans', '/lecturer/settings', '/lecturer/organizations'] as $url) {
            $this->actingAs($teacher)->get($url)->assertRedirect('/lecturer');
        }

        // students have no portal at all (and must not be bounced in a loop)
        $this->actingAs($student)->get('/admin')->assertForbidden();
        $this->actingAs($student)->get('/admin/exams')->assertForbidden();
    }

    public function test_legacy_tab_parameter_cannot_reach_a_section_of_another_context(): void
    {
        $super = User::where('username', 'admin')->first();

        // in a school, ?tab=organizations must not list every organization
        $this->asSchoolAdmin($super)->get('/admin?tab=organizations')->assertRedirect('/admin');
        $this->get('/admin?tab=saas-plans')->assertOk();

        // in the platform, ?tab=courses must not leak a school's courses
        $this->actingAs($super)->withSession(['foxy_active_org_id' => Organization::where('code', 'ROOT')->value('id')])
            ->get('/admin?tab=courses')->assertRedirect('/admin/organizations');
    }

    public function test_school_cannot_edit_plans_or_settle_invoices_even_for_a_super_admin(): void
    {
        $super = User::where('username', 'admin')->first();
        $orgAdmin = User::where('username', 'admin_hcmus')->first();

        foreach ([$orgAdmin] as $who) {
            $this->actingAs($who)->post('/admin/plans', ['name' => 'X'])->assertForbidden();
            $this->actingAs($who)->post('/admin/plans/1/update', [])->assertForbidden();
            $this->actingAs($who)->post('/admin/plans/1/delete')->assertForbidden();
            $this->actingAs($who)->post('/admin/invoices/1/confirm')->assertForbidden();
            $this->actingAs($who)->post('/admin/organizations', ['name' => 'x', 'code' => 'X', 'type' => 'CENTER'])->assertForbidden();
        }

        $this->asSchoolAdmin($super);
        $this->post('/admin/plans', ['name' => 'X'])->assertForbidden();
        $this->post('/admin/plans/1/delete')->assertForbidden();
        $this->post('/admin/invoices/1/confirm')->assertForbidden();
    }

    public function test_organization_switcher_search_is_paged_and_super_admin_only(): void
    {
        $super = User::where('username', 'admin')->first();
        for ($i = 1; $i <= 40; $i++) {
            Organization::create(['name' => "Truong Thu {$i}", 'code' => "T{$i}", 'slug' => "t{$i}", 'type' => 'CENTER', 'status' => 'ACTIVE', 'is_public' => false]);
        }

        $page1 = $this->actingAs($super)->getJson('/admin/switcher/organizations')->assertOk()->json();
        $this->assertCount(15, $page1['data']);
        $this->assertTrue($page1['has_more']);
        $this->assertSame('ROOT', $page1['root']['code']);
        $this->assertNotContains('ROOT', array_column($page1['data'], 'code')); // ROOT is the fixed first option, not a list row

        $page3 = $this->getJson('/admin/switcher/organizations?page=3')->assertOk()->json();
        $this->assertNotEmpty($page3['data']);

        $hit = $this->getJson('/admin/switcher/organizations?q=Thu%2037')->assertOk()->json();
        $this->assertSame(['T37'], array_column($hit['data'], 'code'));
        $this->assertFalse($hit['has_more']);

        // wildcard characters are literals, not patterns
        $this->assertSame([], $this->getJson('/admin/switcher/organizations?q=%25')->json('data'));

        $this->actingAs(User::where('username', 'admin_hcmus')->first())->getJson('/admin/switcher/organizations')->assertForbidden();
        $this->actingAs(User::where('username', 'teacher_hcmus')->first())->getJson('/admin/switcher/organizations')->assertForbidden();
    }

    public function test_only_the_active_organization_is_shared_with_the_page(): void
    {
        $super = User::where('username', 'admin')->first();
        for ($i = 1; $i <= 30; $i++) {
            Organization::create(['name' => "S{$i}", 'code' => "S{$i}", 'slug' => "s{$i}", 'type' => 'CENTER', 'status' => 'ACTIVE', 'is_public' => false]);
        }

        $this->asSchoolAdmin($super)->get('/admin')->assertInertia(fn ($p) => $p
            ->has('tenant.teams', 1)->where('tenant.teams.0.code', 'HCMUS')->where('tenant.current.code', 'HCMUS'));
    }

    public function test_organization_list_is_filtered_and_paged_on_the_server(): void
    {
        $super = User::where('username', 'admin')->first();
        for ($i = 1; $i <= 25; $i++) {
            Organization::create(['name' => "Hoc vien {$i}", 'code' => "HV{$i}", 'slug' => "hv{$i}", 'type' => 'CENTER', 'status' => $i % 5 === 0 ? 'SUSPENDED' : 'ACTIVE', 'is_public' => false]);
        }

        $this->actingAs($super)->get('/admin/organizations?per=10')->assertInertia(fn ($p) => $p
            ->has('organizations', 10)->where('listMeta.total', 29)->where('listMeta.last_page', 3));

        $this->get('/admin/organizations?per=10&page=3')->assertInertia(fn ($p) => $p->has('organizations', 9)->where('listMeta.page', 3));
        $this->get('/admin/organizations?q=Hoc%20vien%2012')->assertInertia(fn ($p) => $p->has('organizations', 1)->where('organizations.0.code', 'HV12'));
        $this->get('/admin/organizations?status=SUSPENDED&per=50')->assertInertia(fn ($p) => $p->has('organizations', 5)->where('listMeta.filters.status', 'SUSPENDED'));
        $this->get('/admin/organizations?plan=PRO')->assertInertia(fn ($p) => $p->has('organizations', 2));
    }

    public function test_switching_stores_the_organization_server_side_and_a_forged_org_id_does_nothing_on_post(): void
    {
        $super = User::where('username', 'admin')->first();
        $hcmus = $this->school;

        $this->actingAs($super)->post('/admin/switch-organization', ['org_id' => $hcmus->id, 'redirect_to' => '/admin/courses'])
            ->assertRedirect('/admin/courses')->assertSessionHas('foxy_active_org_id', $hcmus->id)->assertCookie('foxy_active_org_id');

        // the choice sticks without any query string
        $this->get('/admin')->assertInertia(fn ($p) => $p->where('tenant.current.code', 'HCMUS'));

        // back to the platform lands on the organization list; a school page falls back to it too
        $root = Organization::where('code', 'ROOT')->first();
        $this->post('/admin/switch-organization', ['org_id' => $root->id, 'redirect_to' => '/admin/exams'])->assertRedirect('/admin/organizations');

        // mutations ignore ?org_id: a POST can never change the active organization
        $this->actingAs($super)->withSession(['foxy_active_org_id' => $hcmus->id])
            ->post('/admin/courses?org_id=' . $root->id, ['name' => 'N', 'code' => 'N1', 'teacher_id' => User::where('username', 'teacher_hcmus')->value('id')]);
        $this->assertSame($hcmus->id, Course::where('code', 'N1')->value('organization_id'));
    }

    public function test_nothing_leaks_between_organizations_for_admins_teachers_and_a_super_admin_inside_a_school(): void
    {
        $x = $this->otherSchool();
        $mine = QuestionSet::where('organization_id', $this->school->id)->first();
        $myCourse = Course::where('organization_id', $this->school->id)->first();

        $attacks = [
            ['GET', "/admin/exams/{$x['exam']->id}"], ['GET', "/admin/exams/{$x['exam']->id}/edit"], ['POST', "/admin/exams/{$x['exam']->id}/delete"],
            ['POST', "/admin/exams/{$x['exam']->id}/update", ['title' => 'pwn', 'course_id' => $myCourse->id, 'duration_minutes' => 30, 'status' => 'DRAFT']],
            ['GET', "/admin/exams/{$x['exam']->id}/live"], ['POST', "/admin/exams/{$x['exam']->id}/end"], ['GET', "/admin/reports/{$x['exam']->id}"],
            ['GET', "/admin/attempts/{$x['attempt']->id}"], ['GET', "/admin/attempts/{$x['attempt']->id}/submissions"],
            ['POST', "/admin/violations/{$x['violation']->id}/review", ['decision' => 'confirmed']],
            ['GET', "/admin/courses/{$x['course']->id}"], ['GET', "/admin/courses/{$x['course']->id}/edit"], ['POST', "/admin/courses/{$x['course']->id}/delete"],
            ['POST', "/admin/courses/{$x['course']->id}/update", ['name' => 'pwn', 'code' => 'pwn']],
            ['GET', "/admin/question-sets/{$x['set']->id}"], ['POST', "/admin/question-sets/{$x['set']->id}/update", ['name' => 'pwn', 'code' => 'PWN', 'status' => 'DRAFT']],
            ['POST', "/admin/question-sets/{$x['set']->id}/delete"],
            ['POST', "/admin/question-sets/{$x['set']->id}/classical-questions", ['type' => 'ESSAY', 'content' => 'pwn', 'difficulty' => 'EASY']],
            ['POST', "/admin/classical-questions/{$x['question']->id}/delete"],
            ['POST', "/admin/question-sets/{$x['progSet']->id}/programming-problems", ['title' => 'pwn', 'description' => 'x', 'difficulty' => 'EASY', 'time_limit_ms' => 1000, 'memory_limit_mb' => 64]],
            ['POST', "/admin/programming-problems/{$x['problem']->id}/delete"],
            ['GET', "/admin/question-sets/{$x['progSet']->id}/problems/{$x['problem']->id}"], ['GET', "/admin/problems/{$x['problem']->id}/edit"],
            ['POST', "/admin/question-sets/{$mine->id}/import-questions", ['selected_ids' => [$x['question']->id]]],
            ['GET', "/admin/users/{$x['owner']->id}"], ['GET', "/admin/users/{$x['owner']->id}/edit"], ['POST', "/admin/users/{$x['owner']->id}/delete"],
            ['POST', '/admin/exams', ['title' => 'pwn', 'course_id' => $x['course']->id, 'question_set_id' => $x['set']->id, 'duration_minutes' => 30]],
            ['POST', '/admin/question-sets', ['name' => 'pwn', 'code' => 'NEWX', 'type' => 'CLASSICAL', 'course_id' => $x['course']->id]],
            ['POST', '/admin/courses', ['name' => 'pwn', 'code' => 'pwn', 'teacher_id' => $x['owner']->id]],
        ];

        $actors = [User::where('username', 'admin_hcmus')->first(), User::where('username', 'teacher_hcmus')->first()];
        foreach ($actors as $actor) {
            foreach ($attacks as $a) {
                $this->actingAs($actor);
                $res = $this->call($a[0], $a[1], $a[2] ?? []);
                $this->assertContains($res->getStatusCode(), [302, 403, 404, 422], "{$actor->username} {$a[0]} {$a[1]} => {$res->getStatusCode()}");
            }
        }
        $super = User::where('username', 'admin')->first();
        foreach ($attacks as $a) {
            $this->asSchoolAdmin($super);
            $res = $this->call($a[0], $a[1], $a[2] ?? []);
            $this->assertContains($res->getStatusCode(), [302, 403, 404, 422], "super-in-school {$a[0]} {$a[1]} => {$res->getStatusCode()}");
        }

        // and nothing of the other school changed or was copied
        $this->assertSame('EB', $x['exam']->fresh()->title);
        $this->assertSame('PUBLISHED', $x['exam']->fresh()->status);
        $this->assertNotNull($x['course']->fresh());
        $this->assertNotNull($x['set']->fresh());
        $this->assertNotNull($x['question']->fresh());
        $this->assertNotNull($x['problem']->fresh());
        $this->assertNotNull($x['owner']->fresh());
        $this->assertFalse((bool) $x['violation']->fresh()->is_reviewed);
        $this->assertSame(0, ClassicalQuestion::where('content', 'secret')->where('question_set_id', '!=', $x['set']->id)->count());
        $this->assertSame(0, ClassicalQuestion::where('content', 'pwn')->count());
        $this->assertSame(0, Exam::where('title', 'pwn')->count());
        $this->assertSame(0, QuestionSet::where('code', 'NEWX')->count());
        $this->assertSame(0, Course::where('name', 'pwn')->count());
    }

    public function test_flash_messages_are_shared_for_toasts(): void
    {
        $orgAdmin = User::where('username', 'admin_hcmus')->first();

        $this->actingAs($orgAdmin)->withSession(['success' => 'Đã lưu'])->get('/admin')
            ->assertInertia(fn ($p) => $p->where('flash.success', 'Đã lưu')->where('flash.error', null));
    }

    public function test_nav_counts_are_never_computed_in_the_platform_context(): void
    {
        $super = User::where('username', 'admin')->first();
        $this->actingAs($super)->get('/admin/organizations')->assertInertia(fn ($p) => $p->where('navCounts', null));
        $this->asSchoolAdmin($super)->get('/admin')->assertInertia(fn ($p) => $p->has('navCounts.pendingViolations'));
    }
}
