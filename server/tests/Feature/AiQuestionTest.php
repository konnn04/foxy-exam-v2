<?php

namespace Tests\Feature;

use App\Models\ClassicalQuestion;
use App\Models\QuestionSet;
use App\Models\User;
use App\Services\QuestionGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiQuestionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $teacher;
    private QuestionSet $set;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->admin = User::where('username', 'admin_ou')->firstOrFail();
        $this->teacher = User::where('username', 'teacher_ou')->firstOrFail();
        $this->set = QuestionSet::create(['organization_id' => $this->admin->organization_id, 'name' => 'Bộ AI', 'code' => 'AI-01', 'type' => 'CLASSICAL', 'status' => 'DRAFT', 'max_score' => 10]);
    }

    private const MODEL_JSON = '{"questions":[
        {"kind":"single_choice","content":"Thủ đô Việt Nam?","options":[{"text":"Hà Nội","correct":true},{"text":"Huế","correct":false}],"difficulty":"easy","topic":"Địa lý"},
        {"kind":"multiple_choice","content":"Thành phố trực thuộc TW?","options":[{"text":"Hà Nội","correct":true},{"text":"Đà Nẵng","correct":true},{"text":"Nha Trang","correct":false}]},
        {"kind":"true_false","content":"Hà Nội ở miền Bắc.","is_true":true},
        {"kind":"fill_blank","content":"Thủ đô là [1].","blanks":[["Hà Nội","Ha Noi"]]},
        {"kind":"short_answer","content":"Thủ đô?","reference":"Hà Nội"},
        {"kind":"essay","content":"Trình bày lịch sử Hà Nội.","reference":"Nêu được 3 mốc"},
        {"kind":"single_choice","content":"Thiếu đáp án đúng","options":[{"text":"A"},{"text":"B"}]},
        {"kind":"matching","content":"Dạng lạ"},
        {"kind":"fill_blank","content":"Không có ô trống","blanks":[["x"]]}
    ]}';

    public function test_normalize_keeps_valid_questions_and_explains_the_rest(): void
    {
        $r = QuestionGenerator::normalize("```json\n" . self::MODEL_JSON . "\n```", 0.5);

        $this->assertSame(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_FILL_IN_BLANK', 'SHORT_ANSWER', 'ESSAY'], array_column($r['questions'], 'type'));
        $this->assertCount(3, $r['rejected']);
        $this->assertSame('EASY', $r['questions'][0]['difficulty']);
        $this->assertSame('Địa lý', $r['questions'][0]['skill']);
        $this->assertSame(0.5, $r['questions'][0]['points']);
        $this->assertSame([['answers' => ['Hà Nội', 'Ha Noi']]], $r['questions'][3]['settings']['blanks']);
    }

    public function test_settings_store_the_key_encrypted_and_never_send_it_back(): void
    {
        $this->actingAs($this->admin)->post('/admin/organization/ai', ['provider' => 'deepseek', 'model' => 'deepseek-chat', 'api_key' => 'sk-secret-1234', 'enabled' => true])->assertRedirect();

        $stored = $this->admin->organization->fresh()->settings['ai'];
        $this->assertNotSame('sk-secret-1234', $stored['api_key']);
        $this->assertSame('sk-secret-1234', QuestionGenerator::decryptKey($stored['api_key']));

        $page = $this->actingAs($this->admin)->get('/admin/settings')->getContent();
        $this->assertStringNotContainsString('sk-secret', $page);
        $this->assertStringContainsString('1234', $page); // the hint only

        // saving again without a key keeps the existing one
        $this->actingAs($this->admin)->post('/admin/organization/ai', ['provider' => 'deepseek', 'enabled' => true])->assertRedirect();
        $this->assertSame('sk-secret-1234', QuestionGenerator::decryptKey($this->admin->organization->fresh()->settings['ai']['api_key']));

        $this->actingAs($this->teacher)->post('/admin/organization/ai', ['provider' => 'gemini', 'enabled' => false])->assertForbidden();
    }

    public function test_generate_calls_the_configured_provider_and_returns_drafts_only(): void
    {
        $this->actingAs($this->admin)->post('/admin/organization/ai', ['provider' => 'deepseek', 'api_key' => 'sk-test', 'enabled' => true]);
        Http::fake(['api.deepseek.com/*' => Http::response(['choices' => [['message' => ['content' => self::MODEL_JSON]]]])]);

        $res = $this->actingAs($this->teacher)->postJson("/admin/question-sets/{$this->set->id}/ai/generate", [
            'text' => 'Hà Nội là thủ đô.', 'count' => 6, 'kinds' => ['single_choice', 'true_false'], 'difficulty' => 'mixed', 'language' => 'vi', 'points' => 1,
        ])->assertOk();

        $this->assertCount(6, $res->json('questions'));
        $this->assertSame(0, ClassicalQuestion::where('question_set_id', $this->set->id)->count()); // nothing saved yet
        Http::assertSent(fn (HttpRequest $r) => $r->hasHeader('Authorization', 'Bearer sk-test') && str_contains($r['messages'][1]['content'], 'Hà Nội là thủ đô.'));

        // DeepSeek cannot read a scanned PDF
        $pdf = \Illuminate\Http\UploadedFile::fake()->create('de.pdf', 10, 'application/pdf');
        $this->actingAs($this->teacher)->post("/admin/question-sets/{$this->set->id}/ai/generate", ['file' => $pdf, 'count' => 3, 'kinds' => ['true_false'], 'difficulty' => 'mixed', 'language' => 'vi'], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Gemini'));
    }

    public function test_generate_without_a_key_explains_what_to_do_and_the_prompt_mode_still_works(): void
    {
        $this->actingAs($this->teacher)->postJson("/admin/question-sets/{$this->set->id}/ai/generate", ['text' => 'x', 'count' => 1, 'kinds' => ['true_false'], 'difficulty' => 'mixed', 'language' => 'vi'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Cài đặt tổ chức'));

        $prompt = $this->actingAs($this->teacher)->postJson("/admin/question-sets/{$this->set->id}/ai/prompt", ['count' => 5, 'kinds' => ['essay'], 'difficulty' => 'HARD', 'language' => 'en'])->assertOk()->json('prompt');
        $this->assertStringContainsString('exactly 5 questions', $prompt);
        $this->assertStringContainsString('"questions"', $prompt);

        $parsed = $this->actingAs($this->teacher)->postJson("/admin/question-sets/{$this->set->id}/ai/parse", ['json' => self::MODEL_JSON])->assertOk();
        $this->assertCount(6, $parsed->json('questions'));
        $this->actingAs($this->teacher)->postJson("/admin/question-sets/{$this->set->id}/ai/parse", ['json' => 'không phải json'])->assertStatus(422);
    }

    public function test_save_appends_the_kept_drafts_and_rejects_invalid_ones_atomically(): void
    {
        $drafts = QuestionGenerator::normalize(self::MODEL_JSON)['questions'];

        $this->actingAs($this->teacher)->postJson("/admin/question-sets/{$this->set->id}/ai/save", ['questions' => $drafts])->assertOk()->assertJsonPath('saved', 6);
        $saved = ClassicalQuestion::where('question_set_id', $this->set->id)->orderBy('order')->get();
        $this->assertCount(6, $saved);
        $this->assertSame(range(1, 6), $saved->pluck('order')->all());
        $this->assertSame(2, $saved->first()->answers()->count());

        // one bad question: nothing from the batch is written
        $bad = [$drafts[0], ['type' => 'SINGLE_CHOICE', 'content' => 'x', 'difficulty' => 'EASY', 'answers' => [['content' => 'a', 'is_correct' => false], ['content' => 'b', 'is_correct' => false]]]];
        $this->actingAs($this->teacher)->postJson("/admin/question-sets/{$this->set->id}/ai/save", ['questions' => $bad])->assertStatus(422);
        $this->assertSame(6, ClassicalQuestion::where('question_set_id', $this->set->id)->count());

        // another school cannot write into this set
        $other = User::where('role', 'ORG_ADMIN')->where('organization_id', '!=', $this->admin->organization_id)->first();
        if ($other) {
            $this->actingAs($other)->postJson("/admin/question-sets/{$this->set->id}/ai/save", ['questions' => [$drafts[0]]])->assertForbidden();
        }
    }

    public function test_the_sample_paper_deals_like_an_exam_with_the_unsaved_rules(): void
    {
        foreach (['EASY', 'EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'HARD'] as $i => $d) {
            \App\Models\ClassicalQuestion::create(['question_set_id' => $this->set->id, 'type' => 'TRUE_FALSE', 'content' => "Q{$i}", 'difficulty' => $d, 'points' => 1, 'order' => $i + 1, 'is_true' => true]);
        }
        $url = "/admin/question-sets/{$this->set->id}/sample-paper";

        $this->actingAs($this->teacher)->getJson($url)->assertOk()->assertJsonCount(6, 'ids'); // no limit: everything

        $one = $this->actingAs($this->teacher)->getJson("$url?seed=7&limit=3&ratio[EASY]=67&ratio[HARD]=33")->assertOk()->json();
        $picked = \App\Models\ClassicalQuestion::whereIn('id', $one['ids'])->pluck('difficulty')->countBy()->all();
        $this->assertSame(['EASY' => 2, 'HARD' => 1], $picked);
        $this->assertSame($one['ids'], $this->actingAs($this->teacher)->getJson("$url?seed=7&limit=3&ratio[EASY]=67&ratio[HARD]=33")->json('ids'), 'same seed, same paper');
        $this->assertSame(0, (int) $this->set->fresh()->limit_questions, 'previewing never saves the rules');

        $other = \App\Models\User::where('role', 'ADMIN')->where('organization_id', '!=', $this->admin->organization_id)->first();
        if ($other) {
            $this->actingAs($other)->getJson($url)->assertStatus(403);
        }
    }

    public function test_the_question_editor_still_saves_through_the_shared_writer(): void
    {
        $url = "/admin/question-sets/{$this->set->id}/classical-questions";
        $this->actingAs($this->teacher)->post($url, ['type' => 'SINGLE_CHOICE', 'content' => 'Q', 'difficulty' => 'EASY', 'answers' => [['content' => 'a', 'is_correct' => true], ['content' => 'b', 'is_correct' => true]]])->assertRedirect();
        $q = ClassicalQuestion::where('question_set_id', $this->set->id)->firstOrFail();
        $this->assertSame('MULTIPLE_CHOICE', $q->type); // two correct answers become checkboxes

        $this->actingAs($this->teacher)->post($url, ['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => 'Không ô', 'difficulty' => 'EASY'])->assertSessionHasErrors('content');
    }
}
