<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuestionSet;
use App\Services\QuestionGenerator;
use App\Services\TenantContext;
use App\Support\Audit;
use App\Support\ClassicalQuestionWriter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** "Tạo câu hỏi bằng AI" in a question set, plus the school's AI settings. */
class AiQuestionController extends Controller
{
    public function __construct(private TenantContext $tenant)
    {
    }

    // ---------- settings (school admin) ----------

    public function updateSettings(Request $request)
    {
        abort_unless($this->tenant->capabilities()['orgSettings'], 403, 'Chỉ quản trị viên của trường mới cấu hình Trợ lý AI.');
        $v = $request->validate([
            'provider' => ['required', 'in:' . implode(',', array_keys(QuestionGenerator::PROVIDERS))],
            'model' => ['nullable', 'string', 'max:80', 'regex:/^[A-Za-z0-9._\-\/:]+$/'],
            'api_key' => ['nullable', 'string', 'max:300'],
            'remove_key' => ['nullable', 'boolean'],
            'enabled' => ['required', 'boolean'],
        ]);

        $org = $this->tenant->current();
        $settings = $org->settings ?? [];
        $ai = $settings['ai'] ?? [];
        $ai['provider'] = $v['provider'];
        $ai['model'] = $v['model'] ?? '';
        $ai['enabled'] = (bool) $v['enabled'];
        if (!empty($v['remove_key'])) {
            unset($ai['api_key']);
        } elseif (!empty($v['api_key'])) {
            // stored encrypted, never sent back to the browser (only the last 4 characters)
            $ai['api_key'] = Crypt::encryptString(trim($v['api_key']));
        }
        $settings['ai'] = $ai;
        $org->update(['settings' => $settings]);
        Audit::record('org.ai_settings', 'Cập nhật Trợ lý AI (' . QuestionGenerator::PROVIDERS[$v['provider']]['label'] . ')', 'organization', $org->id, ['key_changed' => !empty($v['api_key']) || !empty($v['remove_key'])]);

        return back()->with('success', 'Đã lưu cấu hình Trợ lý AI.');
    }

    public function test(QuestionGenerator $gen)
    {
        abort_unless($this->tenant->capabilities()['orgSettings'], 403);
        try {
            $r = $gen->generate($this->tenant->current(), ['count' => 1, 'kinds' => ['true_false'], 'difficulty' => 'EASY', 'language' => 'vi', 'points' => 1, 'instructions' => null], 'Hà Nội là thủ đô của Việt Nam.');

            return response()->json(['ok' => count($r['questions']) > 0, 'model' => $r['model']]);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['ok' => false, 'message' => 'Không kết nối được tới nhà cung cấp AI.'], 502);
        }
    }

    // ---------- question set (staff of the school) ----------

    private function questionSet(int $id): QuestionSet
    {
        $qs = QuestionSet::findOrFail($id);
        $this->tenant->enforceOwnership($qs);
        abort_unless($qs->type === 'CLASSICAL', 422, 'Chỉ bộ đề trắc nghiệm & tự luận mới tạo câu hỏi bằng AI.');

        return $qs;
    }

    private function options(Request $request): array
    {
        $v = $request->validate([
            'count' => ['required', 'integer', 'min:1', 'max:50'],
            'kinds' => ['required', 'array', 'min:1'],
            'kinds.*' => ['in:' . implode(',', QuestionGenerator::KINDS)],
            'difficulty' => ['required', 'in:mixed,EASY,MEDIUM,HARD,EXPERT'],
            'language' => ['required', 'in:vi,en'],
            'points' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'instructions' => ['nullable', 'string', 'max:1000'],
        ]);

        return [
            'count' => (int) $v['count'], 'kinds' => array_values(array_unique($v['kinds'])), 'difficulty' => $v['difficulty'],
            'language' => $v['language'], 'points' => (float) ($v['points'] ?? 1), 'instructions' => $v['instructions'] ?? null,
        ];
    }

    /** The prompt to paste into any chatbot when the school has no API key. */
    public function prompt(Request $request, int $id)
    {
        $this->questionSet($id);

        return response()->json(['prompt' => QuestionGenerator::systemPrompt($this->options($request))]);
    }

    public function generate(Request $request, int $id, QuestionGenerator $gen)
    {
        $qs = $this->questionSet($id);
        $o = $this->options($request);
        $request->validate([
            'text' => ['nullable', 'string', 'max:200000'],
            'file' => ['nullable', 'file', 'max:15360', 'mimes:pdf,png,jpg,jpeg,webp'],
        ]);
        $text = (string) $request->input('text', '');
        $file = $request->file('file');
        if (trim($text) === '' && !$file) {
            return response()->json(['message' => 'Hãy chọn tệp hoặc dán nội dung tài liệu.'], 422);
        }

        try {
            $result = $gen->generate($this->tenant->current(), $o, $text, $file ? ['mime' => $file->getMimeType(), 'data' => $file->get()] : null);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Không kết nối được tới nhà cung cấp AI. Thử lại sau ít phút.'], 502);
        }

        Audit::record('bank.ai_generate', "Tạo {$o['count']} câu bằng AI cho bộ đề #{$qs->id}", 'bank', $qs->id, ['model' => $result['model'], 'returned' => count($result['questions'])]);

        return response()->json($result);
    }

    /** JSON pasted back from a chatbot (manual mode). */
    public function parse(Request $request, int $id)
    {
        $this->questionSet($id);
        $v = $request->validate(['json' => ['required', 'string', 'max:500000'], 'points' => ['nullable', 'numeric', 'min:0', 'max:100']]);
        try {
            return response()->json(QuestionGenerator::normalize($v['json'], (float) ($v['points'] ?? 1)));
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /** Saves the drafts the lecturer kept, in one transaction. */
    public function save(Request $request, int $id)
    {
        $qs = $this->questionSet($id);
        $rules = ['questions' => ['required', 'array', 'min:1', 'max:100']];
        foreach (ClassicalQuestionWriter::rules('questions.*.') as $k => $r) {
            $rules[$k] = $r;
        }
        $v = $request->validate($rules);

        DB::transaction(function () use ($v, $qs) {
            $order = ClassicalQuestionWriter::nextOrder($qs);
            foreach ($v['questions'] as $i => $q) {
                abort_if($q['type'] === 'GROUP_QUESTION', 422, 'Không tạo câu hỏi nhóm từ AI.');
                ClassicalQuestionWriter::check($q, 'Câu ' . ($i + 1));
                ClassicalQuestionWriter::store($qs, $q, null, $order + $i);
            }
        });
        Audit::record('bank.ai_save', 'Thêm ' . count($v['questions']) . " câu do AI tạo vào bộ đề #{$qs->id}", 'bank', $qs->id);

        return response()->json(['saved' => count($v['questions'])]);
    }
}
