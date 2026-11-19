<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Turns study material (text, or a PDF / image for Gemini, which reads it with its own OCR) into DRAFT questions in the
 * exact payload format of POST /admin/question-sets/{id}/classical-questions. Nothing is saved here: the lecturer reviews
 * the drafts first. The organization brings its own API key (Cài đặt tổ chức → Trợ lý AI).
 */
class QuestionGenerator
{
    public const PROVIDERS = [
        'gemini' => ['label' => 'Google Gemini', 'model' => 'gemini-2.5-flash', 'files' => true],
        'deepseek' => ['label' => 'DeepSeek', 'model' => 'deepseek-chat', 'files' => false],
    ];

    public const KINDS = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'essay'];

    private const MAX_SOURCE_CHARS = 60000;

    /** @return array{provider:string,model:string,enabled:bool,has_key:bool,key_hint:?string} */
    public static function settingsFor(Organization $org): array
    {
        $ai = $org->settings['ai'] ?? [];
        $provider = isset(self::PROVIDERS[$ai['provider'] ?? '']) ? $ai['provider'] : 'gemini';
        $key = self::decryptKey($ai['api_key'] ?? null);

        return [
            'provider' => $provider,
            'model' => $ai['model'] ?? '',
            'enabled' => (bool) ($ai['enabled'] ?? false),
            'has_key' => $key !== null,
            'key_hint' => $key ? '••••' . substr($key, -4) : null,
        ];
    }

    public static function decryptKey(?string $stored): ?string
    {
        if (!$stored) {
            return null;
        }
        try {
            return Crypt::decryptString($stored);
        } catch (\Throwable) {
            return null; // APP_KEY rotated: the admin has to enter the key again
        }
    }

    /**
     * The instructions every provider receives. Kept in one place so the manual "copy the prompt" mode and the API mode
     * produce the same JSON.
     *
     * @param  array{count:int,kinds:array<int,string>,difficulty:string,language:string,points:float,instructions:?string}  $o
     */
    public static function systemPrompt(array $o): string
    {
        $kinds = implode(', ', $o['kinds']);
        $lang = $o['language'] === 'en' ? 'English' : 'Vietnamese (tiếng Việt có dấu)';
        $difficulty = $o['difficulty'] === 'mixed'
            ? 'a balanced mix: about 30% EASY, 40% MEDIUM, 20% HARD, 10% EXPERT'
            : "all {$o['difficulty']}";
        $extra = trim((string) ($o['instructions'] ?? ''));

        return <<<PROMPT
You are an assessment designer for a university exam system (FoxyExam). Write exam questions ONLY from the source material the user provides.

Rules
- Write exactly {$o['count']} questions in {$lang}.
- Allowed question kinds: {$kinds}. Spread the questions across these kinds.
- Difficulty: {$difficulty}. Use EASY | MEDIUM | HARD | EXPERT.
- Every question must be answerable from the source material alone. Never invent facts that are not in it.
- Choice questions have 4 options (2 to 6 allowed), plausible distractors, exactly one correct option for single_choice and two or more for multiple_choice. Do not use "all of the above" or "none of the above".
- fill_blank: put [1], [2]… in "content" where the candidate types; "blanks" lists the accepted answers of each blank, in order (several spellings allowed).
- short_answer: "reference" is the model answer, under 300 characters; separate alternative accepted answers with " | ".
- essay: "reference" holds the grading guide for the lecturer.
- "explanation" is one or two sentences that justify the answer, shown to candidates after the exam.
- "topic" is a short tag (max 40 characters) naming the chapter or concept.
- Use plain text. Use LaTeX between $ $ only for formulas. No Markdown headings.
{$extra}

Output: a single JSON object, no prose, no code fences, matching exactly:
{
  "questions": [
    {
      "kind": "single_choice | multiple_choice | true_false | fill_blank | short_answer | essay",
      "content": "question text",
      "options": [{"text": "…", "correct": true}],
      "is_true": true,
      "blanks": [["accepted answer", "other spelling"]],
      "reference": "…",
      "difficulty": "EASY | MEDIUM | HARD | EXPERT",
      "explanation": "…",
      "topic": "…"
    }
  ]
}
Only include the fields that apply to the kind ("options" for choice kinds, "is_true" for true_false, "blanks" for fill_blank, "reference" for short_answer and essay).
PROMPT;
    }

    /**
     * @param  array{count:int,kinds:array<int,string>,difficulty:string,language:string,points:float,instructions:?string}  $o
     * @param  array{mime:string,data:string}|null  $file  raw bytes, Gemini only
     * @return array{questions: list<array<string,mixed>>, rejected: list<string>, model: string}
     */
    public function generate(Organization $org, array $o, string $text, ?array $file = null): array
    {
        $cfg = self::settingsFor($org);
        $ai = $org->settings['ai'] ?? [];
        $key = self::decryptKey($ai['api_key'] ?? null);
        if (!$cfg['enabled'] || !$key) {
            throw new RuntimeException('Trường chưa bật Trợ lý AI hoặc chưa nhập khoá API (Cài đặt tổ chức → Trợ lý AI).');
        }
        if ($file && !self::PROVIDERS[$cfg['provider']]['files']) {
            throw new RuntimeException('DeepSeek chỉ nhận văn bản. Hãy dùng tệp Word / PDF có chữ, hoặc chuyển sang Gemini để đọc PDF scan và ảnh.');
        }

        $model = $cfg['model'] ?: self::PROVIDERS[$cfg['provider']]['model'];
        $system = self::systemPrompt($o);
        $user = "Source material:\n\"\"\"\n" . mb_substr($text, 0, self::MAX_SOURCE_CHARS) . "\n\"\"\"";

        $raw = $cfg['provider'] === 'deepseek'
            ? $this->deepseek($key, $model, $system, $user)
            : $this->gemini($key, $model, $system, $user, $file);

        return [...self::normalize($raw, (float) $o['points']), 'model' => $model];
    }

    private function deepseek(string $key, string $model, string $system, string $user): string
    {
        $res = Http::withToken($key)->timeout(150)->acceptJson()->post('https://api.deepseek.com/chat/completions', [
            'model' => $model,
            'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $user]],
            'response_format' => ['type' => 'json_object'],
            'temperature' => 0.4,
            'max_tokens' => 8000,
        ]);
        if (!$res->successful()) {
            throw new RuntimeException('DeepSeek từ chối yêu cầu: ' . self::apiError($res->json(), $res->status()));
        }

        return (string) $res->json('choices.0.message.content', '');
    }

    private function gemini(string $key, string $model, string $system, string $user, ?array $file): string
    {
        $parts = [['text' => $user]];
        if ($file) {
            $parts[] = ['inline_data' => ['mime_type' => $file['mime'], 'data' => base64_encode($file['data'])]];
        }
        $res = Http::withHeaders(['x-goog-api-key' => $key])->timeout(150)->acceptJson()
            ->post('https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent', [
                'systemInstruction' => ['parts' => [['text' => $system]]],
                'contents' => [['role' => 'user', 'parts' => $parts]],
                'generationConfig' => ['responseMimeType' => 'application/json', 'temperature' => 0.4, 'maxOutputTokens' => 16000],
            ]);
        if (!$res->successful()) {
            throw new RuntimeException('Gemini từ chối yêu cầu: ' . self::apiError($res->json(), $res->status()));
        }

        return collect($res->json('candidates.0.content.parts', []))->pluck('text')->implode('');
    }

    private static function apiError(mixed $json, int $status): string
    {
        $msg = is_array($json) ? ($json['error']['message'] ?? null) : null;

        return match (true) {
            $status === 401 || $status === 403 => 'khoá API không hợp lệ hoặc chưa được cấp quyền.',
            $status === 429 => 'đã hết hạn mức hoặc gọi quá nhanh, thử lại sau ít phút.',
            default => $msg ? mb_substr($msg, 0, 200) : "lỗi HTTP {$status}.",
        };
    }

    /**
     * Converts the model's JSON (or JSON pasted by the lecturer from any chatbot) into question payloads.
     * Anything that would not pass ClassicalQuestionWriter is dropped with a reason instead of failing the whole batch.
     *
     * @return array{questions: list<array<string,mixed>>, rejected: list<string>}
     */
    public static function normalize(string $raw, float $points = 1.0): array
    {
        $raw = trim($raw);
        $raw = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $raw) ?? $raw;
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            // some models wrap the object in prose: take the outermost {...}
            $start = strpos($raw, '{');
            $end = strrpos($raw, '}');
            $data = $start !== false && $end > $start ? json_decode(substr($raw, $start, $end - $start + 1), true) : null;
        }
        $list = is_array($data) ? ($data['questions'] ?? (array_is_list($data) ? $data : null)) : null;
        if (!is_array($list)) {
            throw new RuntimeException('Kết quả trả về không phải JSON đúng định dạng { "questions": [...] }.');
        }

        $out = [];
        $rejected = [];
        $str = fn ($v, int $max = 5000) => mb_substr(trim(strip_tags((string) $v)), 0, $max);
        $diff = fn ($v) => in_array(strtoupper((string) $v), ['EASY', 'MEDIUM', 'HARD', 'EXPERT'], true) ? strtoupper((string) $v) : 'MEDIUM';

        foreach (array_slice($list, 0, 100) as $i => $q) {
            $n = $i + 1;
            if (!is_array($q)) {
                $rejected[] = "Câu {$n}: không phải một đối tượng JSON.";
                continue;
            }
            $kind = strtolower((string) ($q['kind'] ?? $q['type'] ?? ''));
            $content = $str($q['content'] ?? $q['question'] ?? '');
            if ($content === '') {
                $rejected[] = "Câu {$n}: thiếu nội dung.";
                continue;
            }
            $base = [
                'content' => $content,
                'explanation' => $str($q['explanation'] ?? '', 2000) ?: null,
                'points' => $points,
                'difficulty' => $diff($q['difficulty'] ?? 'MEDIUM'),
                'skill' => $str($q['topic'] ?? $q['skill'] ?? '', 40) ?: null,
            ];

            switch ($kind) {
                case 'single_choice':
                case 'multiple_choice':
                    $opts = collect($q['options'] ?? $q['answers'] ?? [])->filter(fn ($o) => is_array($o))
                        ->map(fn ($o) => ['content' => $str($o['text'] ?? $o['content'] ?? '', 1000), 'is_correct' => (bool) ($o['correct'] ?? $o['is_correct'] ?? false)])
                        ->filter(fn ($o) => $o['content'] !== '')->take(8)->values();
                    $correct = $opts->where('is_correct', true)->count();
                    if ($opts->count() < 2 || $correct < 1) {
                        $rejected[] = "Câu {$n}: trắc nghiệm cần ít nhất 2 phương án và 1 đáp án đúng.";
                        continue 2;
                    }
                    $out[] = [...$base, 'type' => $correct > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE', 'answers' => $opts->all()];
                    break;
                case 'true_false':
                    if (!array_key_exists('is_true', $q)) {
                        $rejected[] = "Câu {$n}: câu Đúng/Sai thiếu đáp án.";
                        continue 2;
                    }
                    $out[] = [...$base, 'type' => 'TRUE_FALSE', 'is_true' => filter_var($q['is_true'], FILTER_VALIDATE_BOOLEAN)];
                    break;
                case 'fill_blank':
                    preg_match_all('/\[(\d+)\]/', $content, $m);
                    $used = count(array_unique($m[1]));
                    $blanks = collect($q['blanks'] ?? [])->map(fn ($b) => ['answers' => collect(is_array($b) ? $b : explode('|', (string) $b))->map(fn ($x) => $str($x, 200))->filter()->values()->all()])->values()->all();
                    if ($used < 1 || count($blanks) < $used) {
                        $rejected[] = "Câu {$n}: điền khuyết cần ô [1], [2]… và đáp án cho từng ô.";
                        continue 2;
                    }
                    $out[] = [...$base, 'type' => 'MULTIPLE_FILL_IN_BLANK', 'settings' => ['blanks' => $blanks]];
                    break;
                case 'short_answer':
                    $out[] = [...$base, 'type' => 'SHORT_ANSWER', 'settings' => ['reference' => $str($q['reference'] ?? '', 300)]];
                    break;
                case 'essay':
                    $guide = $str($q['reference'] ?? '', 2000);
                    $out[] = [...$base, 'type' => 'ESSAY', 'explanation' => $base['explanation'] ?? ($guide ?: null), 'settings' => ['mode' => 'write', 'min_words' => 0, 'max_words' => 0]];
                    break;
                default:
                    $rejected[] = "Câu {$n}: dạng câu \"{$kind}\" không được hỗ trợ.";
            }
        }

        return ['questions' => $out, 'rejected' => $rejected];
    }
}
