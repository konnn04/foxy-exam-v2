<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Violation;
use App\Services\TenantContext;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** CSV downloads for proctors: scores, violations and the chat log. UTF-8 with BOM so Excel opens Vietnamese text correctly. */
class ExportController extends Controller
{
    public function __construct(private TenantContext $tenant)
    {
    }

    private function exam(int $id): Exam
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403);
        $exam = Exam::findOrFail($id);
        $this->tenant->enforceOwnership($exam);

        return $exam;
    }

    private function attempt(int $id): ExamAttempt
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403);
        $attempt = ExamAttempt::with(['exam', 'user:id,name,username'])->findOrFail($id);
        abort_unless($attempt->exam, 404);
        $this->tenant->enforceOwnership($attempt->exam);

        return $attempt;
    }

    /** @param iterable<array<int,mixed>> $rows */
    private function csv(string $name, array $header, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($header, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $header);
            foreach ($rows as $row) {
                // a cell that starts with = + - @ would run as a formula in Excel: defuse it
                fputcsv($out, array_map(fn ($v) => is_string($v) && preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v, $row));
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private static function review(Violation $v): string
    {
        return $v->is_false_positive ? 'Báo nhầm' : ($v->is_reviewed ? 'Đã xác nhận' : 'Chờ duyệt');
    }

    private static function when($t): string
    {
        return $t ? $t->timezone('Asia/Ho_Chi_Minh')->format('d/m/Y H:i:s') : '';
    }

    public function attempts(int $examId): StreamedResponse
    {
        $exam = $this->exam($examId);
        $rows = ExamAttempt::where('exam_id', $exam->id)->with('user:id,name,username,email')->withCount('violations')->orderBy('id')->cursor()
            ->map(fn ($a) => [
                $a->user?->username, $a->user?->name, $a->user?->email, $a->attempt_number, $a->status, $a->ended_reason,
                $a->voided_at ? 'Đã hủy' : '', $a->score, self::when($a->started_at), self::when($a->submitted_at),
                $a->violations_count, $a->risk_score,
            ]);

        return $this->csv("ket-qua-{$exam->code}.csv", ['Tên đăng nhập', 'Họ tên', 'Email', 'Lần thi', 'Trạng thái', 'Lý do kết thúc', 'Hủy', 'Điểm', 'Bắt đầu', 'Nộp bài', 'Số vi phạm', 'Điểm rủi ro'], $rows);
    }

    public function examViolations(int $examId): StreamedResponse
    {
        $exam = $this->exam($examId);
        $rows = Violation::whereHas('attempt', fn ($q) => $q->where('exam_id', $exam->id))->with('attempt.user:id,name,username')->orderBy('id')->cursor()
            ->map(fn ($v) => $this->violationRow($v, true));

        return $this->csv("vi-pham-{$exam->code}.csv", $this->violationHeader(true), $rows);
    }

    public function attemptViolations(int $attemptId): StreamedResponse
    {
        $attempt = $this->attempt($attemptId);
        $rows = Violation::withoutGlobalScope('counted')->where('exam_attempt_id', $attempt->id)->orderBy('timestamp')->cursor()
            ->map(fn ($v) => $this->violationRow($v->setRelation('attempt', $attempt), false));

        return $this->csv("vi-pham-phien-{$attempt->id}.csv", $this->violationHeader(false), $rows);
    }

    private function violationHeader(bool $withStudent): array
    {
        return array_merge($withStudent ? ['Tên đăng nhập', 'Họ tên', 'Phiên'] : [], ['Thời điểm', 'Loại', 'Mức độ', 'Duyệt', 'Mô tả', 'Có ảnh minh chứng']);
    }

    private function violationRow(Violation $v, bool $withStudent): array
    {
        $d = (array) $v->details;

        return array_merge(
            $withStudent ? [$v->attempt?->user?->username, $v->attempt?->user?->name, $v->exam_attempt_id] : [],
            [self::when($v->timestamp), $v->violation_type, $v->severity, self::review($v), $d['message'] ?? '', $v->evidence_id ? 'Có' : ''],
        );
    }

    public function chat(int $attemptId): StreamedResponse
    {
        $attempt = $this->attempt($attemptId);
        $rows = \App\Models\AttemptMessage::where('exam_attempt_id', $attempt->id)->with('sender:id,name')->orderBy('id')->cursor()
            ->map(fn ($m) => [self::when($m->created_at), $m->sender_role === 'PROCTOR' ? 'Giám thị' : 'Thí sinh', $m->sender?->name ?? $attempt->user?->name, $m->body]);

        return $this->csv("chat-phien-{$attempt->id}.csv", ['Thời điểm', 'Vai trò', 'Người gửi', 'Nội dung'], $rows);
    }

    /** One row per exam of the active organization: the overview a department head wants in a spreadsheet. */
    public function exams(): StreamedResponse
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403);
        $rows = Exam::where('organization_id', $this->tenant->current()->id)->with('course:id,name,code')->withCount('attempts')->orderByDesc('id')->cursor()
            ->map(function ($e) {
                $done = ExamAttempt::where('exam_id', $e->id)->whereIn('status', ['SUBMITTED', 'FORCE_ENDED'])->whereNull('voided_at');

                return [
                    $e->code, $e->title, $e->course?->name, $e->status, self::when($e->start_time), self::when($e->end_time), $e->attempts_count,
                    (clone $done)->count(), round((float) (clone $done)->avg('score'), 2),
                    Violation::whereHas('attempt', fn ($q) => $q->where('exam_id', $e->id))->count(),
                    ExamAttempt::where('exam_id', $e->id)->where('is_flagged', true)->count(),
                ];
            });

        return $this->csv('tong-quan-ky-thi.csv', ['Mã phòng', 'Kỳ thi', 'Khóa học', 'Trạng thái', 'Bắt đầu', 'Kết thúc', 'Số lượt thi', 'Đã nộp', 'Điểm trung bình', 'Vi phạm', 'Bị gắn cờ'], $rows);
    }

    /** Typing activity of an attempt (Op-Log batches): who typed and pasted how much, and when. */
    public function oplog(int $attemptId): StreamedResponse
    {
        $attempt = $this->attempt($attemptId);
        $rows = \App\Models\EditOpLog::where('exam_attempt_id', $attempt->id)->orderBy('created_at')->cursor()
            ->map(fn ($l) => [self::when($l->created_at), $l->keystroke_count, $l->paste_event_count, json_encode($l->synthetic_flags ?? [], JSON_UNESCAPED_UNICODE)]);

        return $this->csv("op-log-phien-{$attempt->id}.csv", ['Thời điểm', 'Số phím', 'Số lần dán', 'Dấu hiệu'], $rows);
    }
}
