<?php

namespace Tests\Feature;

use App\Models\AttemptMessage;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\User;
use App\Models\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AttemptChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        config([
            'services.realtime.jwt_secret' => 'jwt',
            'services.realtime.internal_secret' => 'internal',
            'services.realtime.ingest_internal_url' => 'http://ingest:8081',
        ]);
    }

    private function attempt(array $over = []): ExamAttempt
    {
        return ExamAttempt::create(array_merge([
            'exam_id' => Exam::where('code', 'FOXY-2026')->value('id'),
            'user_id' => User::where('username', 'student01')->value('id'),
            'attempt_number' => 1, 'status' => 'IN_PROGRESS', 'started_at' => now(),
        ], $over));
    }

    public function test_a_proctor_message_is_stored_and_sent_to_the_candidate_and_the_hub(): void
    {
        Http::fake(['http://ingest:8081/*' => Http::response(['ok' => true])]);
        $a = $this->attempt();
        $admin = User::where('username', 'admin_hcmus')->first();

        $this->actingAs($admin)->postJson("/admin/attempts/{$a->id}/chat", ['body' => '  Quay lại bài thi  '])
            ->assertCreated()->assertJsonPath('data.role', 'PROCTOR')->assertJsonPath('data.body', 'Quay lại bài thi');
        $this->assertDatabaseHas('attempt_messages', ['exam_attempt_id' => $a->id, 'sender_role' => 'PROCTOR']);

        $bodies = Http::recorded()->map(fn ($p) => json_decode($p[0]->body(), true))->all();
        $this->assertTrue(collect($bodies)->contains(fn ($b) => ($b['command']['type'] ?? null) === 'CHAT' && $b['command']['message'] === 'Quay lại bài thi'));
        $this->assertTrue(collect($bodies)->contains(fn ($b) => ($b['field'] ?? null) === 'cs' && $b['value'] > 0));
        $this->assertTrue(Http::recorded()->every(fn ($p) => $p[0]->hasHeader('X-Foxy-Signature')));
    }

    public function test_the_candidate_writes_back_reads_history_and_cannot_touch_another_attempt(): void
    {
        Http::fake(['http://ingest:8081/*' => Http::response(['ok' => true])]);
        $a = $this->attempt();
        $student = User::where('username', 'student01')->first();
        $admin = User::where('username', 'admin_hcmus')->first();
        $this->actingAs($admin)->postJson("/admin/attempts/{$a->id}/chat", ['body' => 'Hello'])->assertCreated();

        $this->actingAs($student, 'sanctum')->postJson("/api/v1/student/attempts/{$a->id}/chat", ['body' => 'Em cần giấy nháp'])->assertCreated()->assertJsonPath('data.role', 'STUDENT');
        $this->actingAs($student, 'sanctum')->getJson("/api/v1/student/attempts/{$a->id}/chat")->assertOk()->assertJsonCount(2, 'data');
        $first = AttemptMessage::orderBy('id')->first()->id;
        $this->actingAs($student, 'sanctum')->getJson("/api/v1/student/attempts/{$a->id}/chat?after={$first}")->assertJsonCount(1, 'data');

        $other = User::where('username', 'teacher_hcmus')->first();
        $this->actingAs($other, 'sanctum')->getJson("/api/v1/student/attempts/{$a->id}/chat")->assertNotFound();
        $this->actingAs($other, 'sanctum')->postJson("/api/v1/student/attempts/{$a->id}/chat", ['body' => 'x'])->assertNotFound();

        $this->actingAs($admin)->getJson("/admin/attempts/{$a->id}/chat")->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_nobody_can_chat_in_a_finished_attempt_and_students_cannot_use_the_proctor_side(): void
    {
        Http::fake(['http://ingest:8081/*' => Http::response(['ok' => true])]);
        $a = $this->attempt(['status' => 'SUBMITTED', 'submitted_at' => now()]);
        $admin = User::where('username', 'admin_hcmus')->first();
        $student = User::where('username', 'student01')->first();

        $this->actingAs($admin)->postJson("/admin/attempts/{$a->id}/chat", ['body' => 'x'])->assertStatus(409);
        $this->actingAs($student, 'sanctum')->postJson("/api/v1/student/attempts/{$a->id}/chat", ['body' => 'x'])->assertStatus(409);
        $this->actingAs($student)->getJson("/admin/attempts/{$a->id}/chat")->assertForbidden();
        $this->assertDatabaseCount('attempt_messages', 0);
    }

    public function test_a_manual_violation_counts_as_confirmed_and_raises_the_risk(): void
    {
        $a = $this->attempt();
        $admin = User::where('username', 'admin_hcmus')->first();

        $this->actingAs($admin)->post("/admin/attempts/{$a->id}/violations", ['severity' => 'HIGH', 'message' => 'Nhìn sang bài bạn bên cạnh'])->assertRedirect();
        $v = Violation::where('exam_attempt_id', $a->id)->first();
        $this->assertEquals(['MANUAL', true, 'proctor'], [$v->violation_type, $v->is_reviewed, $v->details['source']]);
        $this->assertEquals(30, $a->fresh()->risk_score);

        $this->actingAs($admin)->post("/admin/attempts/{$a->id}/violations", ['severity' => 'NOPE', 'message' => 'x'])->assertSessionHasErrors('severity');
    }

    public function test_csv_exports_carry_the_chat_log_and_defuse_formulas(): void
    {
        Http::fake(['http://ingest:8081/*' => Http::response(['ok' => true])]);
        $a = $this->attempt();
        $admin = User::where('username', 'admin_hcmus')->first();
        $this->actingAs($admin)->postJson("/admin/attempts/{$a->id}/chat", ['body' => '=HYPERLINK("x")'])->assertCreated();
        Violation::create(['exam_attempt_id' => $a->id, 'violation_type' => 'TAB_SWITCH', 'severity' => 'MEDIUM', 'details' => ['message' => 'Rời cửa sổ'], 'timestamp' => now()]);

        $chat = $this->actingAs($admin)->get("/admin/attempts/{$a->id}/export/chat.csv");
        $chat->assertOk();
        $csv = $chat->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv);

        $this->assertStringContainsString('TAB_SWITCH', $this->actingAs($admin)->get("/admin/attempts/{$a->id}/export/violations.csv")->streamedContent());
        $examId = $a->exam_id;
        $this->assertStringContainsString('student01', $this->actingAs($admin)->get("/admin/reports/{$examId}/export/attempts.csv")->streamedContent());
        $this->assertStringContainsString('TAB_SWITCH', $this->actingAs($admin)->get("/admin/reports/{$examId}/export/violations.csv")->streamedContent());

        $this->actingAs(User::where('username', 'student01')->first())->get("/admin/attempts/{$a->id}/export/chat.csv")->assertForbidden();
    }
}
