<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EditOpLog;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Submission;
use App\Models\Violation;
use App\Services\Realtime;
use App\Services\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Proctoring screens from "FoxyExam Screens v2":
 * Giám sát trực tiếp (live), Phiên thi & vi phạm (attempt), Xem bài làm (submissions).
 */
class MonitoringController extends Controller
{
    public function __construct(private TenantContext $tenant)
    {
    }

    private function guardStaff(): void
    {
        if (!in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true)) {
            abort(403, 'Chỉ giảng viên và quản trị viên mới truy cập được màn giám sát.');
        }
    }

    /** Shared layout props (same shape as the closures in routes/web.php). */
    private function layoutProps(): array
    {
        $user = Auth::user();
        $org = $this->tenant->current();

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'role' => $user->role,
                'organization' => [
                    'id' => $org->id,
                    'name' => $org->name,
                    'code' => $org->code,
                    'type' => $org->type,
                    'plan' => $org->activeSubscription?->plan?->name ?? 'FREE',
                ],
            ],
            'teams' => $this->tenant->teams(),
        ];
    }

    /** Exams of the ACTIVE organization only (the platform context has no proctoring at all). */
    private function examScope()
    {
        return Exam::where('organization_id', $this->tenant->current()->id);
    }

    private function attemptOrFail(int $attemptId): ExamAttempt
    {
        $attempt = ExamAttempt::with(['exam', 'user:id,name,username,email,avatar'])->findOrFail($attemptId);
        // the Exam model hides other organizations' exams: a missing exam means "not yours"
        abort_unless($attempt->exam, 404);
        $this->tenant->enforceOwnership($attempt->exam);

        return $attempt;
    }

    /** /admin/live — Giám sát kỳ thi: every exam of the active org; a row opens its dashboard + sessions. */
    public function index()
    {
        $this->guardStaff();
        $exams = $this->examScope()
            ->with(['course:id,code,name', 'organization:id,code,name'])
            ->withCount([
                'attempts',
                'attempts as active_count' => fn ($a) => $a->where('status', 'IN_PROGRESS'),
                'attempts as submitted_count' => fn ($a) => $a->where('status', 'SUBMITTED'),
                'violations as pending_violations_count' => fn ($v) => $v->where('is_reviewed', false)->where('is_false_positive', false),
            ])
            ->latest()
            ->limit(500)
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'code' => $e->code,
                'type' => $e->type,
                'status' => $e->status,
                'course' => $e->course ? ['code' => $e->course->code, 'name' => $e->course->name] : null,
                'organization' => $e->organization ? ['code' => $e->organization->code, 'name' => $e->organization->name] : null,
                'start_time' => $e->start_time?->toIso8601String(),
                'end_time' => $e->end_time?->toIso8601String(),
                'attempts_count' => $e->attempts_count,
                'active_count' => $e->active_count,
                'submitted_count' => $e->submitted_count,
                'pending_violations_count' => $e->pending_violations_count,
            ]);

        return Inertia::render('Admin/Live/Index', [
            ...$this->layoutProps(),
            'exams' => $exams,
        ]);
    }

    /** /admin/exams/{id}/live — tile grid + realtime event feed. */
    public function show(int $examId)
    {
        $this->guardStaff();
        $exam = Exam::with(['course:id,code,name', 'questionSet.programmingProblems:id,question_set_id,title'])->findOrFail($examId);
        $this->tenant->enforceOwnership($exam);

        $problemIds = $exam->questionSet?->programmingProblems->pluck('id')->values() ?? collect();
        $since = now()->subMinutes(5);

        $attempts = ExamAttempt::where('exam_id', $exam->id)
            ->with([
                'user:id,name,username',
                'submissions:id,exam_attempt_id,programming_problem_id,status,score',
            ])
            ->withCount([
                'violations',
                'violations as pending_violations_count' => fn ($v) => $v->where('is_reviewed', false)->where('is_false_positive', false),
            ])
            ->withMax('violations as last_violation_at', 'timestamp')
            ->withMax('editOpLogs as last_op_at', 'created_at')
            ->withSum(['editOpLogs as recent_keystrokes' => fn ($q) => $q->where('created_at', '>=', $since)], 'keystroke_count')
            ->orderBy('id')
            ->get()
            ->map(function ($a) use ($problemIds) {
                // Per-problem progress: 2 = AC, 1 = attempted, 0 = untouched.
                $progress = $problemIds->map(function ($pid) use ($a) {
                    $subs = $a->submissions->where('programming_problem_id', $pid);
                    if ($subs->isEmpty()) {
                        return 0;
                    }
                    return $subs->contains('status', 'ACCEPTED') ? 2 : 1;
                })->values();
                $last = collect([$a->last_violation_at, $a->last_op_at, $a->submitted_at, $a->started_at])->filter()->max();

                return [
                    'id' => $a->id,
                    'name' => $a->user?->name ?? 'Thí sinh',
                    'username' => $a->user?->username ?? '',
                    'attempt_number' => $a->attempt_number,
                    'ended_reason' => $a->ended_reason,
                    'status' => $a->status,
                    'is_flagged' => (bool) $a->is_flagged,
                    'voided' => $a->voided_at !== null,
                    'risk_score' => (int) $a->risk_score,
                    'started_at' => $a->started_at?->toIso8601String(),
                    'submitted_at' => $a->submitted_at?->toIso8601String(),
                    'violations_count' => $a->violations_count,
                    'pending_violations_count' => $a->pending_violations_count,
                    'ops_per_min' => $a->recent_keystrokes !== null ? (int) round($a->recent_keystrokes / 5) : null,
                    'last_activity_at' => $last ? \Illuminate\Support\Carbon::parse($last)->toIso8601String() : null,
                    'progress' => $progress,
                ];
            });

        $feed = Violation::whereHas('attempt', fn ($q) => $q->where('exam_id', $exam->id))
            ->with('attempt.user:id,name,username')
            ->orderByDesc('id')
            ->take(40)
            ->get()
            ->map(fn ($v) => [
                'id' => $v->id,
                'attempt_id' => $v->exam_attempt_id,
                'type' => $v->violation_type,
                'severity' => $v->severity,
                'details' => $v->details,
                'student_name' => $v->attempt?->user?->name ?? 'Thí sinh',
                'timestamp' => $v->timestamp?->toIso8601String(),
                'is_reviewed' => (bool) $v->is_reviewed,
                'is_false_positive' => (bool) $v->is_false_positive,
            ]);

        return Inertia::render('Admin/Live/Show', [
            ...$this->layoutProps(),
            'exam' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'code' => $exam->code,
                'type' => $exam->type,
                'status' => $exam->status,
                'duration_minutes' => $exam->duration_minutes,
                'start_time' => $exam->start_time?->toIso8601String(),
                'end_time' => $exam->end_time?->toIso8601String(),
                'course' => $exam->course ? ['code' => $exam->course->code, 'name' => $exam->course->name] : null,
                'problems_count' => $problemIds->count(),
            ],
            'attempts' => $attempts,
            'feed' => $feed,
            'serverTime' => now()->toIso8601String(),
        ]);
    }

    /** POST /admin/exams/{id}/end — close the room and force-end running attempts. */
    public function end(int $examId)
    {
        $this->guardStaff();
        $exam = Exam::findOrFail($examId);
        $this->tenant->enforceOwnership($exam);

        $running = ExamAttempt::where('exam_id', $exam->id)->where('status', 'IN_PROGRESS')->get();
        ExamAttempt::where('exam_id', $exam->id)->where('status', 'IN_PROGRESS')->update([
            'status' => 'FORCE_ENDED',
            'submitted_at' => now(),
        ]);
        foreach ($running as $a) {
            app(Realtime::class)->lifecycle($a, 'force_ended');
        }
        $exam->update(['status' => 'ENDED', 'end_time' => $exam->end_time && $exam->end_time->isPast() ? $exam->end_time : now()]);

        return back()->with('success', 'Đã kết thúc ca thi.');
    }

    /** POST /admin/attempts/{id}/force-end — a proctor ends one candidate's session. */
    public function forceEndAttempt(int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);
        if ($attempt->status !== 'IN_PROGRESS') {
            return back()->with('error', 'Phiên thi này đã kết thúc.');
        }
        $attempt->update(['status' => 'FORCE_ENDED', 'submitted_at' => now()]);
        app(Realtime::class)->lifecycle($attempt, 'force_ended'); // the client is told to stop with its next batch

        return back()->with('success', 'Đã đình chỉ phiên thi của thí sinh.');
    }

    /**
     * GET /admin/exams/{id}/realtime — connection info for the proctor UI: a 1-hour token scoped to THIS exam
     * and the hub / recording service URLs. 503 when the realtime plane is not configured.
     */
    public function realtime(int $examId)
    {
        $this->guardStaff();
        $exam = Exam::findOrFail($examId);
        $this->tenant->enforceOwnership($exam);

        $rt = app(Realtime::class);
        if (!$rt->enabled()) {
            return response()->json(['enabled' => false], 503);
        }
        $ttl = 3600;

        return response()->json([
            'enabled' => true,
            'exam_id' => $exam->id,
            'token' => $rt->proctorToken(Auth::user(), (int) $exam->organization_id, [$exam->id], $ttl),
            'expires_at' => now()->addSeconds($ttl)->toIso8601String(),
            'hub_ws_url' => rtrim((string) config('services.realtime.hub_url'), '/') . "/v1/rooms/{$exam->id}/ws",
            'hub_http_url' => rtrim((string) config('services.realtime.hub_url'), '/'),
            'record_url' => rtrim((string) config('services.realtime.record_url'), '/'),
        ]);
    }

    /** GET /admin/exams/{id}/violations?before=ID&limit=N — newest-first cursor pages of an exam's violations. */
    public function violationsPage(Request $request, int $examId)
    {
        $this->guardStaff();
        $exam = Exam::findOrFail($examId);
        $this->tenant->enforceOwnership($exam);
        $limit = max(1, min(100, (int) $request->query('limit', 40)));

        $rows = Violation::whereHas('attempt', fn ($q) => $q->where('exam_id', $exam->id))
            ->with('attempt.user:id,name,username')
            ->when($request->query('before'), fn ($q, $before) => $q->where('id', '<', (int) $before))
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();

        return response()->json([
            'has_more' => $rows->count() > $limit,
            'data' => $rows->take($limit)->map(fn ($v) => [
                'id' => $v->id,
                'attempt_id' => $v->exam_attempt_id,
                'type' => $v->violation_type,
                'severity' => $v->severity,
                'details' => $v->details,
                'student_name' => $v->attempt?->user?->name ?? 'Thí sinh',
                'student_username' => $v->attempt?->user?->username ?? '',
                'timestamp' => $v->timestamp?->toIso8601String(),
                'is_reviewed' => (bool) $v->is_reviewed,
                'is_false_positive' => (bool) $v->is_false_positive,
            ])->values(),
        ]);
    }

    /** Subscribe-only LiveKit token so the live screen can show candidates' camera and screen. */
    public function liveVideo(int $examId)
    {
        $this->guardStaff();
        $exam = Exam::findOrFail($examId);
        $this->tenant->enforceOwnership($exam);

        $info = app(Realtime::class)->proctorLiveKitToken(Auth::user(), $exam);

        return $info ? response()->json(['enabled' => true] + $info) : response()->json(['enabled' => false], 503);
    }

    /** /admin/attempts/{id} — one candidate's session, violation timeline & review. */
    public function attempt(int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);

        $violations = Violation::withoutGlobalScope('counted')->where('exam_attempt_id', $attempt->id)
            ->orderBy('timestamp')
            ->get()
            ->map(fn ($v) => [
                'id' => $v->id,
                'type' => $v->violation_type,
                'severity' => $v->severity,
                'details' => $v->details,
                'evidence_url' => $v->evidence_url,
                'evidence_id' => $v->evidence_id,
                'is_reviewed' => (bool) $v->is_reviewed,
                'is_false_positive' => (bool) $v->is_false_positive,
                'timestamp' => $v->timestamp?->toIso8601String(),
            ]);

        $typing = EditOpLog::where('exam_attempt_id', $attempt->id)
            ->orderBy('created_at')
            ->get(['created_at', 'keystroke_count', 'paste_event_count', 'synthetic_flags'])
            ->map(function ($l) {
                $flags = is_array($l->synthetic_flags) ? $l->synthetic_flags : [];

                return [
                    't' => $l->created_at?->toIso8601String(),
                    'keys' => (int) $l->keystroke_count,
                    'pastes' => (int) $l->paste_event_count,
                    'clicks' => isset($flags['mouse_count']) ? (int) $flags['mouse_count'] : (is_array($flags['mouse_clicks'] ?? null) ? count($flags['mouse_clicks']) : 0),
                    'cpu' => isset($flags['cpu']) && is_numeric($flags['cpu']) ? (int) $flags['cpu'] : null,
                    'ram' => isset($flags['ram']) && is_numeric($flags['ram']) ? (int) $flags['ram'] : null,
                ];
            });

        $submissions = Submission::where('exam_attempt_id', $attempt->id)
            ->orderBy('submitted_at')
            ->get(['id', 'status', 'submitted_at'])
            ->map(fn ($s) => ['id' => $s->id, 'status' => $s->status, 't' => $s->submitted_at?->toIso8601String()]);

        $existingReport = \App\Models\ViolationReport::where('exam_attempt_id', $attempt->id)->first();

        return Inertia::render('Admin/Attempts/Show', [
            ...$this->layoutProps(),
            'attempt' => $this->attemptPayload($attempt),
            'violations' => $violations,
            'typing' => $typing,
            'submissions' => $submissions,
            'violationReport' => \App\Http\Controllers\ViolationReportController::formatForAdmin($existingReport),
            'reportReasonTemplates' => \App\Models\ViolationReport::REASON_TEMPLATES,
        ]);
    }

    /** GET /admin/attempts/{id}/verify-chain — does the stored violation log still match its hash chain? */
    public function verifyChain(int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);

        return response()->json(\App\Support\ViolationChain::verify($attempt->id));
    }

    /** GET /admin/attempts/{id}/report — formal printable HTML report of an exam attempt & its violations (UC-T03). */
    public function report(int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);
        $org = $this->tenant->current();
        $proctor = Auth::user();

        $violations = Violation::withoutGlobalScope('counted')
            ->where('exam_attempt_id', $attempt->id)
            ->orderBy('timestamp')
            ->get();

        $confirmed = $violations->where('is_reviewed', true)->where('is_false_positive', false)->values();
        $pending = $violations->where('is_reviewed', false)->where('is_false_positive', false)->values();
        $falsePos = $violations->where('is_false_positive', true)->values();
        $chain = \App\Support\ViolationChain::verify($attempt->id);

        $fmtTime = fn ($t) => $t ? $t->timezone('Asia/Ho_Chi_Minh')->format('H:i:s d/m/Y') : '—';
        $statusLabel = match ($attempt->status) {
            'SUBMITTED' => 'Đã nộp bài',
            'FORCE_ENDED' => 'Đình chỉ / Thu bài',
            'IN_PROGRESS' => 'Đang làm bài',
            default => $attempt->status,
        };
        if ($attempt->voided_at) {
            $statusLabel .= ' (Đã hủy kết quả)';
        }

        $rowsHtml = '';
        $listToPrint = $violations->where('is_false_positive', false)->values();
        if ($listToPrint->isEmpty()) {
            $rowsHtml = '<tr><td colspan="6" style="text-align:center;padding:16px;color:#64748b;">Không có vi phạm nào được ghi nhận (hoặc tất cả cảnh báo đều đã được đánh dấu báo nhầm).</td></tr>';
        } else {
            foreach ($listToPrint as $idx => $v) {
                $num = $idx + 1;
                $timeStr = e($fmtTime($v->timestamp));
                $label = e(\App\Support\ViolationCatalog::label($v->violation_type));
                $typeCode = e($v->violation_type);
                $sevLabel = match ($v->severity) {
                    'CRITICAL' => 'Nghiêm trọng',
                    'HIGH' => 'Cao',
                    'MEDIUM' => 'Trung bình',
                    default => 'Thấp',
                };
                $revStatus = $v->is_reviewed ? 'Đã xác nhận' : 'Chờ duyệt';
                $details = is_array($v->details) ? ($v->details['message'] ?? json_encode($v->details, JSON_UNESCAPED_UNICODE)) : (string) $v->details;
                $details = e((string) $details);
                $rowsHtml .= "<tr>
                    <td style='text-align:center;'>{$num}</td>
                    <td style='font-family:monospace;white-space:nowrap;'>{$timeStr}</td>
                    <td><strong>{$label}</strong><br><span style='font-size:11px;color:#64748b;font-family:monospace;'>{$typeCode}</span></td>
                    <td style='text-align:center;'>{$sevLabel}</td>
                    <td style='text-align:center;'>{$revStatus}</td>
                    <td>{$details}</td>
                </tr>";
            }
        }

        $dev = is_array($attempt->device_info) ? $attempt->device_info : [];
        $devSummary = collect([
            !empty($dev['hostname']) ? 'Máy: ' . $dev['hostname'] : null,
            !empty($dev['os']) ? 'HĐH: ' . $dev['os'] : null,
            !empty($dev['ip']) ? 'IP: ' . $dev['ip'] : null,
            !empty($dev['fingerprint']) ? 'Mã thiết bị: ' . substr((string) $dev['fingerprint'], 0, 12) : null,
        ])->filter()->implode(' · ') ?: 'Không có thông tin';

        $orgName = e($org->name ?? 'Trường Đại học Mở TP.HCM');
        $examTitle = e($attempt->exam->title);
        $examCode = e($attempt->exam->code);
        $studentName = e($attempt->user?->name ?? 'Thí sinh');
        $studentUsername = e($attempt->user?->username ?? '—');
        $studentEmail = e($attempt->user?->email ?? '—');
        $scoreStr = $attempt->score !== null ? number_format((float) $attempt->score, 2) : 'Chưa chấm / Không tính';
        $startedStr = e($fmtTime($attempt->started_at));
        $submittedStr = e($fmtTime($attempt->submitted_at));
        $nowStr = e(now()->timezone('Asia/Ho_Chi_Minh')->format('H:i d/m/Y'));
        $proctorName = e($proctor->name);
        $chainBadge = $chain['ok']
            ? "Toàn vẹn chuỗi băm SHA-256 ({$chain['checked']} bản ghi hợp lệ)"
            : "CẢNH BÁO: Chuỗi băm đứt gãy tại bản ghi #{$chain['broken_at']}";

        $html = <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Biên bản phiên thi #{$attempt->id} - {$studentUsername}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Times, serif; color: #0f172a; line-height: 1.5; margin: 0; padding: 24px; background: #f8fafc; }
  .sheet { max-width: 860px; margin: 0 auto; background: #fff; padding: 36px 44px; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
  .toolbar { max-width: 860px; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center; font-family: system-ui, sans-serif; }
  .btn { background: #1d4ed8; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
  .btn-sec { background: #e2e8f0; color: #1e293b; }
  .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .header-table td { vertical-align: top; text-align: center; width: 50%; }
  h1 { text-align: center; font-size: 20px; text-transform: uppercase; margin: 16px 0 4px; }
  .sub { text-align: center; font-size: 13px; color: #475569; margin-bottom: 24px; font-style: italic; }
  .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
  .info-grid td { padding: 5px 8px; border-bottom: 1px dashed #e2e8f0; }
  .info-grid td.lbl { width: 170px; font-weight: bold; color: #334155; }
  table.violations { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; margin-bottom: 24px; }
  table.violations th, table.violations td { border: 1px solid #334155; padding: 7px 8px; vertical-align: top; }
  table.violations th { background: #f1f5f9; font-weight: bold; text-align: center; }
  .sign-table { width: 100%; border-collapse: collapse; margin-top: 32px; text-align: center; font-size: 14px; }
  .sign-table td { width: 50%; vertical-align: top; padding-bottom: 72px; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: none; box-shadow: none; padding: 0; max-width: 100%; }
    .toolbar { display: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span style="font-size:13px;color:#475569;">Biên bản điện tử trích xuất từ hệ thống Exam Guard (Phiên #{$attempt->id})</span>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-sec" onclick="window.close()">Đóng cửa sổ</button>
      <button class="btn" onclick="window.print()">In biên bản / Xuất PDF</button>
    </div>
  </div>
  <div class="sheet">
    <table class="header-table">
      <tr>
        <td>
          <div style="font-weight:bold;text-transform:uppercase;font-size:13px;">{$orgName}</div>
          <div style="font-size:13px;">HỘI ĐỒNG THI &amp; GIÁM SÁT TRỰC TUYẾN</div>
          <div style="margin-top:4px;font-size:12px;">Số: {$attempt->id}/BB-EG</div>
        </td>
        <td>
          <div style="font-weight:bold;text-transform:uppercase;font-size:13px;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div style="font-weight:bold;font-size:13px;text-decoration:underline;">Độc lập - Tự do - Hạnh phúc</div>
          <div style="margin-top:4px;font-size:12px;font-style:italic;">Lập lúc: {$nowStr}</div>
        </td>
      </tr>
    </table>

    <h1>BIÊN BẢN GHI NHẬN KẾT QUẢ VÀ VI PHẠM CA THI</h1>
    <div class="sub">Trích xuất từ Nhật ký Giám sát Khảo thí Điện tử (Exam Guard Proctoring System)</div>

    <table class="info-grid">
      <tr>
        <td class="lbl">Kỳ thi:</td>
        <td><strong>{$examTitle}</strong> (Mã phòng: <code>{$examCode}</code>)</td>
        <td class="lbl">Mã phiên thi:</td>
        <td>#{$attempt->id} (Lần thi thứ {$attempt->attempt_number})</td>
      </tr>
      <tr>
        <td class="lbl">Họ và tên thí sinh:</td>
        <td><strong>{$studentName}</strong></td>
        <td class="lbl">Mã số / Tài khoản:</td>
        <td><code>{$studentUsername}</code> ({$studentEmail})</td>
      </tr>
      <tr>
        <td class="lbl">Thời gian bắt đầu:</td>
        <td>{$startedStr}</td>
        <td class="lbl">Thời gian kết thúc:</td>
        <td>{$submittedStr}</td>
      </tr>
      <tr>
        <td class="lbl">Trạng thái phiên thi:</td>
        <td><strong>{$statusLabel}</strong></td>
        <td class="lbl">Điểm bài thi / Rủi ro:</td>
        <td>Điểm: <strong>{$scoreStr}</strong> · Điểm rủi ro: <strong>{$attempt->risk_score}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Thông tin thiết bị:</td>
        <td colspan="3">{$devSummary}</td>
      </tr>
      <tr>
        <td class="lbl">Tổng hợp giám sát:</td>
        <td colspan="3">
          Tổng cảnh báo: <strong>{$violations->count()}</strong>
          (Đã xác nhận vi phạm: <strong>{$confirmed->count()}</strong> · Chờ duyệt: <strong>{$pending->count()}</strong> · Đánh dấu báo nhầm: <strong>{$falsePos->count()}</strong>)
        </td>
      </tr>
      <tr>
        <td class="lbl">Xác thực toàn vẹn:</td>
        <td colspan="3" style="font-family:monospace;font-size:12px;">{$chainBadge}</td>
      </tr>
    </table>

    <div style="font-weight:bold;font-size:14px;margin-top:12px;">DANH SÁCH CHI TIẾT CÁC SỰ KIỆN VI PHẠM:</div>
    <table class="violations">
      <thead>
        <tr>
          <th style="width:40px;">STT</th>
          <th style="width:135px;">Thời điểm</th>
          <th style="width:190px;">Loại vi phạm</th>
          <th style="width:95px;">Mức độ</th>
          <th style="width:95px;">Trạng thái</th>
          <th>Mô tả chi tiết</th>
        </tr>
      </thead>
      <tbody>
        {$rowsHtml}
      </tbody>
    </table>

    <table class="sign-table">
      <tr>
        <td>
          <strong>THÍ SINH DỰ THI</strong><br>
          <span style="font-size:12px;font-style:italic;">(Ký và ghi rõ họ tên)</span>
        </td>
        <td>
          <strong>CÁN BỘ COI THI / GIẢNG VIÊN</strong><br>
          <span style="font-size:12px;font-style:italic;">(Ký và ghi rõ họ tên)</span>
        </td>
      </tr>
      <tr>
        <td><strong>{$studentName}</strong></td>
        <td><strong>{$proctorName}</strong></td>
      </tr>
    </table>
  </div>
</body>
</html>
HTML;

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    /** POST /admin/attempts/{id}/send-report — send the violation & exam report notification to the student (UC-T03). */
    public function sendReport(Request $request, int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);
        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:1000'],
            'only_confirmed' => ['nullable', 'boolean'],
        ]);

        $onlyConfirmed = (bool) ($validated['only_confirmed'] ?? false);
        $query = Violation::withoutGlobalScope('counted')
            ->where('exam_attempt_id', $attempt->id)
            ->where('is_false_positive', false)
            ->orderBy('timestamp');

        if ($onlyConfirmed) {
            $query->where('is_reviewed', true);
        }

        $violations = $query->get();
        $confirmedCount = $violations->where('is_reviewed', true)->count();

        $summaryLines = [];
        $summaryLines[] = "Kỳ thi: {$attempt->exam->title} ({$attempt->exam->code}) — Phiên #{$attempt->id}";
        $summaryLines[] = 'Trạng thái: ' . ($attempt->voided_at ? 'Đã hủy kết quả' : $attempt->status) . " · Điểm rủi ro: {$attempt->risk_score}";
        $summaryLines[] = "Tổng số vi phạm ghi nhận: {$violations->count()} (Đã xác nhận: {$confirmedCount}).";

        if ($violations->isNotEmpty()) {
            $topTypes = $violations->groupBy('violation_type')
                ->map(fn ($group, $type) => \App\Support\ViolationCatalog::label((string) $type) . ' (×' . $group->count() . ')')
                ->values()
                ->take(6)
                ->implode(', ');
            $summaryLines[] = "Chi tiết: {$topTypes}.";
        } else {
            $summaryLines[] = 'Không có vi phạm nào trong phiên thi này.';
        }

        if (!empty($validated['note'])) {
            $summaryLines[] = 'Nhận xét của giảng viên / giám thị: ' . trim($validated['note']);
        }

        $body = implode("\n", $summaryLines);

        \App\Models\UserNotification::create([
            'user_id' => $attempt->user_id,
            'type' => 'violation_report',
            'title' => "Biên bản giám sát ca thi: {$attempt->exam->title}",
            'body' => $body,
            'url' => "/attempts/{$attempt->id}",
        ]);

        // Also record in the attempt chat log so the student sees it immediately if still in the exam room
        \App\Models\AttemptMessage::create([
            'exam_attempt_id' => $attempt->id,
            'sender_id' => Auth::id(),
            'sender_role' => 'PROCTOR',
            'body' => "[BIÊN BẢN GIÁM SÁT] " . $body,
        ]);

        return back()->with('success', 'Đã gửi biên bản kết quả và vi phạm đến thí sinh.');
    }

    /** POST /admin/violations/bulk-review — one decision for many violations of the same organization. */
    public function bulkReview(Request $request)
    {
        $this->guardStaff();
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:2000'],
            'ids.*' => ['integer'],
            'decision' => ['required', 'in:confirmed,false_positive,pending'],
        ]);

        $violations = Violation::with('attempt.exam')->whereIn('id', $validated['ids'])->get();
        foreach ($violations->pluck('attempt.exam')->filter()->unique('id') as $exam) {
            $this->tenant->enforceOwnership($exam);
        }
        Violation::whereIn('id', $violations->pluck('id'))->update(match ($validated['decision']) {
            'confirmed' => ['is_reviewed' => true, 'is_false_positive' => false],
            'false_positive' => ['is_reviewed' => true, 'is_false_positive' => true],
            'pending' => ['is_reviewed' => false, 'is_false_positive' => false],
        });

        return back();
    }

    /** POST /admin/attempts/{id}/void — cancel (or restore) an attempt: kept, but out of scores and violation counts. */
    public function voidAttempt(Request $request, int $attemptId)
    {
        $this->guardStaff();
        $validated = $request->validate(['void' => ['required', 'boolean'], 'reason' => ['nullable', 'string', 'max:255']]);
        $attempt = $this->attemptOrFail($attemptId);
        $void = (bool) $validated['void'];

        if ($void && $attempt->status === 'IN_PROGRESS') {
            $attempt->status = 'FORCE_ENDED';
            $attempt->submitted_at = now();
        }
        $attempt->voided_at = $void ? now() : null;
        $attempt->void_reason = $void ? ($validated['reason'] ?? null) : null;
        $attempt->save();
        Violation::withoutGlobalScope('counted')->where('exam_attempt_id', $attempt->id)->update(['voided' => $void]);
        if ($void) {
            app(Realtime::class)->lifecycle($attempt, 'force_ended');
        }

        return back()->with('success', $void ? 'Đã hủy phiên thi.' : 'Đã khôi phục phiên thi.');
    }

    /** POST /admin/violations/{id}/review — confirmed | false_positive | pending. */
    public function review(Request $request, int $violationId)
    {
        $this->guardStaff();
        $validated = $request->validate([
            'decision' => ['required', 'in:confirmed,false_positive,pending'],
        ]);

        $violation = Violation::with('attempt.exam')->findOrFail($violationId);
        abort_unless($violation->attempt?->exam, 404);
        $this->tenant->enforceOwnership($violation->attempt->exam);

        $violation->update(match ($validated['decision']) {
            'confirmed' => ['is_reviewed' => true, 'is_false_positive' => false],
            'false_positive' => ['is_reviewed' => true, 'is_false_positive' => true],
            'pending' => ['is_reviewed' => false, 'is_false_positive' => false],
        });

        return back();
    }

    /** /admin/attempts/{id}/submissions — code, verdicts and Op-Log stats. */
    public function submissions(int $attemptId)
    {
        $this->guardStaff();
        $attempt = $this->attemptOrFail($attemptId);
        $exam = $attempt->exam->load('questionSet.programmingProblems:id,question_set_id,title,difficulty,time_limit_ms,memory_limit_mb');

        $problems = ($exam->questionSet?->programmingProblems ?? collect())->values()->map(fn ($p, $i) => [
            'id' => $p->id,
            'code' => 'P' . ($i + 1),
            'title' => $p->title,
            'difficulty' => $p->difficulty,
            'time_limit_ms' => $p->time_limit_ms,
            'memory_limit_mb' => $p->memory_limit_mb,
        ]);

        $submissions = Submission::where('exam_attempt_id', $attempt->id)
            ->orderByDesc('submitted_at')
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'problem_id' => $s->programming_problem_id,
                'language' => $s->language,
                'source_code' => $s->source_code,
                'passed' => (int) $s->passed_cases_count,
                'total' => (int) $s->total_cases_count,
                'score' => (float) $s->score,
                'status' => $s->status,
                'grading_details' => $s->grading_details,
                'submitted_at' => $s->submitted_at?->toIso8601String(),
            ]);

        $opStats = EditOpLog::where('exam_attempt_id', $attempt->id)
            ->selectRaw('programming_problem_id, sum(keystroke_count) as keys, sum(paste_event_count) as pastes, min(created_at) as first_at, max(created_at) as last_at')
            ->groupBy('programming_problem_id')
            ->get()
            ->mapWithKeys(fn ($r) => [$r->programming_problem_id => [
                'keys' => (int) $r->keys,
                'pastes' => (int) $r->pastes,
                'first_at' => $r->first_at ? \Illuminate\Support\Carbon::parse($r->first_at)->toIso8601String() : null,
                'last_at' => $r->last_at ? \Illuminate\Support\Carbon::parse($r->last_at)->toIso8601String() : null,
            ]]);

        $pasteViolations = Violation::where('exam_attempt_id', $attempt->id)
            ->where('violation_type', 'BULK_PASTE')
            ->orderBy('timestamp')
            ->get(['id', 'details', 'timestamp'])
            ->map(fn ($v) => ['id' => $v->id, 'details' => $v->details, 'timestamp' => $v->timestamp?->toIso8601String()]);

        return Inertia::render('Admin/Attempts/Submissions', [
            ...$this->layoutProps(),
            'attempt' => $this->attemptPayload($attempt),
            'problems' => $problems,
            'submissions' => $submissions,
            'opStats' => $opStats,
            'pasteViolations' => $pasteViolations,
        ]);
    }

    /** Other candidates of the same exam that started from the same machine (same hashed machine id). */
    private function sharedDevice(ExamAttempt $attempt): array
    {
        $fp = $attempt->device_info['fingerprint'] ?? null;
        if (!$fp) {
            return [];
        }

        return ExamAttempt::with('user:id,name,username')->where('exam_id', $attempt->exam_id)->where('user_id', '!=', $attempt->user_id)
            ->where('device_info->fingerprint', $fp)->get()
            ->map(fn ($a) => ['attempt_id' => $a->id, 'name' => $a->user?->name, 'username' => $a->user?->username])->unique('username')->values()->all();
    }

    private function attemptPayload(ExamAttempt $attempt): array
    {
        return [
            'id' => $attempt->id,
            'attempt_number' => $attempt->attempt_number,
            'status' => $attempt->status,
            'score' => $attempt->score,
            'risk_score' => (int) $attempt->risk_score,
            'is_flagged' => (bool) $attempt->is_flagged,
            'voided_at' => $attempt->voided_at?->toIso8601String(),
            'void_reason' => $attempt->void_reason,
            'started_at' => $attempt->started_at?->toIso8601String(),
            'submitted_at' => $attempt->submitted_at?->toIso8601String(),
            'device_info' => $attempt->device_info,
            'shared_device_with' => $this->sharedDevice($attempt),
            'pending_grading' => \App\Models\ExamAttemptAnswer::where('exam_attempt_id', $attempt->id)->whereNull('is_correct')
                ->whereHas('question', fn ($q) => $q->whereIn('type', \App\Http\Controllers\Admin\GradingController::MANUAL))->count(),
            'user' => [
                'id' => $attempt->user?->id,
                'name' => $attempt->user?->name ?? 'Thí sinh',
                'username' => $attempt->user?->username ?? '',
                'email' => $attempt->user?->email,
                'has_face_photo' => $attempt->user ? \App\Support\FaceReference::has($attempt->user) : false,
            ],
            'exam' => [
                'id' => $attempt->exam->id,
                'title' => $attempt->exam->title,
                'code' => $attempt->exam->code,
                'type' => $attempt->exam->type,
                'duration_minutes' => $attempt->exam->duration_minutes,
                'monitoring_config' => $attempt->exam->monitoring_config,
            ],
        ];
    }
}
