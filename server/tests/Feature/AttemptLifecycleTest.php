<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Models\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttemptLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function attempt(int $number, array $over = []): ExamAttempt
    {
        return ExamAttempt::create(array_merge([
            'exam_id' => Exam::where('code', 'FOXY-2026')->value('id'),
            'user_id' => User::where('username', 'student01')->value('id'),
            'attempt_number' => $number, 'status' => 'IN_PROGRESS', 'started_at' => now(),
        ], $over));
    }

    public function test_the_attempt_header_picks_the_attempt_and_foreign_ids_never_fall_back(): void
    {
        $first = $this->attempt(1);
        $second = $this->attempt(2);
        $student = User::where('username', 'student01')->first();

        $send = fn ($header) => $this->actingAs($student, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $header)
            ->postJson('/api/v1/student/violation', ['violation_type' => 'BANNED_APP', 'severity' => 'HIGH', 'details' => ['m' => 'obs']]);

        $send($first->id)->assertOk();
        $this->assertEquals(1, Violation::where('exam_attempt_id', $first->id)->count());
        $this->assertEquals(0, Violation::where('exam_attempt_id', $second->id)->count(), 'a retake must not absorb the other attempt\'s events');

        // an attempt that is not the student's (or does not exist) is a 404, not "the latest one"
        $other = User::where('username', 'teacher_hcmus')->first();
        $this->actingAs($other, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $first->id)
            ->postJson('/api/v1/student/violation', ['violation_type' => 'BANNED_APP', 'severity' => 'LOW'])->assertStatus(404);

        // without the header the latest running attempt is still used (older clients)
        $this->withoutHeader('X-Foxy-Attempt')->actingAs($student, 'sanctum')->postJson('/api/v1/student/violation', ['violation_type' => 'BANNED_APP', 'severity' => 'LOW'])->assertOk();
        $this->assertEquals(1, Violation::where('exam_attempt_id', $second->id)->count());
    }

    public function test_client_side_violation_types_are_stored_as_sent(): void
    {
        $a = $this->attempt(1);
        $student = User::where('username', 'student01')->first();
        $this->actingAs($student, 'sanctum')->withHeader('X-Foxy-Attempt', (string) $a->id)
            ->postJson('/api/v1/student/violation', ['violation_type' => 'LOOKING_AWAY', 'severity' => 'MEDIUM'])->assertOk();
        $this->assertDatabaseHas('violations', ['exam_attempt_id' => $a->id, 'violation_type' => 'LOOKING_AWAY']);
    }

    public function test_an_attempt_gone_for_more_than_five_minutes_is_closed_as_absent(): void
    {
        $gone = $this->attempt(1, ['started_at' => now()->subMinutes(30), 'last_seen_at' => now()->subMinutes(9)]);
        $gone->forceFill(['updated_at' => now()->subMinutes(9)])->saveQuietly();
        $recent = $this->attempt(2, ['started_at' => now()->subMinutes(30), 'last_seen_at' => now()->subMinutes(2)]);
        $fresh = $this->attempt(3, ['started_at' => now()->subMinute()]);

        $this->artisan('attempts:expire-offline')->assertSuccessful();

        $this->assertEquals(['SUBMITTED', 'ABSENT'], [$gone->fresh()->status, $gone->fresh()->ended_reason]);
        $this->assertEquals('IN_PROGRESS', $recent->fresh()->status, 'seen 2 minutes ago is still present');
        $this->assertEquals('IN_PROGRESS', $fresh->fresh()->status, 'a just started attempt is not absent');
    }

    public function test_a_programming_exam_stores_its_allowed_apps_and_rejects_odd_names(): void
    {
        $admin = User::where('username', 'admin_hcmus')->first();
        $set = \App\Models\QuestionSet::where('type', 'PROGRAMMING')->where('organization_id', $admin->organization_id)->first();
        $course = \App\Models\Course::where('organization_id', $admin->organization_id)->first();
        $base = ['course_id' => $course->id, 'question_set_id' => $set->id, 'title' => 'AppsOn', 'duration_minutes' => 60];

        $this->actingAs($admin)->post('/admin/exams', array_merge($base, ['allowed_apps_enabled' => true, 'allowed_apps' => ['devenv', 'Code', 'CODE']]))->assertRedirect('/admin/exams');
        $cfg = Exam::where('title', 'AppsOn')->first()->monitoring_config;
        $this->assertEquals(['devenv', 'code'], $cfg['allowed_apps']);

        $this->actingAs($admin)->post('/admin/exams', array_merge($base, ['title' => 'AppsBad', 'allowed_apps_enabled' => true, 'allowed_apps' => ['calc; rm -rf']]))->assertSessionHasErrors('allowed_apps.0');

        // switched off => empty list, so the client enforces the usual lockdown
        $this->actingAs($admin)->post('/admin/exams', array_merge($base, ['title' => 'AppsOff', 'allowed_apps_enabled' => false, 'allowed_apps' => ['devenv']]))->assertSessionHasNoErrors()->assertRedirect('/admin/exams');
        $this->assertEquals([], Exam::where('title', 'AppsOff')->first()->monitoring_config['allowed_apps']);
    }

    public function test_a_voided_attempt_keeps_its_data_but_leaves_the_violation_counts(): void
    {
        $a = $this->attempt(1);
        foreach (['BANNED_APP', 'LOOKING_AWAY'] as $t) {
            Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => $t, 'severity' => 'LOW', 'timestamp' => now()]);
        }
        $admin = User::where('username', 'admin_hcmus')->first();

        $this->actingAs($admin)->post("/admin/attempts/{$a->id}/void", ['void' => true, 'reason' => 'sự cố mạng'])->assertRedirect();
        $this->assertNotNull($a->fresh()->voided_at);
        $this->assertEquals('FORCE_ENDED', $a->fresh()->status);
        $this->assertEquals(0, Violation::where('exam_attempt_id', $a->id)->count());
        $this->assertEquals(2, Violation::withoutGlobalScopes()->where('exam_attempt_id', $a->id)->count());

        $late = Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => 'BANNED_APP', 'severity' => 'LOW', 'timestamp' => now()]);
        $this->assertTrue($late->fresh()->voided || Violation::withoutGlobalScopes()->find($late->id)->voided);

        $this->actingAs($admin)->post("/admin/attempts/{$a->id}/void", ['void' => false])->assertRedirect();
        $this->assertNull($a->fresh()->voided_at);
        $this->assertEquals(3, Violation::where('exam_attempt_id', $a->id)->count());
    }

    public function test_bulk_review_applies_one_decision_to_many_violations(): void
    {
        $a = $this->attempt(1);
        $ids = collect(range(1, 3))->map(fn () => Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => 'WINDOW_LOST_FOCUS', 'severity' => 'LOW', 'timestamp' => now()])->id)->all();
        $admin = User::where('username', 'admin_hcmus')->first();

        $this->actingAs($admin)->post('/admin/violations/bulk-review', ['ids' => $ids, 'decision' => 'confirmed'])->assertRedirect();
        $this->assertEquals(3, Violation::whereIn('id', $ids)->where('is_reviewed', true)->where('is_false_positive', false)->count());
        $this->actingAs($admin)->post('/admin/violations/bulk-review', ['ids' => $ids, 'decision' => 'false_positive'])->assertRedirect();
        $this->assertEquals(3, Violation::whereIn('id', $ids)->where('is_false_positive', true)->count());
    }
}
