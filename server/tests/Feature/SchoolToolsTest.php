<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Models\Violation;
use App\Support\Semester;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SchoolToolsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function root(): User
    {
        return User::where('role', 'SUPER_ADMIN')->firstOrFail();
    }

    private function schoolAdmin(): User
    {
        return User::where('username', 'admin_ou')->firstOrFail();
    }

    // ---------- Excel import ----------

    public function test_import_previews_without_saving_then_commits_with_generated_passwords_and_enrolment(): void
    {
        $admin = $this->schoolAdmin();
        $course = Course::create(['organization_id' => $admin->organization_id, 'code' => 'IMP101', 'name' => 'Nhập môn']);
        $rows = [
            ['username' => 'sv001', 'name' => 'Nguyễn A', 'email' => 'a@x.vn', 'password' => 'secret12', 'course' => 'imp101'],
            ['username' => 'sv002', 'name' => 'Trần B'],
            ['username' => 'sv001', 'name' => 'Trùng'],
            ['username' => '', 'name' => 'Thiếu mã'],
            ['username' => 'sv004', 'course' => 'NOPE'],
            ['username' => 'sv005', 'email' => 'not-an-email'],
            ['username' => 'sv006', 'password' => '123'],
        ];

        $preview = $this->actingAs($admin)->postJson('/admin/import/students/preview', ['rows' => $rows, 'default_course' => 'IMP101'])->assertOk();
        $preview->assertJsonPath('summary.new', 2)->assertJsonPath('summary.error', 5);
        $this->assertSame(0, User::where('username', 'sv001')->count()); // a preview never saves
        $this->assertStringNotContainsString('secret12', $preview->getContent()); // nor echoes passwords

        $done = $this->actingAs($admin)->postJson('/admin/import/students/commit', ['rows' => $rows, 'default_course' => 'IMP101'])->assertOk();
        $done->assertJsonPath('created', 2)->assertJsonPath('enrolled', 2)->assertJsonPath('errors', 5);

        $created = User::where('organization_id', $admin->organization_id)->where('username', 'sv002')->firstOrFail();
        $this->assertSame('STUDENT', $created->role);
        $this->assertStringEndsWith('.students.local', $created->email);
        $this->assertCount(2, $course->students()->get());

        // only the account whose password the system chose is handed back, and it really logs in
        $credentials = $done->json('credentials');
        $this->assertCount(1, $credentials);
        $this->assertSame('sv002', $credentials[0]['username']);
        $this->assertTrue(Hash::check($credentials[0]['password'], $created->password));

        // running it again changes nothing: existing students are only (re-)enrolled
        $again = $this->actingAs($admin)->postJson('/admin/import/students/commit', ['rows' => array_slice($rows, 0, 2), 'default_course' => 'IMP101'])->assertOk();
        $again->assertJsonPath('created', 0)->assertJsonPath('enrolled', 0);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.import']);
    }

    public function test_import_cannot_touch_teachers_and_is_closed_to_everyone_else(): void
    {
        $admin = $this->schoolAdmin();
        $teacher = User::where('username', 'teacher_ou')->firstOrFail();

        $res = $this->actingAs($admin)->postJson('/admin/import/students/preview', ['rows' => [['username' => 'teacher_ou']]])->assertOk();
        $res->assertJsonPath('rows.0.status', 'error');

        $this->actingAs($teacher)->postJson('/admin/import/students/commit', ['rows' => [['username' => 'x1']]])->assertForbidden();
        $this->actingAs($this->root())->postJson('/admin/import/students/commit', ['rows' => [['username' => 'x1']]])->assertForbidden(); // platform has no students
        $this->assertSame(0, User::where('username', 'x1')->count());
    }

    // ---------- reports ----------

    public function test_semesters_follow_the_vietnamese_calendar(): void
    {
        $this->assertSame('2026-2027 · HK1', Semester::of(Carbon::parse('2026-10-05')));
        $this->assertSame('2025-2026 · HK1', Semester::of(Carbon::parse('2026-01-12')));
        $this->assertSame('2025-2026 · HK2', Semester::of(Carbon::parse('2026-05-20')));
        $this->assertSame('2025-2026 · HK hè', Semester::of(Carbon::parse('2026-07-10')));
        $this->assertSame('Chưa xếp lịch', Semester::of(null));
    }

    public function test_reports_group_by_department_and_semester_and_the_csv_is_safe_for_excel(): void
    {
        $admin = $this->schoolAdmin();
        $org = $admin->organization_id;
        $student = User::where('username', 'student01')->firstOrFail();
        $cs = Course::create(['organization_id' => $org, 'code' => 'CS1', 'name' => 'CS', 'department' => '=Khoa CNTT']);
        $ec = Course::create(['organization_id' => $org, 'code' => 'EC1', 'name' => 'EC', 'department' => 'Khoa Kinh tế']);
        $examA = Exam::create(['organization_id' => $org, 'course_id' => $cs->id, 'title' => 'Giữa kỳ', 'code' => 'AAA-1', 'type' => 'QUIZ', 'status' => 'ENDED', 'start_time' => '2026-10-10 08:00:00']);
        $examB = Exam::create(['organization_id' => $org, 'course_id' => $ec->id, 'title' => 'Cuối kỳ', 'code' => 'BBB-1', 'type' => 'QUIZ', 'status' => 'ENDED', 'start_time' => '2026-05-10 08:00:00']);

        $a = ExamAttempt::create(['exam_id' => $examA->id, 'user_id' => $student->id, 'attempt_number' => 1, 'status' => 'SUBMITTED', 'score' => 8]);
        ExamAttempt::create(['exam_id' => $examB->id, 'user_id' => $student->id, 'attempt_number' => 1, 'status' => 'FORCE_ENDED', 'score' => 0]);
        Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => 'TAB_SWITCH', 'severity' => 'LOW']);
        Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => 'FACE_MISMATCH', 'severity' => 'HIGH', 'is_false_positive' => true]);

        $page = $this->actingAs($admin)->get('/admin/analytics')->assertOk()->viewData('page')['props'];
        $this->assertContains('2026-2027 · HK1', array_column($page['bySemester'], 'name'));
        $this->assertContains('2025-2026 · HK2', array_column($page['bySemester'], 'name'));
        $this->assertContains('Khoa Kinh tế', $page['options']['departments']);

        $cntt = $this->actingAs($admin)->get('/admin/analytics?department=' . urlencode('=Khoa CNTT'))->viewData('page')['props'];
        $this->assertSame(1, $cntt['totals']['exams']);
        $this->assertSame(1, $cntt['totals']['attempts']);
        $this->assertSame(1, $cntt['totals']['violations']); // the false positive is not counted
        $this->assertSame(0, $cntt['totals']['force_ended']);
        $this->assertSame(['2026-2027 · HK1'], array_column($cntt['bySemester'], 'name'));

        $eco = $this->actingAs($admin)->get('/admin/analytics?department=' . urlencode('Khoa Kinh tế'))->viewData('page')['props'];
        $this->assertSame(1, $eco['totals']['exams']);
        $this->assertSame(1, $eco['totals']['force_ended']);
        $this->assertSame(0, $eco['totals']['violations']);

        $csv = $this->actingAs($admin)->get('/admin/analytics/export')->assertOk()->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString("'=Khoa CNTT", $csv); // never a live formula

        $teacher = User::where('username', 'teacher_ou')->firstOrFail();
        $this->actingAs($teacher)->get('/admin/analytics/export')->assertRedirect();
        $this->actingAs($this->root())->get('/admin/analytics')->assertRedirect();
    }

    // ---------- default monitoring policy ----------

    public function test_a_school_policy_is_saved_normalised_shared_and_resettable(): void
    {
        $admin = $this->schoolAdmin();

        // sub-options never stay on when their main option is off
        $this->actingAs($admin)->post('/admin/organization/policy', ['ai_face_check' => false, 'ai_identity' => true, 'ai_objects' => true, 'extra_camera' => 'off', 'extra_camera_spot_check' => true, 'lock_device' => true, 'prevent_paste' => true, 'max_paste_chars' => 50])->assertRedirect();
        $saved = $admin->organization->fresh()->settings['monitoring_defaults'];
        $this->assertFalse($saved['ai_identity']);
        $this->assertFalse($saved['ai_objects']);
        $this->assertFalse($saved['extra_camera_spot_check']);
        $this->assertTrue($saved['lock_device']);
        $this->assertSame(50, $saved['max_paste_chars']);

        $props = $this->actingAs($admin)->get('/admin/exams')->viewData('page')['props'];
        $this->assertFalse($props['orgPolicy']['ai_face_check']);

        $this->actingAs($admin)->post('/admin/organization/policy', ['reset' => true, 'extra_camera' => 'off'])->assertRedirect();
        $this->assertArrayNotHasKey('monitoring_defaults', $admin->organization->fresh()->settings ?? []);

        $teacher = User::where('username', 'teacher_ou')->firstOrFail();
        $this->actingAs($teacher)->post('/admin/organization/policy', ['extra_camera' => 'off'])->assertForbidden();
    }

    // ---------- broadcast ----------

    public function test_a_broadcast_reaches_only_the_chosen_staff_and_never_links_off_site(): void
    {
        $root = $this->root();
        $admin = $this->schoolAdmin();
        $teacher = User::where('username', 'teacher_ou')->firstOrFail();
        $student = User::where('username', 'student01')->firstOrFail();

        $aud = ['scope' => 'orgs', 'org_ids' => [$admin->organization_id], 'roles' => ['ORG_ADMIN', 'TEACHER']];
        $expected = User::where('organization_id', $admin->organization_id)->whereIn('role', ['ORG_ADMIN', 'TEACHER'])->where('status', 'ACTIVE')->count();
        $this->actingAs($root)->postJson('/admin/announcements/preview', $aud)->assertOk()->assertJsonPath('count', $expected);

        $this->actingAs($root)->post('/admin/announcements', array_merge($aud, ['title' => 'Bảo trì', 'body' => 'Tối nay', 'url' => 'https://evil.example']))->assertSessionHasErrors('url');
        $this->actingAs($root)->post('/admin/announcements', array_merge($aud, ['title' => 'Bảo trì', 'body' => 'Tối nay', 'url' => '/admin/exams']))->assertRedirect();

        $this->assertDatabaseHas('user_notifications', ['user_id' => $admin->id, 'type' => 'announcement', 'title' => 'Bảo trì']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $teacher->id, 'type' => 'announcement']);
        $this->assertDatabaseMissing('user_notifications', ['user_id' => $student->id, 'type' => 'announcement']); // students are not staff
        $this->assertDatabaseHas('announcements', ['title' => 'Bảo trì']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'announce.send']);

        $this->actingAs($admin)->post('/admin/announcements', array_merge($aud, ['title' => 'Giả mạo']))->assertForbidden();
    }

    // ---------- audit coverage ----------

    public function test_plan_and_course_changes_are_audited_but_rejected_requests_are_not(): void
    {
        $this->actingAs($this->root())->post('/admin/plans', ['name' => 'GOLD', 'display_name' => 'Gold', 'price' => 100, 'max_exams_per_month' => 10, 'max_students_per_exam' => 50, 'storage_limit_gb' => 5])->assertRedirect();
        $this->assertDatabaseHas('audit_logs', ['action' => 'plan.create']);

        $before = AuditLog::count();
        $this->actingAs($this->root())->post('/admin/plans', ['name' => 'BAD'])->assertSessionHasErrors();
        $this->assertSame($before, AuditLog::count());

        $admin = $this->schoolAdmin();
        $this->actingAs($admin)->post('/admin/courses', ['name' => 'Mới', 'code' => 'NEW1', 'department' => 'Khoa A'])->assertRedirect();
        $this->assertDatabaseHas('courses', ['code' => 'NEW1', 'department' => 'Khoa A']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'course.create', 'organization_id' => $admin->organization_id]);
    }
}
