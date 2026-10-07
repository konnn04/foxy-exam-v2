import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenText, Check, ChevronLeft, ChevronRight, Flag, LayoutGrid, Loader2, Save } from "lucide-react";
import { ConfirmModal, ExamShell } from "../components/ExamShell";
import { Badge, Button, cx } from "../components/ui";
import { AppWindow, onWindowShown, switchWindow } from "../lib/windowNav";
import { clearSession, getSession, type Session } from "../lib/session";
import { useExamGuard } from "../lib/examGuard";
import {
  ApiError,
  finishExam,
  saveQuestionAnswer,
  submitExamAttempt,
  takeExam,
  type ClassicalQuestionItem,
  type QuestionType,
} from "../lib/api";

interface AnswerState {
  answerId?: number | null;
  selectedAnswerIds?: number[];
  answerContent?: string;
}

const TYPE_META: Record<QuestionType, { label: string; tone: "info" | "accent" | "warning" | "success" | "neutral" }> = {
  SINGLE_CHOICE: { label: "Trắc nghiệm", tone: "info" },
  MULTIPLE_CHOICE: { label: "Nhiều đáp án", tone: "accent" },
  SHORT_ANSWER: { label: "Trả lời ngắn", tone: "warning" },
  ESSAY: { label: "Tự luận", tone: "success" },
  GROUP_QUESTION: { label: "Đoạn đọc", tone: "neutral" },
};

