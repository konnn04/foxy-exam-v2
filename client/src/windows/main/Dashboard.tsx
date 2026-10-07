import { Activity, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock, FileText, Monitor, Play, PlayCircle, Timer } from "lucide-react";
import { Button, Card, CardHeader, Empty, cx } from "../../components/ui";
import { examState, fmtDate, fmtScore, fmtTime, fromNow, KIND_LABEL, KindIcon, type PageProps } from "./shared";

export default function Dashboard({ data, loading, startingId, onStart, onNavigate, device }: PageProps) {
  const name = data.me?.name ?? "";
  const stats = data.dashboard?.statistics;

  const inProgress = data.exams.find((e) => examState(e) === "in_progress");
  const upcoming = data.exams
    .filter((e) => ["open", "upcoming"].includes(examState(e)))
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .slice(0, 6);
  const openCount = data.exams.filter((e) => examState(e) === "open").length;

  return (
    <div className="space-y-5 px-6 py-5">
      {inProgress && (
        <div className="overflow-hidden rounded-xl border border-danger/40">
          <div className="flex items-center gap-2 bg-danger px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white live-dot" /> Phiên thi đang diễn ra
          </div>
          <div className="flex items-center gap-4 bg-danger-soft px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-danger">{inProgress.title}</p>
              <p className="text-xs text-muted">
                {inProgress.course.name} · bắt đầu lúc {fmtTime(inProgress.latest_attempt?.started_at ?? null)} · thời gian vẫn đang được tính
              </p>
            </div>
            <Button variant="danger" icon={<Play size={13} />} loading={startingId === inProgress.id} onClick={() => onStart(inProgress)}>
              Tiếp tục làm bài
            </Button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-fg">
          Xin chào{name && ", "}
          <span className="text-accent">{name}</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          {openCount > 0
            ? `Bạn có ${openCount} bài thi đang mở. Kiểm tra thiết bị trước khi vào phòng thi.`
            : "Hiện chưa có bài thi nào đang mở."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<BookOpen size={15} />} value={stats?.total_courses} label="Khoá học" hint="Đang ghi danh" />
        <Stat icon={<FileText size={15} />} value={stats?.total_exams} label="Tổng bài thi" hint={`${openCount} bài đang mở`} />
        <Stat icon={<Timer size={15} />} value={stats?.in_progress_attempts} label="Đang làm dở" hint="Lượt thi chưa nộp" />
        <Stat icon={<CheckCircle2 size={15} />} value={stats?.completed_attempts} label="Đã nộp" hint="Lượt thi đã hoàn thành" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            icon={<CalendarDays size={15} />}
            title="Bài thi sắp tới"
            right={
              <button type="button" onClick={() => onNavigate("exams")} className="flex items-center gap-0.5 text-xs text-muted hover:text-fg">
                Xem tất cả <ChevronRight size={13} />
              </button>
            }
          />
          {upcoming.length === 0 ? (
            <Empty icon={<CalendarDays size={18} />} text={loading ? "Đang tải…" : "Chưa có bài thi sắp tới."} />
          ) : (
            <ul>
              {upcoming.map((e) => {
                const state = examState(e);
                return (
                  <li key={e.id} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
                    <div className="w-14 shrink-0 border-r border-line pr-3 text-right">
                      <p className="text-[11px] text-muted">{fmtDate(e.start_time)}</p>
                      <p className="font-mono text-[15px] font-semibold text-fg">{fmtTime(e.start_time)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-fg">{e.title}</p>
                      <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted">
                        <span className="flex items-center gap-1">
                          <BookOpen size={11} /> {e.course.code}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {e.duration_minutes} phút
                        </span>
                        <span className="flex items-center gap-1">
                          <KindIcon kind={e.type} size={11} /> {KIND_LABEL[e.type]}
                        </span>
                      </p>
                    </div>
                    {state === "open" ? (
                      <Button size="sm" variant="primary" loading={startingId === e.id} disabled={startingId !== null} onClick={() => onStart(e)}>
                        Vào thi
                      </Button>
                    ) : (
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-muted">{fromNow(e.start_time)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={<Activity size={15} />} title="Hoạt động gần đây" />
          {!data.dashboard || data.dashboard.recent_attempts.length === 0 ? (
            <Empty icon={<Activity size={18} />} text={loading ? "Đang tải…" : "Chưa có hoạt động."} />
          ) : (
            <ul className="flex-1 space-y-1 p-3">
              {data.dashboard.recent_attempts.map((a) => {
                const done = a.status !== "IN_PROGRESS";
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-lg px-1.5 py-1.5">
                    <span
                      className={cx(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                        done ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                      )}
                    >
                      {done ? <CheckCircle2 size={13} /> : <PlayCircle size={13} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-fg">
                        {done ? "Đã nộp" : "Đang làm"} {a.exam_title}
                      </p>
                      <p className="text-[11px] text-muted">
                        {fromNow(a.submitted_at ?? a.started_at)} · {a.course_name}
                        {a.score != null && ` · ${fmtScore(a.score)} điểm`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {device.displays > 1 && (
            <div className="m-3 flex items-center gap-2 rounded-lg border border-dashed border-warning/50 bg-warning-soft px-3 py-2 text-xs text-warning">
              <Monitor size={14} /> Phát hiện {device.displays} màn hình. Hãy ngắt màn hình phụ trước khi vào phòng thi.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, hint }: { icon: React.ReactNode; value?: number; label: string; hint: string }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted">{icon}</span>
      <div>
        <p className="text-2xl font-semibold leading-none text-fg">{value ?? "—"}</p>
        <p className="mt-1.5 text-[13px] font-medium text-fg">{label}</p>
        <p className="text-[11px] text-muted">{hint}</p>
      </div>
    </Card>
  );
}
