import { diag } from "../lib/diag";
import { Markdown } from "../components/Markdown";
import { formatTime } from "../lib/datetime";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenText, Check, ChevronLeft, ChevronRight, Flag, LayoutGrid, Loader2, Save, X } from "lucide-react";
import { ConfirmModal, ExamShell } from "../components/ExamShell";
import { Badge, Button, cx } from "../components/ui";
import { AppWindow, onWindowShown, switchWindow } from "../lib/windowNav";
import { clearSession, getSession, type Session } from "../lib/session";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { setNotice } from "../lib/notice";
import { useExamRuntime } from "../lib/examRuntime";
import ExamLobby from "../components/ExamLobby";
import { clearPendingExam, getPendingExam, type PendingExam } from "../lib/lobbyMedia";
import {
  ApiError,
  finishExam,
  saveQuestionAnswer,
  submitExamAttempt,
  takeExam,
  assetUrl,
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
  TRUE_FALSE: { label: "Đúng / Sai", tone: "info" },
  MULTIPLE_FILL_IN_BLANK: { label: "Điền chỗ trống", tone: "accent" },
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
  const [pending, setPending] = useState<PendingExam | null>(() => getPendingExam("classic"));
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

  const runtime = useExamRuntime(monitoring);
  const guard = runtime.guard;

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
          void runtime.begin(s.attemptId, s.exam.monitoring_config);
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

  // The window is shown either to run the lobby (a pending exam, no attempt yet) or to resume a running attempt.
  useEffect(() => {
    const shown = () => {
      const p = getPendingExam("classic");
      setPending(p);
      if (!p) load();
    };
    // a window reloaded after an exam is hidden; one that is already visible at mount missed the "shown" event
    void getCurrentWindow().isVisible().then((v) => v && shown());
    return onWindowShown(shown);
  }, [load]);

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
          setSavedAt(formatTime(new Date(), true));
        })
        .catch(() => setSaveState("error"));
    }, 400);
  }

  const isAnswered = (q: ClassicalQuestionItem) => {
    const a = answers[q.id];
    if (!a) return false;
    if (q.type === "SINGLE_CHOICE") return typeof a.answerId === "number";
    if (q.type === "MULTIPLE_CHOICE") return (a.selectedAnswerIds?.length ?? 0) > 0;
    if (q.type === "MULTIPLE_FILL_IN_BLANK") return parseBlanks(a.answerContent).some((x) => x.trim());
    return Boolean(a.answerContent?.trim());
  };
  const answeredCount = answerable.filter(isAnswered).length;

  /** Leave the room (submitted or not): stop everything, show the dashboard, then reload this window so no state survives. */
  async function leave() {
    diag("leave()");
    await runtime.end();
    if (await getCurrentWindow().isVisible().catch(() => false)) await switchWindow(AppWindow.Main);
    window.location.reload();
  }

  // The server ended the attempt (proctor force-end, exam closed): stop and go home.
  useEffect(() => {
    if (!runtime.ended) return;
    setNotice(runtime.ended);
    clearSession();
    void leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.ended]);

  useEffect(() => runtime.setQuestion(questions[index]?.id ?? 0), [index, questions, runtime]);

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

  if (pending) {
    return (
      <ExamLobby
        pending={pending}
        onStarted={() => {
          setPending(null);
          load(true);
        }}
        onCancel={() => {
          clearPendingExam();
          setPending(null);
          void switchWindow(AppWindow.Main);
        }}
      />
    );
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
        runtime={runtime}
        onLeave={leave}
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
              {parent && <GroupPassage parent={parent} />}
              {current.image && <img src={assetUrl(current.image) ?? ""} alt="" className="mb-4 max-h-72 rounded-xl border border-line object-contain" />}

              <div className="flex items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                {!!current.points && <span className="text-[11px] text-muted">{current.points} điểm</span>}
                {current.type === "MULTIPLE_CHOICE" && <span className="text-[11px] text-muted">· chọn nhiều đáp án</span>}
              </div>
              <h2 className="mt-3 text-[13px] font-semibold text-accent-fg">Câu {index + 1}</h2>
              {current.type !== "MULTIPLE_FILL_IN_BLANK" && <Markdown className="mt-1 text-[15px] font-medium text-fg">{current.content}</Markdown>}

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
                        <Markdown className="[&_p]:my-0">{opt.content}</Markdown>
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
                          <Markdown className="[&_p]:my-0">{opt.content}</Markdown>
                        </Option>
                      );
                    })}
                  </div>
                )}

                {current.type === "TRUE_FALSE" && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { v: "true", label: "Đúng", icon: <Check size={16} /> },
                      { v: "false", label: "Sai", icon: <X size={16} /> },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => update(current.id, { ...a, answerContent: o.v })}
                        className={cx(
                          "flex h-16 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
                          a.answerContent === o.v ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface text-muted hover:border-line-strong",
                        )}
                      >
                        {o.icon} {o.label}
                      </button>
                    ))}
                  </div>
                )}

                {current.type === "MULTIPLE_FILL_IN_BLANK" && (
                  <FillBlanks
                    content={current.content}
                    count={current.settings?.blank_count ?? 0}
                    values={parseBlanks(a.answerContent)}
                    onPaste={guard.onPaste}
                    onChange={(vals) => update(current.id, { ...a, answerContent: JSON.stringify(vals) })}
                  />
                )}

                {current.type === "SHORT_ANSWER" && (
                  <input
                    maxLength={current.settings?.max_length ?? 300}
                    value={a.answerContent ?? ""}
                    onChange={(e) => update(current.id, { ...a, answerContent: e.target.value })}
                    onPaste={guard.onPaste}
                    placeholder="Nhập đáp án ngắn gọn…"
                    className="h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-sm text-fg outline-none focus:border-fg/60 focus:ring-2 focus:ring-fg/10"
                  />
                )}

                {current.type === "ESSAY" && (
                  <div className="overflow-hidden rounded-xl border border-line-strong bg-surface focus-within:border-fg/60">
                    {current.settings?.mode && current.settings.mode !== "write" && (
                      <p className="border-b border-warning/40 bg-warning-soft px-3 py-2 text-[11px] text-warning">
                        Câu này yêu cầu nộp {current.settings.mode === "audio" ? "bản ghi âm" : "tệp đính kèm"} — hình thức này chưa được hỗ trợ trên ứng dụng. Hãy ghi chú ngắn gọn bên dưới và báo giám thị.
                      </p>
                    )}
                    <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[11px] text-subtle">
                      <span>
                        Dán từ ngoài bị giới hạn
                        {!!current.settings?.min_words && ` · tối thiểu ${current.settings.min_words} từ`}
                        {!!current.settings?.max_words && ` · tối đa ${current.settings.max_words} từ`}
                      </span>
                      <span
                        className={cx(
                          "font-mono",
                          !!current.settings?.max_words && wordCount(a.answerContent ?? "") > (current.settings?.max_words ?? 0) && "text-danger",
                          !!current.settings?.min_words && wordCount(a.answerContent ?? "") < (current.settings?.min_words ?? 0) && "text-warning",
                        )}
                      >
                        {wordCount(a.answerContent ?? "")} từ
                      </span>
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

function parseBlanks(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.map((x) => String(x ?? "")) : [];
  } catch {
    return [];
  }
}

/** The question text with `[1]`, `[2]` markers turned into inline inputs (extra blanks, if any, go below). */
function FillBlanks({
  content,
  count,
  values,
  onChange,
  onPaste,
}: {
  content: string;
  count: number;
  values: string[];
  onChange: (v: string[]) => void;
  onPaste: (e: React.ClipboardEvent) => void;
}) {
  const parts = content.split(/(\[\d+\])/g);
  const total = Math.max(count, ...parts.map((p) => Number(/^\[(\d+)\]$/.exec(p)?.[1] ?? 0)));
  const set = (i: number, v: string) => {
    const next = Array.from({ length: total }, (_, k) => values[k] ?? "");
    next[i] = v;
    onChange(next);
  };
  const input = (i: number) => (
    <input
      key={`b${i}`}
      value={values[i] ?? ""}
      onChange={(e) => set(i, e.target.value)}
      onPaste={onPaste}
      aria-label={`Chỗ trống ${i + 1}`}
      placeholder={`(${i + 1})`}
      className="mx-1 inline-block h-8 w-40 rounded-lg border border-line-strong bg-surface px-2 text-center text-sm text-fg outline-none focus:border-fg/60"
    />
  );
  const used = new Set<number>();
  return (
    <div>
      <p className="whitespace-pre-wrap text-[15px] font-medium leading-[2.4] text-fg">
        {parts.map((p, i) => {
          const m = /^\[(\d+)\]$/.exec(p);
          if (!m) return <span key={i}>{p}</span>;
          used.add(Number(m[1]) - 1);
          return input(Number(m[1]) - 1);
        })}
      </p>
      {Array.from({ length: total }, (_, i) => i)
        .filter((i) => !used.has(i))
        .map((i) => (
          <div key={i} className="mt-2 flex items-center gap-2 text-xs text-muted">
            Chỗ trống {i + 1}: {input(i)}
          </div>
        ))}
    </div>
  );
}

/** Shared passage of a GROUP_QUESTION: text, image or audio (limited plays, optional seeking). */
function GroupPassage({ parent }: { parent: ClassicalQuestionItem }) {
  const st = parent.settings ?? {};
  const [plays, setPlays] = useState(0);
  const limit = st.listen_limit ?? 0; // 0 = unlimited
  const audio = useRef<HTMLAudioElement>(null);
  const blocked = limit > 0 && plays >= limit;
  return (
    <div className="mb-5 rounded-xl border border-line bg-surface p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">
        <BookOpenText size={12} /> {st.media === "audio" ? "Bài nghe dùng chung" : st.media === "image" ? "Hình ảnh dùng chung" : "Đoạn đọc dùng chung"}
      </p>
      {parent.content && <Markdown>{parent.content}</Markdown>}
      {st.passage && <Markdown className="mt-2">{st.passage}</Markdown>}
      {st.media === "image" && st.image_url && <img src={assetUrl(st.image_url) ?? ""} alt="" className="mt-3 max-h-80 rounded-lg border border-line object-contain" />}
      {st.media === "audio" && st.audio_url && (
        <div className="mt-3 flex items-center gap-3">
          <audio ref={audio} src={assetUrl(st.audio_url) ?? undefined} controls={!!st.allow_seek && !blocked} onPlay={() => setPlays((n) => n + 1)} className="h-9 flex-1" />
          {!st.allow_seek && (
            <Button size="sm" disabled={blocked} onClick={() => void audio.current?.play()}>
              Phát
            </Button>
          )}
          {limit > 0 && (
            <span className="font-mono text-[11px] text-muted">
              {Math.min(plays, limit)}/{limit} lượt nghe
            </span>
          )}
        </div>
      )}
    </div>
  );
}
