<?php

namespace Tests\Feature;

use App\Models\ClassicalQuestion;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptAnswer;
use App\Models\Organization;
use App\Models\QuestionSet;
use App\Models\User;
use App\Support\QuestionSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** All six exam-sys question types: authoring, validation, grading, what a candidate may see, and the draw. */
class QuestionTypesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Organization $school;
    private QuestionSet $set;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->admin = User::where('username', 'admin')->first();
        $this->school = Organization::where('code', 'HCMUS')->first();
        $this->set = QuestionSet::create([
            'organization_id' => $this->school->id, 'name' => 'Types', 'code' => 'QT-1', 'type' => 'CLASSICAL',
            'status' => 'DRAFT', 'max_score' => 10, 'created_by' => $this->admin->id,
        ]);
    }

    private function author(array $data)
    {
        return $this->asSchoolAdmin($this->admin)->post("/admin/question-sets/{$this->set->id}/classical-questions", $data);
    }

    private function make(array $data): ClassicalQuestion
    {
        $this->author($data)->assertRedirect()->assertSessionHasNoErrors();

        return ClassicalQuestion::where('question_set_id', $this->set->id)->whereNull('parent_id')->latest('id')->first();
    }

    // ---------------------------------------------------------------- authoring

    public function test_every_type_can_be_authored_and_round_trips(): void
    {
        $single = $this->make(['type' => 'SINGLE_CHOICE', 'content' => 'Q1', 'points' => 1, 'difficulty' => 'EASY', 'skill' => 'Đọc',
            'answers' => [['content' => 'a', 'is_correct' => true], ['content' => 'b']]]);
        $this->assertSame('SINGLE_CHOICE', $single->type);
        $this->assertSame('Đọc', $single->skill);
        $this->assertCount(2, $single->answers);

        // two correct answers => stored as MULTIPLE_CHOICE (checkboxes)
        $multi = $this->make(['type' => 'SINGLE_CHOICE', 'content' => 'Q2', 'points' => 2, 'difficulty' => 'MEDIUM',
            'answers' => [['content' => 'a', 'is_correct' => true], ['content' => 'b', 'is_correct' => true], ['content' => 'c']]]);
        $this->assertSame('MULTIPLE_CHOICE', $multi->type);

        $tf = $this->make(['type' => 'TRUE_FALSE', 'content' => 'Q3', 'points' => 1, 'difficulty' => 'HARD', 'is_true' => false]);
        $this->assertFalse($tf->is_true);
        $this->assertCount(0, $tf->answers);

        $fill = $this->make(['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => 'Opened in [1], [2] members.', 'points' => 2, 'difficulty' => 'MEDIUM',
            'settings' => ['blanks' => [['answers' => ['2015', ' two thousand fifteen ']], ['answers' => ['300']]]]]);
        $this->assertSame([['answers' => ['2015', 'two thousand fifteen']], ['answers' => ['300']]], $fill->settings['blanks']);

        $short = $this->make(['type' => 'SHORT_ANSWER', 'content' => 'Q5', 'points' => 1, 'difficulty' => 'EXPERT', 'settings' => ['reference' => 'foo|bar']]);
        $this->assertSame('foo|bar', $short->settings['reference']);

        $essay = $this->make(['type' => 'ESSAY', 'content' => 'Speak', 'points' => 2, 'difficulty' => 'HARD',
            'settings' => ['mode' => 'audio', 'prep_seconds' => 30, 'max_seconds' => 90]]);
        $this->assertSame(['mode' => 'audio', 'prep_seconds' => 30, 'max_seconds' => 90], $essay->settings);

        // an essay without settings gets the "write" defaults instead of failing
        $plain = $this->make(['type' => 'ESSAY', 'content' => 'Write', 'points' => 1, 'difficulty' => 'EASY']);
        $this->assertSame('write', $plain->settings['mode']);

        $group = $this->make(['type' => 'GROUP_QUESTION', 'content' => 'Listen', 'difficulty' => 'MEDIUM',
            'settings' => ['media' => 'audio', 'audio_url' => '/storage/a.mp3', 'listen_limit' => 2, 'allow_seek' => false, 'image_url' => 'ignored'],
            'children' => [
                ['type' => 'TRUE_FALSE', 'content' => 'c1', 'points' => 1, 'is_true' => true],
                ['type' => 'SHORT_ANSWER', 'content' => 'c2', 'points' => 1],
            ]]);
        $this->assertSame(0.0, $group->points);
        $this->assertSame('audio', $group->settings['media']);
        $this->assertNull($group->settings['image_url']); // media-specific fields are cleaned
        $this->assertCount(2, $group->children);
        $this->assertSame(['TRUE_FALSE', 'SHORT_ANSWER'], $group->children->pluck('type')->all());

        // editing keeps order and replaces the answers
        $this->author(['id' => $single->id, 'type' => 'SINGLE_CHOICE', 'content' => 'Q1 edited', 'points' => 3, 'difficulty' => 'HARD',
            'answers' => [['content' => 'x', 'is_correct' => true], ['content' => 'y'], ['content' => 'z']]])->assertSessionHasNoErrors();
        $single->refresh();
        $this->assertSame('Q1 edited', $single->content);
        $this->assertCount(3, $single->answers);
    }

    public function test_invalid_questions_are_rejected_by_the_server(): void
    {
        $base = ['difficulty' => 'EASY', 'content' => 'x'];
        $cases = [
            'one answer' => [['type' => 'SINGLE_CHOICE', 'answers' => [['content' => 'a', 'is_correct' => true]]], 'answers'],
            'no correct answer' => [['type' => 'SINGLE_CHOICE', 'answers' => [['content' => 'a'], ['content' => 'b']]], 'answers'],
            'true/false without a value' => [['type' => 'TRUE_FALSE'], 'is_true'],
            'blank without markers' => [['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => 'no blanks', 'settings' => ['blanks' => []]], 'content'],
            'blank without answers' => [['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => '[1] [2]', 'settings' => ['blanks' => [['answers' => ['a']]]]], 'settings'],
            'unknown type' => [['type' => 'NOPE'], 'type'],
            'unknown difficulty' => [['type' => 'ESSAY', 'difficulty' => 'IMPOSSIBLE'], 'difficulty'],
        ];
        foreach ($cases as $name => [$data, $errorKey]) {
            $this->author([...$base, ...$data])->assertSessionHasErrors($errorKey);
        }
        $this->assertSame(0, ClassicalQuestion::where('question_set_id', $this->set->id)->count(), 'nothing may be stored by a rejected request');

        // a group cannot be nested, and the parent must really be a group of this set
        $single = $this->make(['type' => 'SHORT_ANSWER', 'content' => 'plain', 'difficulty' => 'EASY']);
        $this->author([...$base, 'type' => 'SHORT_ANSWER', 'parent_id' => $single->id])->assertStatus(422);
        $group = $this->make(['type' => 'GROUP_QUESTION', 'content' => 'g', 'difficulty' => 'EASY']);
        $this->author([...$base, 'type' => 'GROUP_QUESTION', 'parent_id' => $group->id])->assertStatus(422);
    }

    public function test_a_programming_set_does_not_accept_classical_questions(): void
    {
        $prog = QuestionSet::create(['organization_id' => $this->school->id, 'name' => 'P', 'code' => 'PP-1', 'type' => 'PROGRAMMING', 'status' => 'DRAFT', 'max_score' => 100, 'created_by' => $this->admin->id]);
        $this->asSchoolAdmin($this->admin)->post("/admin/question-sets/{$prog->id}/classical-questions", ['type' => 'ESSAY', 'content' => 'x', 'difficulty' => 'EASY'])->assertStatus(422);
    }

    /** A real 1x1 PNG (the sandbox has no GD, so UploadedFile::fake()->image() is unavailable). */
    private function png(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
    }

    public function test_media_upload_is_validated_and_stored_per_organization(): void
    {
        Storage::fake('public');
        $this->asSchoolAdmin($this->admin);

        $ok = $this->postJson('/admin/question-media', ['file' => $this->png('cover.png')])->assertOk()->json('url');
        $this->assertStringContainsString("question-media/{$this->school->id}/", $ok);

        $this->postJson('/admin/question-media', ['file' => UploadedFile::fake()->create('evil.php', 10, 'text/x-php')])->assertStatus(422);
        $this->postJson('/admin/question-media', ['file' => UploadedFile::fake()->create('big.mp3', 30000, 'audio/mpeg')])->assertStatus(422);

        // a student account can never reach the endpoint
        $this->actingAs(User::where('username', 'student01')->first())->postJson('/admin/question-media', ['file' => $this->png('a.png')])->assertForbidden();
    }

    // ---------------------------------------------------------------- grading

    private function answer(ClassicalQuestion $q, array $data): array
    {
        return QuestionSettings::grade($q->load('answers'), new ExamAttemptAnswer($data));
    }

    public function test_grading_per_type(): void
    {
        $single = $this->make(['type' => 'SINGLE_CHOICE', 'content' => 'S', 'points' => 1, 'difficulty' => 'EASY', 'answers' => [['content' => 'a', 'is_correct' => true], ['content' => 'b']]]);
        $this->assertSame(1.0, $this->answer($single, ['answer_id' => $single->answers[0]->id])['score']);
        $this->assertSame(0.0, $this->answer($single, ['answer_id' => $single->answers[1]->id])['score']);

        $multi = $this->make(['type' => 'MULTIPLE_CHOICE', 'content' => 'M', 'points' => 2, 'difficulty' => 'EASY',
            'answers' => [['content' => 'a', 'is_correct' => true], ['content' => 'b', 'is_correct' => true], ['content' => 'c']]]);
        $both = $multi->answers->where('is_correct', true)->pluck('id')->all();
        $this->assertSame(2.0, $this->answer($multi, ['selected_answer_ids' => array_reverse($both)])['score']);
        $this->assertSame(0.0, $this->answer($multi, ['selected_answer_ids' => [$both[0]]])['score']); // partial selection earns nothing

        $tf = $this->make(['type' => 'TRUE_FALSE', 'content' => 'T', 'points' => 1, 'difficulty' => 'EASY', 'is_true' => false]);
        $this->assertTrue($this->answer($tf, ['answer_content' => 'FALSE'])['is_correct']);
        $this->assertFalse($this->answer($tf, ['answer_content' => 'true'])['is_correct']);
        $this->assertFalse($this->answer($tf, ['answer_content' => 'maybe'])['is_correct']);

        $fill = $this->make(['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => '[1] and [2]', 'points' => 2, 'difficulty' => 'EASY',
            'settings' => ['blanks' => [['answers' => ['2015', 'two thousand fifteen']], ['answers' => ['300']]]]]);
        $this->assertSame(['score' => 2.0, 'is_correct' => true, 'pending' => false], $this->answer($fill, ['answer_content' => json_encode(['Two  Thousand Fifteen', ' 300 '])]));
        $half = $this->answer($fill, ['answer_content' => json_encode(['2015', 'wrong'])]);
        $this->assertSame(1.0, $half['score']);   // partial credit per blank
        $this->assertFalse($half['is_correct']);
        $this->assertSame(0.0, $this->answer($fill, ['answer_content' => 'not json'])['score']);

        $short = $this->make(['type' => 'SHORT_ANSWER', 'content' => 'SA', 'points' => 1, 'difficulty' => 'EASY', 'settings' => ['reference' => 'foo|Bar']]);
        $this->assertTrue($this->answer($short, ['answer_content' => '  BAR '])['is_correct']);
        $this->assertFalse($this->answer($short, ['answer_content' => 'baz'])['is_correct']);

        // no reference answer / essays: wait for a teacher
        $manual = $this->make(['type' => 'SHORT_ANSWER', 'content' => 'SA2', 'points' => 1, 'difficulty' => 'EASY']);
        $essay = $this->make(['type' => 'ESSAY', 'content' => 'E', 'points' => 3, 'difficulty' => 'EASY']);
        foreach ([$manual, $essay] as $q) {
            $r = $this->answer($q, ['answer_content' => 'something']);
            $this->assertTrue($r['pending']);
            $this->assertNull($r['is_correct']);
            $this->assertSame(0.0, $r['score']);
        }
    }

    // ---------------------------------------------------------------- what the candidate gets

    public function test_candidate_flow_never_leaks_the_answer_key_and_scores_every_type(): void
    {
        $single = $this->make(['type' => 'SINGLE_CHOICE', 'content' => 'S', 'points' => 1, 'difficulty' => 'EASY', 'answers' => [['content' => 'right', 'is_correct' => true], ['content' => 'wrong']]]);
        $tf = $this->make(['type' => 'TRUE_FALSE', 'content' => 'T', 'points' => 1, 'difficulty' => 'EASY', 'is_true' => true]);
        $fill = $this->make(['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => 'A [1] B [2]', 'points' => 2, 'difficulty' => 'EASY', 'settings' => ['blanks' => [['answers' => ['x']], ['answers' => ['y']]]]]);
        $short = $this->make(['type' => 'SHORT_ANSWER', 'content' => 'SA', 'points' => 1, 'difficulty' => 'EASY', 'settings' => ['reference' => 'secret answer']]);
        $essay = $this->make(['type' => 'ESSAY', 'content' => 'E', 'points' => 3, 'difficulty' => 'EASY', 'settings' => ['mode' => 'file', 'max_files' => 2, 'accept' => '.pdf']]);

        $student = User::where('username', 'student01')->first();
        $course = Course::where('organization_id', $this->school->id)->first();
        $exam = Exam::create([
            'organization_id' => $this->school->id, 'course_id' => $course->id, 'question_set_id' => $this->set->id, 'title' => 'Mixed', 'code' => 'MIX-1',
            'type' => 'QUIZ', 'status' => 'PUBLISHED', 'duration_minutes' => 30, 'created_by' => $this->admin->id, 'monitoring_config' => ['type' => 'CLASSICAL'],
        ]);
        $student->enrolledCourses()->syncWithoutDetaching([$course->id]);

        // authoring above ran as the web-session admin; the candidate is a different caller
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $headers = ['Authorization' => 'Bearer ' . $student->createToken('t')->plainTextToken];
        $start = $this->withHeaders($headers)->postJson("/api/v1/student/exams/{$exam->id}/start");
        $this->assertSame(200, $start->status(), $start->getContent());
        $attemptId = $start->json('data.attempt_id');

        $take = $this->withHeaders($headers)->getJson("/api/v1/student/exams/{$exam->id}/take/{$attemptId}")->assertOk();
        $json = json_encode($take->json());
        foreach (['is_true', 'is_correct', 'secret answer'] as $leak) {
            $this->assertStringNotContainsString($leak, $json, "the paper must not expose `{$leak}`");
        }
        $byId = collect($take->json('data.questions'))->keyBy('id');
        $this->assertSame(['blank_count' => 2], $byId[$fill->id]['settings']);          // how many boxes, never the answers
        $this->assertSame(['max_length' => 300], $byId[$short->id]['settings']);
        $this->assertSame('file', $byId[$essay->id]['settings']['mode']);

        $save = fn (array $d) => $this->withHeaders($headers)->postJson("/api/v1/student/exams/{$exam->id}/take/{$attemptId}/save-answer", ['type' => 'CLASSICAL', ...$d])->assertOk();
        $save(['question_id' => $single->id, 'answer_id' => $single->answers->firstWhere('is_correct', true)->id]);
        $save(['question_id' => $tf->id, 'answer_content' => 'true']);
        $save(['question_id' => $fill->id, 'answer_content' => json_encode(['X', 'nope'])]);
        $save(['question_id' => $short->id, 'answer_content' => 'Secret Answer']);
        $save(['question_id' => $essay->id, 'answer_content' => 'long essay']);

        // 1 (single) + 1 (tf) + 1 (half of the blanks) + 1 (short) + essay waits for a teacher
        $this->withHeaders($headers)->postJson("/api/v1/student/exams/{$exam->id}/submit/{$attemptId}")->assertOk()->assertJsonPath('data.score', 4);

        $review = collect($this->withHeaders($headers)->getJson("/api/v1/student/exams/{$exam->id}/review/{$attemptId}")->assertOk()->json('data.answers'))->keyBy('question_id');
        $this->assertTrue($review[$essay->id]['pending_review']);
        $this->assertTrue($review[$tf->id]['is_true']);                                  // the key appears only after submission
        $this->assertSame('secret answer', $review[$short->id]['reference']);
        $this->assertSame(1.0, (float) $review[$fill->id]['score_earned']);
    }

    // ---------------------------------------------------------------- the draw

    public function test_draw_is_stable_per_attempt_and_respects_limit_and_ratio(): void
    {
        foreach (['EASY' => 4, 'MEDIUM' => 4, 'HARD' => 2] as $level => $n) {
            for ($i = 1; $i <= $n; $i++) {
                $this->make(['type' => 'SHORT_ANSWER', 'content' => "{$level} {$i}", 'points' => 1, 'difficulty' => $level]);
            }
        }
        $group = $this->make(['type' => 'GROUP_QUESTION', 'content' => 'G', 'difficulty' => 'EASY', 'children' => [['type' => 'TRUE_FALSE', 'content' => 'kid', 'is_true' => true]]]);
        $roots = ClassicalQuestion::where('question_set_id', $this->set->id)->whereNull('parent_id')->count(); // 11

        $draw = fn (int $seed) => QuestionSettings::draw($this->set->fresh(), $seed);
        $rootIds = fn ($c) => $c->whereNull('parent_id')->pluck('id')->all();

        // no limit: everything, children included
        $this->assertCount($roots + 1, $draw(1));

        $this->set->update(['limit_questions' => 5]);
        $this->assertCount(5, $rootIds($draw(7)));
        $this->assertSame($rootIds($draw(7)), $rootIds($draw(7)), 'the same attempt must get the same paper on reload');
        $this->assertNotSame($rootIds($draw(7)), $rootIds($draw(8)), 'another attempt gets another draw');

        // 60% easy / 40% medium out of 5 => 3 + 2, never a hard one
        $this->set->update(['limit_questions' => 5, 'ratio_per_difficulty' => ['EASY' => 60, 'MEDIUM' => 40]]);
        $levels = $draw(3)->whereNull('parent_id')->pluck('difficulty')->countBy()->all();
        $this->assertSame(['EASY' => 3, 'MEDIUM' => 2], $levels);

        // a drawn group brings its children along
        $this->set->update(['limit_questions' => $roots - 1, 'ratio_per_difficulty' => null]);
        $drawn = $draw(5);
        if ($drawn->contains('id', $group->id)) {
            $this->assertTrue($drawn->contains('parent_id', $group->id));
        } else {
            $this->assertFalse($drawn->contains('parent_id', $group->id));
        }
    }

    public function test_question_set_rules_are_validated_and_saved(): void
    {
        $this->asSchoolAdmin($this->admin);
        $base = ['name' => 'Types', 'code' => 'QT-1', 'status' => 'DRAFT', 'max_score' => 10];

        $this->post("/admin/question-sets/{$this->set->id}/update", [...$base, 'limit_questions' => 8, 'ratio_per_difficulty' => ['EASY' => 25, 'MEDIUM' => 25, 'HARD' => 25, 'EXPERT' => 25]])->assertSessionHasNoErrors();
        $this->set->refresh();
        $this->assertSame(8, $this->set->limit_questions);
        $this->assertSame(100, array_sum($this->set->ratio_per_difficulty));

        $this->post("/admin/question-sets/{$this->set->id}/update", [...$base, 'ratio_per_difficulty' => ['EASY' => 50, 'MEDIUM' => 20]])->assertSessionHasErrors('ratio_per_difficulty');
        $this->assertSame(100, array_sum($this->set->fresh()->ratio_per_difficulty), 'an invalid ratio must not overwrite the saved one');

        // all zeros = "no ratio"
        $this->post("/admin/question-sets/{$this->set->id}/update", [...$base, 'limit_questions' => 0, 'ratio_per_difficulty' => ['EASY' => 0, 'MEDIUM' => 0]])->assertSessionHasNoErrors();
        $this->assertNull($this->set->fresh()->ratio_per_difficulty);

        // duplicate code inside the same organization is a validation error, not a 500
        QuestionSet::create(['organization_id' => $this->school->id, 'name' => 'Other', 'code' => 'TAKEN', 'type' => 'CLASSICAL', 'status' => 'DRAFT', 'max_score' => 10, 'created_by' => $this->admin->id]);
        $this->post("/admin/question-sets/{$this->set->id}/update", [...$base, 'code' => 'TAKEN'])->assertSessionHasErrors('code');
        $this->post('/admin/question-sets', ['name' => 'Dup', 'code' => 'TAKEN', 'type' => 'CLASSICAL'])->assertSessionHasErrors('code');
    }

    public function test_importing_questions_copies_every_new_field(): void
    {
        $src = $this->make(['type' => 'MULTIPLE_FILL_IN_BLANK', 'content' => '[1]', 'points' => 1, 'difficulty' => 'HARD', 'skill' => 'Từ vựng', 'image' => '/storage/x.png',
            'settings' => ['blanks' => [['answers' => ['a']]]]]);
        $tf = $this->make(['type' => 'TRUE_FALSE', 'content' => 'tf', 'points' => 1, 'difficulty' => 'EASY', 'is_true' => true]);

        $target = QuestionSet::create(['organization_id' => $this->school->id, 'name' => 'Target', 'code' => 'TGT', 'type' => 'CLASSICAL', 'status' => 'DRAFT', 'max_score' => 10, 'created_by' => $this->admin->id]);
        $this->asSchoolAdmin($this->admin)->post("/admin/question-sets/{$target->id}/import-questions", ['selected_ids' => [$src->id, $tf->id]])->assertRedirect();

        $copy = ClassicalQuestion::where('question_set_id', $target->id)->where('type', 'MULTIPLE_FILL_IN_BLANK')->first();
        $this->assertSame('Từ vựng', $copy->skill);
        $this->assertSame('/storage/x.png', $copy->image);
        $this->assertSame([['answers' => ['a']]], $copy->settings['blanks']);
        $this->assertTrue(ClassicalQuestion::where('question_set_id', $target->id)->where('type', 'TRUE_FALSE')->first()->is_true);
    }
}
