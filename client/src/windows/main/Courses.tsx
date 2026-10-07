import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, FileText, Search, Timer, User } from "lucide-react";
import { Button, Card, Empty, Input, cx } from "../../components/ui";
import { examState, fmtDateTime, fromNow, type PageProps } from "./shared";
import { ExamTable } from "./Exams";

type Filter = "all" | "has-exam" | "done";

export default function Courses(props: PageProps) {
  const { data, loading } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const examsByCourse = useMemo(() => {
    const m = new Map<number, typeof data.exams>();
    for (const e of data.exams) m.set(e.course.id, [...(m.get(e.course.id) ?? []), e]);
    return m;
  }, [data.exams]);

  const courseOpen = (id: number) => (examsByCourse.get(id) ?? []).some((e) => ["open", "in_progress", "upcoming"].includes(examState(e)));
  const courseDone = (id: number) => {
    const list = examsByCourse.get(id) ?? [];
    return list.length > 0 && list.every((e) => examState(e) === "done");
  };

  const q = query.trim().toLowerCase();
  const list = data.courses.filter((c) => {
    if (q && !`${c.name} ${c.code} ${c.teacher?.name ?? ""}`.toLowerCase().includes(q)) return false;
    if (filter === "has-exam") return courseOpen(c.id);
    if (filter === "done") return courseDone(c.id);
    return true;
  });

  const opened = data.courses.find((c) => c.id === openId);
  if (opened) {
    const exams = examsByCourse.get(opened.id) ?? [];
    return (
      <div className="space-y-4 px-6 py-5">
        <button type="button" onClick={() => setOpenId(null)} className="flex items-center gap-1 text-xs text-muted hover:text-fg">
          <ArrowLeft size={13} /> Khoá học
        </button>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <BookOpen size={18} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-fg">{opened.name}</h2>
            <p className="text-xs text-muted">
              {opened.code} · {opened.teacher?.name ?? "Chưa phân công giảng viên"}
              {opened.enrolled_at && ` · ghi danh ${fmtDateTime(opened.enrolled_at)}`}
            </p>
          </div>
        </div>
        {opened.description && <p className="selectable max-w-3xl text-[13px] leading-relaxed text-muted">{opened.description}</p>}
        <Card>
          <ExamTable {...props} exams={exams} hideCourse />
        </Card>
      </div>
    );
  }

  const withExam = data.courses.filter((c) => courseOpen(c.id)).length;
  const done = data.courses.filter((c) => courseDone(c.id)).length;

  return (
    <div className="space-y-4 px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">Khoá học của tôi</h2>
          <p className="mt-0.5 text-xs text-muted">
            {data.courses.length} khoá học · {data.exams.length} bài thi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input icon={<Search size={14} />} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm khoá học" className="h-8 w-52" />
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            Tất cả · {data.courses.length}
          </Chip>
          <Chip active={filter === "has-exam"} onClick={() => setFilter("has-exam")}>
            Có bài thi · {withExam}
          </Chip>
          <Chip active={filter === "done"} onClick={() => setFilter("done")}>
            Đã hoàn thành · {done}
          </Chip>
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty icon={<BookOpen size={18} />} text={loading ? "Đang tải…" : "Không có khoá học nào."} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const exams = examsByCourse.get(c.id) ?? [];
            const next = exams
              .filter((e) => ["in_progress", "open", "upcoming"].includes(examState(e)))
              .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))[0];
            const hot = next && examState(next) !== "upcoming";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className="flex flex-col rounded-xl border border-line bg-surface p-4 text-left transition hover:border-line-strong hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", hot ? "bg-accent-soft text-accent" : "bg-surface-3 text-muted")}>
                    <BookOpen size={15} />
                  </span>
                  <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">{c.code}</span>
                </div>
                <p className="mt-3 text-[13px] font-semibold text-fg">{c.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                  <User size={11} /> {c.teacher?.name ?? "Chưa phân công"}
                </p>
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
                  <FileText size={11} /> {c.exams_count} bài thi
                </p>
                <div
                  className={cx(
                    "mt-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px]",
                    hot ? "border-accent/30 bg-accent-soft font-medium text-accent-fg" : "border-line bg-surface-2 text-muted",
                  )}
                >
                  {next ? (
                    <>
                      {hot ? <Timer size={12} /> : <CalendarDays size={12} />}
                      <span className="truncate">
                        {next.title} · {hot ? "đang mở" : fromNow(next.start_time)}
                      </span>
                    </>
                  ) : (
                    <>
                      <CalendarDays size={12} /> Chưa có bài thi mới
                    </>
                  )}
                  <ChevronRight size={12} className="ml-auto shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant={active ? "dark" : "secondary"} className="rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}
