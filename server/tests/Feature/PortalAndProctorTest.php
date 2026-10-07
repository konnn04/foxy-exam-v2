<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Exam;
use App\Models\Organization;
use App\Models\QuestionSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PortalAndProctorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_lecturers_live_on_lecturer_and_admins_on_admin_with_the_same_pages(): void
    {
        $teacher = User::where('username', 'teacher_hcmus')->first();
        $orgAdmin = User::where('username', 'admin_hcmus')->first();

        // same page, the address bar of the response keeps the role's portal
        $this->actingAs($teacher)->get('/lecturer/exams')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Admin/Dashboard')->where('portal', '/lecturer'));
        $this->actingAs($orgAdmin)->get('/admin/exams')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Admin/Dashboard')->where('portal', '/admin'));

        // the wrong door sends everybody home — teacher: /admin → /lecturer, admin: /lecturer → /admin
        $this->actingAs($teacher)->get('/admin/exams?x=1')->assertRedirect('/lecturer/exams?x=1');
        $this->actingAs($orgAdmin)->get('/lecturer/exams')->assertRedirect('/admin/exams');
        $this->actingAs($teacher)->get('/admin')->assertRedirect('/lecturer');
    }

    public function test_inertia_url_and_redirects_stay_on_the_lecturer_portal(): void
    {
        $teacher = User::where('username', 'teacher_hcmus')->first();

        $this->actingAs($teacher)->get('/lecturer/courses', ['X-Inertia' => 'true', 'X-Requested-With' => 'XMLHttpRequest', 'X-Inertia-Version' => (string) app(\App\Http\Middleware\HandleInertiaRequests::class)->version(request())])
            ->assertOk()->assertJsonPath('url', '/lecturer/courses');

        // a lecturer is not an admin: administration stays closed, and the bounce stays on /lecturer
        $this->actingAs($teacher)->get('/lecturer/users')->assertRedirect('/lecturer');
        $this->actingAs($teacher)->post('/lecturer/organizations', ['name' => 'x', 'code' => 'ZZ', 'type' => 'CENTER'])->assertForbidden();
    }

    public function test_login_lands_on_the_portal_of_the_role(): void
    {
        $this->post('/login', ['username' => 'teacher_hcmus', 'password' => 'teacher123'])->assertRedirect('/lecturer');
        auth()->logout();
        $this->post('/login', ['username' => 'admin_hcmus', 'password' => 'admin123'])->assertRedirect('/admin');
    }

    public function test_monitoring_index_lists_every_exam_of_the_school_and_reports_index_redirects(): void
    {
        $admin = User::where('username', 'admin_hcmus')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();

        $this->actingAs($admin)->get('/admin/reports')->assertRedirect('/admin/live');
        $this->actingAs($admin)->get('/admin/live')->assertOk()->assertInertia(fn ($p) => $p
            ->component('Admin/Live/Index')
            ->has('exams', Exam::where('organization_id', $hcmus->id)->count()));

        // dashboard + candidate sessions of a finished exam
        $ended = Exam::where('organization_id', $hcmus->id)->where('status', 'ENDED')->first();
        $this->actingAs($admin)->get("/admin/reports/{$ended->id}")->assertOk();
    }

    public function test_exam_form_offers_only_staff_of_the_same_organization_as_proctors(): void
    {
        $super = User::where('username', 'admin')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();

        $this->asSchoolAdmin($super)->get('/admin/exams/new/general')->assertInertia(function ($p) use ($hcmus) {
            $p->has('proctorOptions');
            $ids = collect($p->toArray()['props']['proctorOptions'])->pluck('id');
            $this->assertNotEmpty($ids);
            $this->assertEmpty(User::withoutGlobalScopes()->whereIn('id', $ids)->where('organization_id', '!=', $hcmus->id)->pluck('id')->all());
            $this->assertEmpty(User::withoutGlobalScopes()->whereIn('id', $ids)->where('role', 'STUDENT')->pluck('id')->all());
        });
    }

    public function test_exam_proctors_are_saved_and_foreign_or_student_ids_are_ignored(): void
    {
        $admin = User::where('username', 'admin_hcmus')->first();
        $hcmus = Organization::where('code', 'HCMUS')->first();
        $hcmut = Organization::where('code', 'HCMUT')->first();
        $course = Course::where('organization_id', $hcmus->id)->first();
        $set = QuestionSet::where('organization_id', $hcmus->id)->where('type', 'CLASSICAL')->first();

        $colleague = User::where('organization_id', $hcmus->id)->where('role', 'TEACHER')->where('username', '!=', 'teacher_hcmus')->first();
        $outsider = User::withoutGlobalScopes()->where('organization_id', $hcmut->id)->where('role', 'TEACHER')->first();
        $student = User::where('username', 'student01')->first();

        $this->actingAs($admin)->post('/admin/exams', [
            'course_id' => $course->id, 'question_set_id' => $set->id, 'title' => 'Có giám thị', 'duration_minutes' => 60,
            'proctor_ids' => [$colleague->id, $outsider->id, $student->id],
        ])->assertRedirect('/admin/exams');

        $exam = Exam::where('title', 'Có giám thị')->firstOrFail();
        $ids = $exam->proctors()->pluck('users.id')->all();
        $this->assertEqualsCanonicalizing([$colleague->id, $admin->id], $ids); // creator always kept; outsider + student dropped

        // editing replaces the list but keeps the editor
        $this->actingAs($admin)->post("/admin/exams/{$exam->id}/update", [
            'course_id' => $course->id, 'question_set_id' => $set->id, 'title' => 'Có giám thị', 'duration_minutes' => 60,
            'status' => 'DRAFT', 'proctor_ids' => [],
        ])->assertRedirect('/admin/exams');
        $this->assertEquals([$admin->id], $exam->proctors()->pluck('users.id')->all());

        // the edit page pre-selects them
        $this->actingAs($admin)->get("/admin/exams/{$exam->id}/edit")->assertInertia(fn ($p) => $p->where('exam.proctor_ids', [$admin->id]));
    }

    public function test_seed_builds_three_schools_with_four_banks_each(): void
    {
        $this->assertEquals(1, Organization::where('code', 'ROOT')->count());
        $schools = Organization::where('code', '!=', 'ROOT')->get();
        $this->assertCount(3, $schools);

        foreach ($schools as $org) {
            $sets = QuestionSet::where('organization_id', $org->id)->get();
            $this->assertCount(4, $sets, $org->code);
            $this->assertEquals(2, $sets->where('type', 'CLASSICAL')->count(), $org->code);
            $this->assertEquals(2, $sets->where('type', 'PROGRAMMING')->count(), $org->code);
            $this->assertGreaterThanOrEqual(4, User::where('organization_id', $org->id)->where('role', 'TEACHER')->count(), $org->code);
            $this->assertGreaterThanOrEqual(30, User::where('organization_id', $org->id)->where('role', 'STUDENT')->count(), $org->code);
        }
    }
}
