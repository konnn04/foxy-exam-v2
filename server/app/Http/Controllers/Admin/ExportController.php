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

    /** Raw post-exam audit tracking log (TRACKING_{attemptId}.txt): chronological keystrokes, mouse clicks, CPU/RAM, and violations. */
    public function tracking(int $attemptId): StreamedResponse
    {
        $attempt = $this->attempt($attemptId);

        return response()->streamDownload(function () use ($attempt) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fwrite($out, "================================================================================\n");
            fwrite($out, "EXAM GUARD — BẢN GHI HẬU KIỂM HÀNH VI & TELEMETRY (RAW TRACKING LOG)\n");
            fwrite($out, "================================================================================\n");
            fwrite($out, "Phiên thi    : #{$attempt->id} (Lần thi thứ {$attempt->attempt_number})\n");
            fwrite($out, "Kỳ thi       : {$attempt->exam->title} ({$attempt->exam->code})\n");
            fwrite($out, "Thí sinh     : " . ($attempt->user?->name ?? '—') . ' (' . ($attempt->user?->username ?? '—') . ")\n");
            fwrite($out, "Bắt đầu      : " . self::when($attempt->started_at) . "\n");
            fwrite($out, "Kết thúc     : " . (self::when($attempt->submitted_at) ?: 'Đang làm bài') . "\n");
            fwrite($out, "Điểm rủi ro  : {$attempt->risk_score} · Trạng thái: {$attempt->status}\n");
            if (is_array($attempt->device_info) && !empty($attempt->device_info)) {
                fwrite($out, "Thiết bị     : " . json_encode($attempt->device_info, JSON_UNESCAPED_UNICODE) . "\n");
            }
            fwrite($out, "================================================================================\n\n");

            fwrite($out, "[1] NHẬT KÝ VI PHẠM AN NINH (SECURITY VIOLATIONS)\n");
            fwrite($out, "--------------------------------------------------------------------------------\n");
            $violations = Violation::withoutGlobalScope('counted')->where('exam_attempt_id', $attempt->id)->orderBy('timestamp')->get();
            if ($violations->isEmpty()) {
                fwrite($out, "(Không có vi phạm)\n");
            } else {
                foreach ($violations as $v) {
                    $time = self::when($v->timestamp);
                    $rev = self::review($v);
                    $msg = is_array($v->details) ? ($v->details['message'] ?? json_encode($v->details, JSON_UNESCAPED_UNICODE)) : (string) $v->details;
                    fwrite($out, "[{$time}] [{$v->severity}] {$v->violation_type} ({$rev}) — {$msg}\n");
                }
            }

            fwrite($out, "\n[2] NHẬT KÝ THAO TÁC PHÍM, CHUỘT & HIỆU NĂNG (OP-LOG, MOUSE_CLICK & PERF_METRICS)\n");
            fwrite($out, "--------------------------------------------------------------------------------\n");
            $logs = \App\Models\EditOpLog::where('exam_attempt_id', $attempt->id)->orderBy('batch_seq')->get();
            if ($logs->isEmpty()) {
                fwrite($out, "(Không có dữ liệu thao tác)\n");
            } else {
                foreach ($logs as $l) {
                    $time = self::when($l->created_at);
                    $flags = is_array($l->synthetic_flags) ? $l->synthetic_flags : [];
                    $cpu = isset($flags['cpu']) ? "{$flags['cpu']}%" : '—';
                    $ram = isset($flags['ram']) ? "{$flags['ram']}%" : '—';
                    $mouseCount = $flags['mouse_count'] ?? (is_array($flags['mouse_clicks'] ?? null) ? count($flags['mouse_clicks']) : 0);
                    fwrite($out, sprintf(
                        "[%s] Batch #%d | Keys: %d | Pastes: %d | MouseClicks: %d | CPU: %s | RAM: %s\n",
                        $time,
                        $l->batch_seq,
                        $l->keystroke_count,
                        $l->paste_event_count,
                        $mouseCount,
                        $cpu,
                        $ram
                    ));

                    $clicks = $flags['mouse_clicks'] ?? [];
                    if (!empty($clicks) && is_array($clicks)) {
                        $formattedClicks = array_map(function ($c) {
                            if (!is_array($c) || count($c) < 2) {
                                return '';
                            }
                            $btn = match ($c[2] ?? 0) {
                                2 => 'R',
                                1 => 'M',
                                default => 'L',
                            };
                            return "({$c[0]},{$c[1]},{$btn})";
                        }, array_slice($clicks, 0, 50));
                        fwrite($out, '    -> mouse_click(x,y,btn): ' . implode(' ', array_filter($formattedClicks)) . "\n");
                    }

                    if (!empty($l->raw_ops_payload)) {
                        fwrite($out, '    -> raw_ops: ' . substr((string) $l->raw_ops_payload, 0, 2000) . "\n");
                    }
                }
            }

            fclose($out);
        }, "TRACKING_{$attempt->id}.txt", ['Content-Type' => 'text/plain; charset=UTF-8']);
    }
}
