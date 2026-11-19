<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Support\MonitoringConfig;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SweepAttemptsTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->student = User::where('username', 'student01')->firstOrFail();
    }

    private function exam(array $config = [], int $minutes = 60): Exam
    {
        static $n = 0;
        $n++;
        $org = $this->student->organization_id;
        $course = Course::create(['organization_id' => $org, 'code' => "SWP{$n}", 'name' => 'Sweep']);

        return Exam::create([
            'organization_id' => $org, 'course_id' => $course->id, 'title' => "Sweep {$n}", 'code' => "SWP-{$n}",
            'type' => 'QUIZ', 'status' => 'PUBLISHED', 'duration_minutes' => $minutes, 'monitoring_config' => $config,
        ]);
    }

    /** $seen = minutes since the last sign of life (presence and row update) */
    private function attempt(Exam $exam, int $startedAgo, ?int $seen = null): ExamAttempt
    {
        $a = ExamAttempt::create([
            'exam_id' => $exam->id, 'user_id' => $this->student->id, 'attempt_number' => 1, 'status' => 'IN_PROGRESS',
            'started_at' => now()->subMinutes($startedAgo), 'last_seen_at' => $seen === null ? now() : now()->subMinutes($seen),
        ]);
        $a->forceFill(['updated_at' => $seen === null ? now() : now()->subMinutes($seen)])->saveQuietly();

        return $a;
    }

    public function test_the_sweep_closes_time_up_and_absent_attempts_and_leaves_the_rest(): void
    {
        $overdue = $this->attempt($this->exam(minutes: 30), startedAgo: 32);          // 30 min + 1 min grace passed
        $lastMinute = $this->attempt($this->exam(minutes: 30), startedAgo: 30);       // inside the grace
        $gone = $this->attempt($this->exam(), startedAgo: 20, seen: 6);               // default limit 5 minutes
        $back = $this->attempt($this->exam(), startedAgo: 20, seen: 2);
        $patient = $this->attempt($this->exam(['offline_minutes' => 15]), startedAgo: 20, seen: 10);
        $never = $this->attempt($this->exam(['offline_minutes' => 0]), startedAgo: 50, seen: 45);

        $this->artisan('attempts:sweep')->assertSuccessful();

        $this->assertSame(['SUBMITTED', 'TIME_UP'], [$overdue->fresh()->status, $overdue->fresh()->ended_reason]);
        $this->assertSame(['SUBMITTED', 'ABSENT'], [$gone->fresh()->status, $gone->fresh()->ended_reason]);
        $this->assertNotNull($overdue->fresh()->submitted_at);
        foreach ([$lastMinute, $back, $patient, $never] as $a) {
            $this->assertSame('IN_PROGRESS', $a->fresh()->status, "attempt {$a->id} must stay open");
        }

        // the old name still works (cron lines written for it keep running)
        $this->artisan('attempts:expire-offline')->assertSuccessful();
    }

    public function test_a_dry_run_changes_nothing_and_a_closed_attempt_is_never_closed_twice(): void
    {
        $a = $this->attempt($this->exam(minutes: 30), startedAgo: 40);
        $this->artisan('attempts:sweep', ['--dry-run' => true])->assertSuccessful();
        $this->assertSame('IN_PROGRESS', $a->fresh()->status);

        $this->artisan('attempts:sweep')->assertSuccessful();
        $first = $a->fresh()->submitted_at;
        $this->travel(2)->minutes();
        $this->artisan('attempts:sweep')->assertSuccessful();
        $this->assertEquals($first, $a->fresh()->submitted_at);

        // a voided (force ended) attempt is not reopened by a late submit
        $voided = $this->attempt($this->exam(), startedAgo: 5);
        $voided->update(['status' => 'FORCE_ENDED']);
        $this->actingAs($this->student, 'sanctum')->postJson("/api/v1/student/exams/{$voided->exam_id}/submit/{$voided->id}")->assertStatus(400);
        $this->assertSame('FORCE_ENDED', $voided->fresh()->status);
    }

    public function test_the_server_clock_decides_answers_after_the_deadline_close_the_attempt(): void
    {
        $exam = $this->exam(minutes: 30);
        $a = $this->attempt($exam, startedAgo: 35);

        $this->actingAs($this->student, 'sanctum')
            ->postJson("/api/v1/student/exams/{$exam->id}/take/{$a->id}/save-answer", ['question_id' => 1, 'answer_content' => 'trễ'])
            ->assertStatus(409)->assertJsonPath('error_code', 'TIME_UP');
        $this->assertSame(['SUBMITTED', 'TIME_UP'], [$a->fresh()->status, $a->fresh()->ended_reason]);
    }

    public function test_remaining_time_counts_down_and_never_grows_on_resume(): void
    {
        $a = $this->attempt($this->exam(minutes: 60), startedAgo: 20);
        $left = $a->fresh()->secondsLeft();
        $this->assertGreaterThan(39 * 60, $left);
        $this->assertLessThanOrEqual(40 * 60, $left);
    }

    public function test_the_offline_limit_is_part_of_the_policy_and_the_exam(): void
    {
        $this->assertSame(5, MonitoringConfig::offlineMinutes([]));
        $this->assertSame(60, MonitoringConfig::normalize(['offline_minutes' => 999])['offline_minutes']);

        $admin = User::where('username', 'admin_ou')->firstOrFail();
        $this->actingAs($admin)->post('/admin/organization/policy', ['extra_camera' => 'off', 'offline_minutes' => 10])->assertRedirect();
        $this->assertSame(10, $admin->organization->fresh()->settings['monitoring_defaults']['offline_minutes']);
        $this->actingAs($admin)->post('/admin/organization/policy', ['extra_camera' => 'off', 'offline_minutes' => 61])->assertSessionHasErrors('offline_minutes');
    }
}
