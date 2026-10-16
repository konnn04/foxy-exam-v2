<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptAnswer;
use App\Models\Submission;
use App\Services\TenantContext;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/** Manual grading of the answers the system cannot score: essays, short answers and fill-in-the-blank left pending. */
class GradingController extends Controller
{
    public const MANUAL = ['ESSAY', 'SHORT_ANSWER', 'MULTIPLE_FILL_IN_BLANK'];

    public function __construct(private TenantContext $tenant)
    {
    }

    private function attempt(int $id): ExamAttempt
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403);
        $attempt = ExamAttempt::with(['exam', 'user:id,name,username'])->findOrFail($id);
        abort_unless($attempt->exam, 404);
        $this->tenant->enforceOwnership($attempt->exam);

        return $attempt;
    }

    public function show(int $id)
    {
        $attempt = $this->attempt($id);
        $user = Auth::user();
        $org = $this->tenant->current();

        $answers = ExamAttemptAnswer::where('exam_attempt_id', $attempt->id)->with('question')->orderBy('id')->get()
            ->filter(fn ($a) => $a->question && in_array($a->question->type, self::MANUAL, true))
            ->map(fn ($a) => [
                'id' => $a->id,
                'type' => $a->question->type,
                'question' => $a->question->content,
                'points' => (float) $a->question->points,
                'answer' => $a->answer_content,
                'reference' => $a->question->type === 'SHORT_ANSWER' ? ($a->question->settings['reference'] ?? null) : null,
                'blanks' => $a->question->type === 'MULTIPLE_FILL_IN_BLANK' ? ($a->question->settings['blanks'] ?? null) : null,
                'score' => $a->score,
                'graded' => $a->graded_at !== null,
                'pending' => $a->is_correct === null,
                'feedback' => $a->feedback,
            ])->values();

        return Inertia::render('Admin/Attempts/Grading', [
            'user' => ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role,
                'organization' => ['id' => $org->id, 'name' => $org->name, 'code' => $org->code, 'type' => $org->type, 'plan' => $org->activeSubscription?->plan?->name ?? 'FREE']],
            'teams' => $this->tenant->teams(),
            'attempt' => ['id' => $attempt->id, 'status' => $attempt->status, 'score' => $attempt->score, 'student' => $attempt->user?->name, 'username' => $attempt->user?->username,
                'exam' => ['id' => $attempt->exam->id, 'title' => $attempt->exam->title]],
            'answers' => $answers,
        ]);
    }

    public function save(Request $request, int $id)
    {
        $attempt = $this->attempt($id);
        abort_unless(in_array($attempt->status, ['SUBMITTED', 'FORCE_ENDED'], true), 409, 'Phiên thi chưa kết thúc.');
        $data = $request->validate([
            'grades' => ['required', 'array', 'min:1', 'max:200'],
            'grades.*.id' => ['required', 'integer'],
            'grades.*.score' => ['required', 'numeric', 'min:0'],
            'grades.*.feedback' => ['nullable', 'string', 'max:1000'],
        ]);

        $answers = ExamAttemptAnswer::where('exam_attempt_id', $attempt->id)->with('question')->get()->keyBy('id');
        foreach ($data['grades'] as $g) {
            $a = $answers->get((int) $g['id']);
            abort_unless($a && $a->question && in_array($a->question->type, self::MANUAL, true), 422, 'Câu trả lời không thuộc loại chấm tay.');
            $max = (float) $a->question->points;
            $score = round(min($max, max(0.0, (float) $g['score'])), 2);
            $a->update(['score' => $score, 'is_correct' => $max > 0 && $score >= $max, 'feedback' => $g['feedback'] ?? null, 'graded_by' => Auth::id(), 'graded_at' => now()]);
        }

        $total = (float) ExamAttemptAnswer::where('exam_attempt_id', $attempt->id)->sum('score') + (float) Submission::where('exam_attempt_id', $attempt->id)->sum('score');
        $attempt->update(['score' => round($total, 2)]);
        Notify::to($attempt->user_id, 'graded', 'Bài thi đã được chấm', $attempt->exam->title, null);

        return back()->with('success', 'Đã lưu điểm. Tổng điểm: ' . round($total, 2));
    }
}
