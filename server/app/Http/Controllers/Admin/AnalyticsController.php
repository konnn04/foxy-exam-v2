<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Services\TenantContext;
use App\Support\Audit;
use App\Support\Semester;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/** Exam reports of the ACTIVE school, grouped by department (course.department) and by semester (derived from the exam date). */
class AnalyticsController extends Controller
{
    private function guard(): TenantContext
    {
        $tenant = app(TenantContext::class);
        abort_unless($tenant->capabilities()['orgSettings'], 403, 'Chỉ quản trị viên của trường mới xem được báo cáo.');

        return $tenant;
    }

    /** One row per exam with its attempt and violation numbers. */
    private function examRows(int $orgId): Collection
    {
        $exams = Exam::where('organization_id', $orgId)->with('course:id,code,name,department')
            ->get(['id', 'course_id', 'title', 'code', 'status', 'start_time', 'created_at']);

        $att = DB::table('exam_attempts')->whereIn('exam_id', $exams->pluck('id'))
            ->where('status', '!=', 'NOT_STARTED')->whereNull('voided_at')
            ->groupBy('exam_id')
            ->selectRaw("exam_id, count(*) attempts, sum(case when status = 'FORCE_ENDED' then 1 else 0 end) force_ended, sum(case when is_flagged then 1 else 0 end) flagged, avg(case when status = 'SUBMITTED' then score end) avg_score")
            ->get()->keyBy('exam_id');

        $vio = DB::table('violations')->join('exam_attempts', 'exam_attempts.id', '=', 'violations.exam_attempt_id')
            ->whereIn('exam_attempts.exam_id', $exams->pluck('id'))->whereNull('exam_attempts.voided_at')->where('violations.voided', false)
            ->groupBy('exam_attempts.exam_id')
            ->selectRaw('exam_attempts.exam_id as exam_id, sum(case when violations.is_false_positive then 0 else 1 end) real_count, sum(case when violations.is_false_positive then 1 else 0 end) false_count')
            ->get()->keyBy('exam_id');

        return $exams->map(function (Exam $e) use ($att, $vio) {
            $a = $att[$e->id] ?? null;
            $v = $vio[$e->id] ?? null;
            $date = $e->start_time ?? $e->created_at;

            return [
                'id' => $e->id, 'title' => $e->title, 'code' => $e->code, 'course' => $e->course?->code,
                'department' => $e->course?->department ?: 'Chưa phân khoa', 'semester' => Semester::of($date),
                'date' => $date?->format('Y-m-d'), 'attempts' => (int) ($a->attempts ?? 0), 'force_ended' => (int) ($a->force_ended ?? 0),
                'flagged' => (int) ($a->flagged ?? 0), 'avg_score' => isset($a->avg_score) ? round((float) $a->avg_score, 2) : null,
                'violations' => (int) ($v->real_count ?? 0), 'false_positives' => (int) ($v->false_count ?? 0),
            ];
        });
    }

    /** @param Collection<int, array<string,mixed>> $rows */
    private static function group(Collection $rows, string $key): array
    {
        return $rows->groupBy($key)->map(function (Collection $g, string $name) use ($key) {
            $attempts = $g->sum('attempts');
            $scored = $g->filter(fn ($r) => $r['avg_score'] !== null && $r['attempts'] > 0);
            $weight = $scored->sum('attempts');

            return [
                'name' => $name, 'exams' => $g->count(), 'attempts' => $attempts,
                'avg_score' => $weight ? round($scored->sum(fn ($r) => $r['avg_score'] * $r['attempts']) / $weight, 2) : null,
                'violations' => $g->sum('violations'),
                'violations_per_attempt' => $attempts ? round($g->sum('violations') / $attempts, 2) : 0,
                'force_ended' => $g->sum('force_ended'),
                'flagged_rate' => $attempts ? round($g->sum('flagged') / $attempts * 100, 1) : 0,
            ];
        })->sortBy($key === 'semester' ? 'name' : fn ($r) => -$r['attempts'])->values()->all();
    }

    private function filtered(Request $request, int $orgId): array
    {
        $all = $this->examRows($orgId);
        $semester = (string) $request->query('semester', '');
        $department = (string) $request->query('department', '');
        $rows = $all
            ->when($semester !== '', fn ($c) => $c->where('semester', $semester))
            ->when($department !== '', fn ($c) => $c->where('department', $department))
            ->values();

        return [$all, $rows, $semester, $department];
    }

    public function index(Request $request)
    {
        $tenant = $this->guard();
        [$all, $rows, $semester, $department] = $this->filtered($request, $tenant->id());
        $u = Auth::user();

        $examIds = $rows->pluck('id');
        $types = DB::table('violations')->join('exam_attempts', 'exam_attempts.id', '=', 'violations.exam_attempt_id')
            ->whereIn('exam_attempts.exam_id', $examIds)->where('violations.is_false_positive', false)->where('violations.voided', false)->whereNull('exam_attempts.voided_at')
            ->groupBy('violations.violation_type')->selectRaw('violations.violation_type as type, count(*) as n')
            ->orderByDesc('n')->limit(8)->get();

        $attempts = $rows->sum('attempts');

        return Inertia::render('Admin/Analytics/Index', [
            'user' => ['id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'email' => $u->email, 'role' => $u->role],
            'teams' => [],
            'filters' => ['semester' => $semester, 'department' => $department],
            'options' => [
                'semesters' => $all->pluck('semester')->unique()->sort()->values(),
                'departments' => $all->pluck('department')->unique()->sort()->values(),
            ],
            'totals' => [
                'exams' => $rows->count(), 'attempts' => $attempts, 'violations' => $rows->sum('violations'),
                'force_ended' => $rows->sum('force_ended'),
                'false_positives' => $rows->sum('false_positives'),
                'violations_per_attempt' => $attempts ? round($rows->sum('violations') / $attempts, 2) : 0,
            ],
            'byDepartment' => self::group($rows, 'department'),
            'bySemester' => self::group($rows, 'semester'),
            'byType' => $types,
            'topExams' => $rows->sortByDesc('violations')->take(8)->values(),
        ]);
    }

    /** CSV with a BOM so Excel opens the Vietnamese text correctly. */
    public function export(Request $request)
    {
        $tenant = $this->guard();
        [, $rows] = $this->filtered($request, $tenant->id());
        Audit::record('report.export', 'Xuất báo cáo kỳ thi (CSV)', null, null, ['rows' => $rows->count()]);

        $name = 'bao-cao-ky-thi-' . now()->format('Ymd') . '.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Học kỳ', 'Khoa/Bộ môn', 'Mã khóa học', 'Kỳ thi', 'Mã phòng thi', 'Ngày', 'Lượt thi', 'Điểm TB', 'Vi phạm', 'Báo nhầm', 'Bị đình chỉ', 'Bị gắn cờ']);
            foreach ($rows as $r) {
                // a spreadsheet would run a cell starting with = + - @ as a formula
                $safe = fn ($v) => is_string($v) && $v !== '' && str_contains('=+-@', $v[0]) ? "'" . $v : $v;
                fputcsv($out, [$r['semester'], $safe($r['department']), $r['course'], $safe($r['title']), $r['code'], $r['date'], $r['attempts'], $r['avg_score'], $r['violations'], $r['false_positives'], $r['force_ended'], $r['flagged']]);
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
