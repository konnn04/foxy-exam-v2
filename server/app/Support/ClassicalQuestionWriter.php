<?php

namespace App\Support;

use App\Models\ClassicalQuestion;
use App\Models\ClassicalQuestionAnswer;
use App\Models\QuestionSet;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Validation + persistence of one classical question (and the children of a group). Shared by the question editor,
 * the AI generator and any bulk insert, so they can never disagree on what a valid question is.
 */
final class ClassicalQuestionWriter
{
    /** Laravel rules for one question payload, keys prefixed with $p (e.g. "questions.3."). */
    public static function rules(string $p = ''): array
    {
        return [
            $p . 'type' => ['required', Rule::in(ClassicalQuestion::TYPES)],
            $p . 'content' => ['required', 'string'],
            $p . 'explanation' => ['nullable', 'string'],
            $p . 'points' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            $p . 'difficulty' => ['required', Rule::in(ClassicalQuestion::DIFFICULTIES)],
            $p . 'skill' => ['nullable', 'string', 'max:40'],
            $p . 'image' => ['nullable', 'string', 'max:500'],
            $p . 'is_true' => ['nullable', 'boolean'],
            $p . 'settings' => ['nullable', 'array'],
            $p . 'answers' => ['nullable', 'array', 'max:8'],
            $p . 'answers.*.content' => ['required_with:' . $p . 'answers', 'string'],
            $p . 'answers.*.is_correct' => ['nullable', 'boolean'],
        ];
    }

    /** Semantic checks the form also shows; throws with a message naming the question. */
    public static function check(array $q, string $label): void
    {
        $type = $q['type'];
        $answers = collect($q['answers'] ?? [])->filter(fn ($a) => trim((string) ($a['content'] ?? '')) !== '');
        if (in_array($type, ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'], true)) {
            if ($answers->count() < 2) {
                throw ValidationException::withMessages(['answers' => "$label: trắc nghiệm cần ít nhất 2 đáp án."]);
            }
            if ($answers->where('is_correct', true)->count() < 1) {
                throw ValidationException::withMessages(['answers' => "$label: cần đánh dấu ít nhất 1 đáp án đúng."]);
            }
        }
        if ($type === 'TRUE_FALSE' && !array_key_exists('is_true', $q)) {
            throw ValidationException::withMessages(['is_true' => "$label: chọn Đúng hoặc Sai."]);
        }
        if ($type === 'MULTIPLE_FILL_IN_BLANK') {
            $blanks = $q['settings']['blanks'] ?? [];
            preg_match_all('/\[(\d+)\]/', $q['content'], $m);
            $used = collect($m[1])->unique()->count();
            if ($used < 1) {
                throw ValidationException::withMessages(['content' => "$label: dùng [1], [2]… trong nội dung để tạo ô trống."]);
            }
            if (count($blanks) < $used) {
                throw ValidationException::withMessages(['settings' => "$label: nhập đáp án cho đủ $used ô trống."]);
            }
        }
    }

    public static function store(QuestionSet $qs, array $q, ?int $parentId, int $order, ?ClassicalQuestion $existing = null): ClassicalQuestion
    {
        $type = $q['type'];
        $attrs = [
            'type' => $type,
            'content' => $q['content'],
            'explanation' => $q['explanation'] ?? null,
            'points' => $type === 'GROUP_QUESTION' ? 0 : ($q['points'] ?? 1),
            'difficulty' => $q['difficulty'] ?? 'MEDIUM',
            'skill' => $q['skill'] ?? null,
            'image' => $q['image'] ?? null,
            'is_true' => $type === 'TRUE_FALSE' ? (bool) ($q['is_true'] ?? false) : null,
            'settings' => QuestionSettings::sanitize($type, $q['settings'] ?? []),
        ];

        if ($existing) {
            $existing->update($attrs);
            $question = $existing;
        } else {
            $question = ClassicalQuestion::create([
                ...$attrs,
                'question_set_id' => $qs->id,
                'parent_id' => $parentId,
                'order' => $order,
                'created_by' => Auth::id(),
            ]);
        }

        $question->answers()->delete();
        if (in_array($type, ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'], true)) {
            $answers = collect($q['answers'] ?? [])->filter(fn ($a) => trim((string) ($a['content'] ?? '')) !== '')->values();
            // one correct answer => radio, several => checkboxes
            if ($answers->where('is_correct', true)->count() > 1 && $type === 'SINGLE_CHOICE') {
                $question->update(['type' => 'MULTIPLE_CHOICE']);
            }
            foreach ($answers as $i => $a) {
                ClassicalQuestionAnswer::create([
                    'classical_question_id' => $question->id,
                    'content' => $a['content'],
                    'is_correct' => !empty($a['is_correct']),
                    'order' => $i + 1,
                ]);
            }
        }

        return $question;
    }

    /** Next free order at the top level (or inside a group). */
    public static function nextOrder(QuestionSet $qs, ?int $parentId = null): int
    {
        return (ClassicalQuestion::where('question_set_id', $qs->id)->where('parent_id', $parentId)->max('order') ?? 0) + 1;
    }
}
