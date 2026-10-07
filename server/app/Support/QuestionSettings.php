<?php

namespace App\Support;

use App\Models\ClassicalQuestion;
use App\Models\ExamAttemptAnswer;

/**
 * Per-type behaviour of classical questions: what the author may configure (sanitize),
 * what a candidate is allowed to see (forClient) and how an answer is scored (grade).
 *
 * settings by type
 *   MULTIPLE_FILL_IN_BLANK  blanks: [{answers: ["2015", "two thousand fifteen"]}, ...]   (content uses [1], [2] ...)
 *   SHORT_ANSWER            reference: "answer|alternative"   (empty = graded by hand)
 *   ESSAY                   mode: write|audio|file  + min_words/max_words | prep_seconds/max_seconds | max_files/accept
 *   GROUP_QUESTION          media: text|audio|image, passage, audio_url, listen_limit, allow_seek, image_url
 */
class QuestionSettings
{
    public const SHORT_MAX = 300;

    public static function sanitize(string $type, array $raw): ?array
    {
        return match ($type) {
            'MULTIPLE_FILL_IN_BLANK' => [
                'blanks' => collect($raw['blanks'] ?? [])
                    ->map(fn ($b) => ['answers' => collect((array) ($b['answers'] ?? []))
                        ->map(fn ($a) => trim((string) $a))->filter()->unique()->values()->all()])
                    ->values()->all(),
            ],
            'SHORT_ANSWER' => [
                'reference' => mb_substr(trim((string) ($raw['reference'] ?? '')), 0, self::SHORT_MAX),
            ],
            'ESSAY' => self::essay($raw),
            'GROUP_QUESTION' => self::group($raw),
            default => null,
        };
    }

    private static function essay(array $raw): array
    {
        $mode = $raw['mode'] ?? 'write';
        $mode = in_array($mode, ['write', 'audio', 'file'], true) ? $mode : 'write';
        $int = fn ($k, $d, $max) => max(0, min($max, (int) ($raw[$k] ?? $d)));

        return match ($mode) {
            'audio' => ['mode' => 'audio', 'prep_seconds' => $int('prep_seconds', 60, 600), 'max_seconds' => max(10, $int('max_seconds', 120, 1800))],
            'file' => ['mode' => 'file', 'max_files' => max(1, $int('max_files', 3, 10)), 'accept' => mb_substr((string) ($raw['accept'] ?? '.pdf .jpg .png'), 0, 100)],
            default => ['mode' => 'write', 'min_words' => $int('min_words', 0, 5000), 'max_words' => $int('max_words', 0, 5000)],
        };
    }

    private static function group(array $raw): array
    {
        $media = $raw['media'] ?? 'text';
        $media = in_array($media, ['text', 'audio', 'image'], true) ? $media : 'text';

        return [
            'media' => $media,
            'passage' => (string) ($raw['passage'] ?? ''),
            'audio_url' => $media === 'audio' ? mb_substr((string) ($raw['audio_url'] ?? ''), 0, 500) : null,
            'listen_limit' => max(0, min(20, (int) ($raw['listen_limit'] ?? 2))), // 0 = unlimited
            'allow_seek' => (bool) ($raw['allow_seek'] ?? false),
            'image_url' => $media === 'image' ? mb_substr((string) ($raw['image_url'] ?? ''), 0, 500) : null,
        ];
    }

    /** What FoxyClient may receive: never an answer key. */
    public static function forClient(ClassicalQuestion $q): ?array
    {
        $s = $q->settings ?? [];

        return match ($q->type) {
            'MULTIPLE_FILL_IN_BLANK' => ['blank_count' => count($s['blanks'] ?? [])],
            'SHORT_ANSWER' => ['max_length' => self::SHORT_MAX],
            'ESSAY', 'GROUP_QUESTION' => $s ?: null,
            default => null,
        };
    }

    // ------------------------------------------------------------------ grading

    private static function norm(?string $v): string
    {
        return preg_replace('/\s+/u', ' ', mb_strtolower(trim((string) $v)));
    }

