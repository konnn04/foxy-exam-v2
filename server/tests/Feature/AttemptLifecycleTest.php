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
}