const isTyping = (el: EventTarget | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Cửa sổ thi trắc nghiệm / tự luận (protect content). Tải đề mỗi khi được hiện
 * bởi `switchWindow` và lượt thi khác lần trước (cửa sổ được tạo trước khi đăng
 * nhập nên không thể tải lúc mount). Đáp án tự lưu lên server sau 400ms.
 */
export default function ExamClassic() {
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [questions, setQuestions] = useState<ClassicalQuestionItem[]>([]);
  const [monitoring, setMonitoring] = useState<Session["exam"]["monitoring_config"] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [showGrid, setShowGrid] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const saveTimers = useRef<Record<number, number>>({});
  const loadedAttempt = useRef<number | null>(null);

  const guard = useExamGuard(monitoring);

  // Chỉ tính câu có thể trả lời (bỏ đoạn đọc gốc của nhóm câu hỏi).
  const answerable = questions.filter((q) => q.type !== "GROUP_QUESTION");

  const load = useCallback(
    (force = false) => {
      const s = getSession();
      setSession(s);
      if (!s) {
        setLoading(false);
        return;
      }
      if (!force && loadedAttempt.current === s.attemptId) return;
      loadedAttempt.current = s.attemptId;

      setLoading(true);
      setLoadError(null);
      setIndex(0);
      setAnswers({});
      setFlags(new Set());
      setMonitoring(s.exam.monitoring_config);
      takeExam(s.exam.id, s.attemptId)
        .then((res) => {
          const qs = res.data.questions ?? [];
          setQuestions(qs);
          const initial: Record<number, AnswerState> = {};
          for (const q of qs) {
            if (q.saved_answer) {
              initial[q.id] = {
                answerId: q.saved_answer.answer_id ?? null,
                selectedAnswerIds: q.saved_answer.selected_answer_ids ?? [],
                answerContent: q.saved_answer.answer_content ?? "",
              };
            }
          }
          setAnswers(initial);
          setTimeRemaining(typeof res.data.time_remaining_seconds === "number" ? res.data.time_remaining_seconds : null);
          void guard.start();
        })
        .catch((err) => {
          loadedAttempt.current = null;
          setLoadError(err instanceof ApiError ? err.message : "Không tải được đề thi.");
        })
        .finally(() => setLoading(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => onWindowShown(() => load()), [load]);

  useEffect(() => {
    const t = window.setInterval(() => setTimeRemaining((p) => (p === null ? p : Math.max(0, p - 1))), 1000);
    return () => window.clearInterval(t);
  }, []);

  const current = questions[index];
  const parent = current?.parent_id ? questions.find((q) => q.id === current.parent_id) : null;

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(questions.length - 1, i))), [questions.length]);
  const toggleFlag = useCallback(
    () =>
      current &&
      setFlags((prev) => {
        const next = new Set(prev);
        if (next.has(current.id)) next.delete(current.id);
        else next.add(current.id);
        return next;
      }),
    [current],
  );

  // Phím tắt: Alt+← / Alt+→ chuyển câu, F đánh dấu (khi không gõ chữ).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && e.key === "ArrowLeft") go(index - 1);
      else if (e.altKey && e.key === "ArrowRight") go(index + 1);
      else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.altKey && !isTyping(e.target)) toggleFlag();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, toggleFlag]);

  function update(questionId: number, next: AnswerState) {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    if (!session) return;
    setSaveState("saving");
    window.clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = window.setTimeout(() => {
      saveQuestionAnswer({
        examId: session.exam.id,
        attemptId: session.attemptId,
        questionId,
        answerId: next.answerId,
        selectedAnswerIds: next.selectedAnswerIds,
        answerContent: next.answerContent || undefined,
      })
        .then(() => {
          setSaveState("idle");
          setSavedAt(new Date().toLocaleTimeString("vi-VN"));
        })
        .catch(() => setSaveState("error"));
    }, 400);
  }

  const isAnswered = (q: ClassicalQuestionItem) => {
    const a = answers[q.id];
    if (!a) return false;
    if (q.type === "SINGLE_CHOICE") return typeof a.answerId === "number";
    if (q.type === "MULTIPLE_CHOICE") return (a.selectedAnswerIds?.length ?? 0) > 0;
    return Boolean(a.answerContent?.trim());
  };
  const answeredCount = answerable.filter(isAnswered).length;

  async function leave() {
    await guard.stop();
    await switchWindow(AppWindow.Main);
  }

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitExamAttempt(session.exam.id, session.attemptId);
      await finishExam().catch(() => {});
      clearSession();
      setShowSubmit(false);
      await leave();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Nộp bài thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session || loading || loadError || questions.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-app text-sm text-muted">
        {loading && session ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Đang tải đề thi…
          </>
        ) : (
          <>
            <p className={loadError ? "text-danger" : ""}>
              {loadError ?? (session ? "Đề thi chưa có câu hỏi nào." : "Chưa chọn kỳ thi.")}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => void leave()}>Về trang chủ</Button>
              {loadError && (
                <Button variant="primary" onClick={() => load(true)}>
                  Thử lại
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  const meta = TYPE_META[current.type];
  const a = answers[current.id] ?? {};
  const progress = answerable.length ? (answeredCount / answerable.length) * 100 : 0;

  return (
    <>
      <ExamShell
        title={session.exam.title}
        subtitle={`${session.exam.code} · Lần thi #${session.attemptNumber}`}
        remainingSeconds={timeRemaining}
        onSubmit={() => setShowSubmit(true)}
        guard={guard}
        toolbar={
          <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-5 text-xs">
            <span className="font-medium text-fg">
              Câu {index + 1} / {questions.length}
            </span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-muted">
              {answeredCount}/{answerable.length} đã trả lời
            </span>
            <div className="ml-2 flex items-center gap-1 overflow-x-auto">
              <PagerButton onClick={() => go(index - 1)} disabled={index === 0}>
                <ChevronLeft size={13} />
              </PagerButton>
              {questions.map((q, i) => (
                <PagerButton key={q.id} onClick={() => go(i)} active={i === index} done={isAnswered(q)} flagged={flags.has(q.id)}>
                  {i + 1}
                </PagerButton>
              ))}
              <PagerButton onClick={() => go(index + 1)} disabled={index === questions.length - 1}>
                <ChevronRight size={13} />
              </PagerButton>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" icon={<LayoutGrid size={13} />} onClick={() => setShowGrid((v) => !v)}>
                Danh sách câu
              </Button>
              <Button
                size="sm"
                icon={<Flag size={13} />}
                onClick={toggleFlag}
                className={flags.has(current.id) ? "border-warning/50 bg-warning-soft text-warning" : ""}
              >
                {flags.has(current.id) ? "Đã đánh dấu" : "Đánh dấu"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1">
          {showGrid && (
            <aside className="w-56 shrink-0 overflow-y-auto border-r border-line bg-surface p-3">
              <div className="grid grid-cols-4 gap-1.5">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => go(i)}
                    className={cx(
                      "relative flex h-10 flex-col items-center justify-center rounded-lg border font-mono text-xs",
                      i === index
                        ? "border-accent bg-accent text-white"
                        : isAnswered(q)
                          ? "border-success/40 bg-success-soft text-success"
                          : "border-line text-muted hover:bg-surface-3",
                    )}
                  >
                    {i + 1}
                    <span className="font-sans text-[8px] opacity-70">{TYPE_META[q.type].label.split(" ")[0]}</span>
                    {flags.has(q.id) && <Flag size={9} className="absolute right-1 top-1 text-warning" />}
                  </button>
                ))}
              </div>
            </aside>
          )}

          <main className="min-w-0 flex-1 overflow-y-auto bg-app">
            <div className="selectable mx-auto max-w-3xl px-8 py-7">
              {parent && (
                <div className="mb-5 rounded-xl border border-line bg-surface p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                    <BookOpenText size={12} /> Đoạn đọc dùng chung
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg/90">{parent.content}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                {!!current.points && <span className="text-[11px] text-muted">{current.points} điểm</span>}
                {current.type === "MULTIPLE_CHOICE" && <span className="text-[11px] text-muted">· chọn nhiều đáp án</span>}
              </div>
              <h2 className="mt-3 text-[13px] font-semibold text-accent-fg">Câu {index + 1}</h2>
              <p className="mt-1 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-fg">{current.content}</p>

              <div className="mt-5">
                {current.type === "SINGLE_CHOICE" && (
                  <div className="space-y-2">
                    {current.options.map((opt, i) => (
                      <Option
                        key={opt.id}
                        selected={a.answerId === opt.id}
                        marker={String.fromCharCode(65 + i)}
                        round
                        onClick={() => update(current.id, { ...a, answerId: opt.id })}
                      >
                        {opt.content}
                      </Option>
                    ))}
                  </div>
                )}

                {current.type === "MULTIPLE_CHOICE" && (
                  <div className="space-y-2">
                    {current.options.map((opt, i) => {
                      const list = a.selectedAnswerIds ?? [];
                      const on = list.includes(opt.id);
                      return (
                        <Option
                          key={opt.id}
                          selected={on}
                          marker={on ? <Check size={12} /> : String.fromCharCode(65 + i)}
                          onClick={() =>
                            update(current.id, {
                              ...a,
                              selectedAnswerIds: on ? list.filter((x) => x !== opt.id) : [...list, opt.id],
                            })
                          }
                        >
                          {opt.content}
                        </Option>
                      );
                    })}
                  </div>
                )}

                {current.type === "SHORT_ANSWER" && (
                  <input
                    value={a.answerContent ?? ""}
                    onChange={(e) => update(current.id, { ...a, answerContent: e.target.value })}
                    onPaste={guard.onPaste}
                    placeholder="Nhập đáp án ngắn gọn…"
                    className="h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-sm text-fg outline-none focus:border-fg/60 focus:ring-2 focus:ring-fg/10"
                  />
                )}

                {current.type === "ESSAY" && (
                  <div className="overflow-hidden rounded-xl border border-line-strong bg-surface focus-within:border-fg/60">
                    <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[11px] text-subtle">
                      <span>Dán từ ngoài bị giới hạn</span>
                      <span className="font-mono">{wordCount(a.answerContent ?? "")} từ</span>
                    </div>
                    <textarea
                      rows={12}
                      value={a.answerContent ?? ""}
                      onChange={(e) => update(current.id, { ...a, answerContent: e.target.value })}
                      onPaste={guard.onPaste}
                      placeholder="Trình bày bài làm của bạn…"
                      className="w-full resize-y bg-transparent p-4 text-sm leading-relaxed text-fg outline-none"
                    />
                  </div>
                )}

                {current.type === "GROUP_QUESTION" && (
                  <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-xs text-muted">
                    Đây là đoạn đọc gốc — chuyển sang các câu tiếp theo để trả lời câu hỏi liên quan.
                  </p>
                )}
              </div>
            </div>
          </main>
        </div>

        <div className="flex h-12 shrink-0 items-center gap-3 border-t border-line bg-surface px-5">
          <Button icon={<ChevronLeft size={14} />} onClick={() => go(index - 1)} disabled={index === 0}>
            Câu trước
          </Button>
          <span className="mx-auto flex items-center gap-3 text-[11px] text-subtle">
            <span className={cx("flex items-center gap-1", saveState === "error" && "text-danger")}>
              <Save size={12} />
              {saveState === "saving" ? "Đang lưu…" : saveState === "error" ? "Lỗi lưu — kiểm tra mạng" : savedAt ? `Đã lưu ${savedAt}` : "Tự lưu khi trả lời"}
            </span>
            · Alt+← → chuyển câu · F đánh dấu
          </span>
          <Button variant="primary" onClick={() => go(index + 1)} disabled={index === questions.length - 1}>
            Câu sau <ChevronRight size={14} />
          </Button>
        </div>
      </ExamShell>

      {showSubmit && (
        <ConfirmModal
          title="Xác nhận nộp bài"
          confirmLabel="Nộp bài"
          busy={submitting}
          onCancel={() => (setShowSubmit(false), setSubmitError(null))}
          onConfirm={() => void handleSubmit()}
        >
          Bạn đã trả lời <b className="text-fg">{answeredCount}</b> / {answerable.length} câu.
          {answeredCount < answerable.length && (
            <span className="mt-1 block text-warning">Còn {answerable.length - answeredCount} câu chưa trả lời.</span>
          )}
          {flags.size > 0 && <span className="mt-1 block">Có {flags.size} câu đang đánh dấu xem lại.</span>}
          {saveState === "error" && <span className="mt-1 block text-danger">Có câu trả lời chưa lưu được lên máy chủ.</span>}
          {submitError && <span className="mt-2 block rounded-md bg-danger-soft px-2 py-1.5 text-danger">{submitError}</span>}
        </ConfirmModal>
      )}
    </>
  );
}

function PagerButton({
  children,
  onClick,
  active,
  done,
  flagged,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  done?: boolean;
  flagged?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "relative flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 font-mono text-[11px] transition disabled:opacity-30",
        active
          ? "border-accent bg-accent text-white"
          : done
            ? "border-accent/40 bg-accent-soft text-accent-fg"
            : "border-line text-muted hover:bg-surface-3",
      )}
    >
      {children}
      {flagged && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning" />}
    </button>
  );
}

function Option({
  children,
  selected,
  marker,
  round,
  onClick,
}: {
  children: React.ReactNode;
  selected: boolean;
  marker: React.ReactNode;
  round?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
        selected ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface text-fg hover:border-line-strong",
      )}
    >
      <span
        className={cx(
          "flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-semibold",
          round ? "rounded-full" : "rounded-md",
          selected ? "border-accent bg-accent text-white" : "border-line-strong text-muted",
        )}
      >
        {marker}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