    /**
     * @return array{score: float, is_correct: ?bool, pending: bool}  pending = needs a teacher
     */
    public static function grade(ClassicalQuestion $q, ExamAttemptAnswer $saved): array
    {
        $points = (float) $q->points;
        $ok = fn (float $score, ?bool $correct) => ['score' => $score, 'is_correct' => $correct, 'pending' => false];

        switch ($q->type) {
            case 'SINGLE_CHOICE':
                $chosen = $saved->answer_id ? $q->answers->firstWhere('id', $saved->answer_id) : null;
                $right = (bool) ($chosen && $chosen->is_correct);

                return $ok($right ? $points : 0.0, $right);

            case 'MULTIPLE_CHOICE':
                $correct = $q->answers->where('is_correct', true)->pluck('id')->sort()->values()->all();
                $picked = collect($saved->selected_answer_ids ?? [])->sort()->values()->all();
                $right = !empty($correct) && $correct === $picked;

                return $ok($right ? $points : 0.0, $right);

            case 'TRUE_FALSE':
                $given = self::norm($saved->answer_content);
                if (!in_array($given, ['true', 'false'], true)) {
                    return $ok(0.0, false);
                }
                $right = ($given === 'true') === (bool) $q->is_true;

                return $ok($right ? $points : 0.0, $right);

            case 'MULTIPLE_FILL_IN_BLANK':
                $blanks = $q->settings['blanks'] ?? [];
                if (!$blanks) {
                    return ['score' => 0.0, 'is_correct' => null, 'pending' => true];
                }
                $given = json_decode((string) $saved->answer_content, true);
                $given = is_array($given) ? array_values($given) : [];
                $hits = 0;
                foreach ($blanks as $i => $blank) {
                    $accepted = array_map([self::class, 'norm'], $blank['answers'] ?? []);
                    if (isset($given[$i]) && in_array(self::norm((string) $given[$i]), $accepted, true)) {
                        $hits++;
                    }
                }

                return $ok(round($points * $hits / count($blanks), 4), $hits === count($blanks));

            case 'SHORT_ANSWER':
                $reference = trim((string) ($q->settings['reference'] ?? ''));
                if ($reference === '') {
                    return ['score' => 0.0, 'is_correct' => null, 'pending' => true];
                }
                $accepted = array_map([self::class, 'norm'], explode('|', $reference));
                $right = in_array(self::norm($saved->answer_content), $accepted, true);

                return $ok($right ? $points : 0.0, $right);

            case 'ESSAY':
                return ['score' => 0.0, 'is_correct' => null, 'pending' => true];

            default: // GROUP_QUESTION is only a container; its children are graded on their own
                return $ok(0.0, null);
        }
    }

    // ------------------------------------------------------------------ drawing questions for an attempt

    /**
     * The questions one candidate gets. `limit_questions` = 0 deals everything; otherwise that many
     * top-level questions (a group counts as one) are drawn, honouring `ratio_per_difficulty` when set.
     * The draw is seeded by the attempt id, so a reload or a second device sees the same paper.
     */
    public static function draw(\App\Models\QuestionSet $set, int $seed)
    {
        $all = ClassicalQuestion::where('question_set_id', $set->id)
            ->with(['answers' => fn ($q) => $q->orderBy('order')])
            ->orderBy('order')->orderBy('id')
            ->get();

        $roots = $all->whereNull('parent_id')->values();
        $limit = (int) $set->limit_questions;

        if ($limit <= 0 || $limit >= $roots->count()) {
            return $all;
        }

        $ratio = collect($set->ratio_per_difficulty ?? [])->filter(fn ($v) => (int) $v > 0);
        if ($ratio->sum() > 0) {
            $picked = collect();
            $remaining = $limit;
            $levels = $ratio->keys()->values();
            foreach ($levels as $i => $level) {
                $want = $i === $levels->count() - 1 ? $remaining : (int) round($limit * $ratio[$level] / $ratio->sum());
                $want = min($want, $remaining);
                $picked = $picked->merge(self::seededShuffle($roots->where('difficulty', $level), $seed + $i)->take($want));
                $remaining -= min($want, $roots->where('difficulty', $level)->count());
            }
            // a level that ran out of questions is topped up from the rest
            if ($picked->count() < $limit) {
                $picked = $picked->merge(self::seededShuffle($roots->diff($picked), $seed)->take($limit - $picked->count()));
            }
        } else {
            $picked = self::seededShuffle($roots, $seed)->take($limit);
        }

        $ids = $picked->pluck('id');

        return $all->filter(fn ($q) => $ids->contains($q->id) || $ids->contains($q->parent_id))->values();
    }

    /** Deterministic shuffle: Collection::shuffle() ignores its seed in Laravel 12, so a reload would re-deal the paper. */
    private static function seededShuffle(\Illuminate\Support\Collection $items, int $seed): \Illuminate\Support\Collection
    {
        $rng = new \Random\Randomizer(new \Random\Engine\Mt19937($seed));

        return collect($rng->shuffleArray($items->values()->all()));
    }
}
