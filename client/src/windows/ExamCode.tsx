import { diag } from "../lib/diag";
import { formatTime } from "../lib/datetime";
import { useEffect, useRef, useState } from "react";
import { TauriEvent } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CheckCircle2, Clock, FileCode2, History, Loader2, Play, Send, XCircle } from "lucide-react";
import { ConfirmModal, ExamShell } from "../components/ExamShell";
import { Badge, Button, Empty, cx } from "../components/ui";
import { AppWindow, onWindowShown, switchWindow } from "../lib/windowNav";
import { getSession, clearSession, type Session } from "../lib/session";
import { setNotice } from "../lib/notice";
import { useExamRuntime } from "../lib/examRuntime";
import { listToolchains, useRunnerSession, type Toolchain } from "../lib/runner";
import * as EditorModule from "react-simple-code-editor";
import { highlight } from "../lib/highlight";
import { Markdown } from "../components/Markdown";
import { Terminal } from "../components/Terminal";
import { ResizeHandle, useResizable } from "../components/Resizable";
import ExamLobby from "../components/ExamLobby";
import { clearPendingExam, getPendingExam, type PendingExam } from "../lib/lobbyMedia";
import {
  ApiError,
  finishExam,
  getPaper,
  getSubmissions,
  sendHeartbeat,
  submitSolution,
  type PaperData,
  type Problem,
  type Submission,
} from "../lib/api";

// the package is CommonJS: depending on the bundler the component is the module, its default, or default.default
type EditorComponent = typeof import("react-simple-code-editor").default;
const Editor = ((EditorModule as unknown as { default?: { default?: EditorComponent } & EditorComponent }).default?.default ??
  (EditorModule as unknown as { default?: EditorComponent }).default ??
  (EditorModule as unknown as EditorComponent)) as EditorComponent;

const LANG_LABEL: Record<string, string> = { cpp: "C++17", python: "Python 3", java: "Java" };
const LANG_FILE: Record<string, string> = { cpp: "solution.cpp", python: "solution.py", java: "Main.java" };

function starterCode(problem: Problem, language: string): string {
  return (problem.starter_templates as Record<string, string | undefined>)[language] ?? "";
}

/**
 * Cửa sổ thi lập trình (protect content) — nối thật API (`/student/paper`,
 * `/submit`, `/submissions`, `/heartbeat`, `/finish`) + giám sát HĐH qua
 * `useExamGuard`.
 *
 * Cửa sổ được tạo từ lúc app khởi động (trước khi đăng nhập), nên tải đề mỗi
 * khi được hiện bởi `switchWindow` và chỉ khi lượt thi khác lần trước — không
 * tải lại khi chỉ focus/kéo cửa sổ, để không ghi đè code đang gõ dở.
 *
 */
export default function ExamCode() {
  const [pending, setPending] = useState<PendingExam | null>(() => getPendingExam("code"));
  const [session, setSession] = useState<Session | null>(() => getSession());
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  const [examInfo, setExamInfo] = useState<PaperData["exam"] | null>(null);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPaper, setLoadingPaper] = useState(true);

  const [activeIdx, setActiveIdx] = useState(0);
  const [leftTab, setLeftTab] = useState<"problem" | "history">("problem");
  const [languageByProblem, setLanguageByProblem] = useState<Record<number, string>>({});
  const [codeByKey, setCodeByKey] = useState<Record<string, string>>({});

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [examStatus, setExamStatus] = useState("IN_PROGRESS");
  const [flagged, setFlagged] = useState(false);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [toolchains, setToolchains] = useState<Toolchain[]>([]);
  const [toolchainId, setToolchainId] = useState("");
  const term = useRunnerSession();
  const left = useResizable("code-left", 460, 280, 900, "x");
  const termHeight = useResizable("code-terminal", 220, 100, 520, "y", -1);
  const [finishing, setFinishing] = useState(false);

  const runtime = useExamRuntime(examInfo?.monitoring_config);
  const guard = runtime.guard;

  const currentProblem = problems?.[activeIdx] ?? null;
  const currentLanguage = currentProblem ? (languageByProblem[currentProblem.id] ?? "cpp") : "cpp";
  const currentKey = currentProblem ? `${currentProblem.id}:${currentLanguage}` : "";
  const currentCode = codeByKey[currentKey] ?? "";

  async function refreshSubmissions() {
    try {
      const res = await getSubmissions();
      setSubmissions(res.data);
    } catch (err) {
      console.error("[exam-code] Không tải được lịch sử nộp bài:", err);
    }
  }

  /** Leave the room (submitted or not): stop everything, show the dashboard, then reload this window so no state survives. */
  async function leave() {
    diag("leave()");
    await runtime.end();
    // a window nobody can see must never drag the dashboard to the front (and hide the window that is in use)
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

  useEffect(() => runtime.setQuestion(problems?.[activeIdx]?.id ?? 0), [activeIdx, problems, runtime]);

  const loadedAttemptRef = useRef<number | null>(null);
  const rtStatus = useRef(runtime.status);
  rtStatus.current = runtime.status;
  useEffect(() => {
    async function loadPaper() {
      const current = getSession();
      setSession(current);
      if (!current || loadedAttemptRef.current === current.attemptId) return;
      loadedAttemptRef.current = current.attemptId;

      setLoadingPaper(true);
      setLoadError(null);
      setActiveIdx(0);
      setSubmissions([]);
      try {
        const res = await getPaper();
        setExamInfo(res.data.exam);
        setProblems(res.data.problems);
        setRemainingSeconds(res.data.exam.remaining_seconds);

        const langInit: Record<number, string> = {};
        const codeInit: Record<string, string> = {};
        for (const p of res.data.problems) {
          const lang = p.allowed_languages[0] ?? "cpp";
          langInit[p.id] = lang;
          codeInit[`${p.id}:${lang}`] = starterCode(p, lang);
        }
        setLanguageByProblem(langInit);
        setCodeByKey(codeInit);
        void runtime.begin(current.attemptId, current.exam.monitoring_config);
        await refreshSubmissions();
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Không tải được đề thi.");
        loadedAttemptRef.current = null;
      } finally {
        setLoadingPaper(false);
      }
    }

    loadRef.current = loadPaper;
    const shown = () => {
      const p = getPendingExam("code");
      setPending(p); // a pending exam means: show the lobby first, the attempt does not exist yet
      if (!p) void loadPaper();
    };
    void getCurrentWindow().isVisible().then((v) => v && shown());
    return onWindowShown(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heartbeat + đếm ngược — chạy khi cửa sổ focus, dừng khi mất focus/ẩn.
  // (Vi phạm rời cửa sổ do `useExamGuard` báo, kèm tên ứng dụng được chuyển sang.)
  useEffect(() => {
    let heartbeatTimer: number | undefined;
    let tickTimer: number | undefined;

    async function runHeartbeat() {
      // while the realtime channel is up it carries the heartbeat, the time and the end-of-attempt signal: no REST polling
      if (rtStatus.current !== "off") return;
      try {
        const hb = await sendHeartbeat();
        setRemainingSeconds(hb.remaining_seconds);
        setExamStatus(hb.status);
        setFlagged(hb.is_flagged);
      } catch (err) {
        console.error("[exam-code] Heartbeat lỗi:", err);
        // Phiên thi đã kết thúc (giám thị khoá bài / hết giờ) -> về Dashboard.
        if (err instanceof ApiError && err.body?.action === "FORCE_LOGOUT") {
          stop();
          clearSession();
          await leave();
        }
      }
    }

    function start() {
      stop();
      if (!getSession() || !loadedAttemptRef.current) return; // lobby / idle window: no attempt to keep alive
      void runHeartbeat();
      heartbeatTimer = window.setInterval(runHeartbeat, 8000);
      tickTimer = window.setInterval(() => {
        setRemainingSeconds((s) => (s !== null ? Math.max(0, s - 1) : s));
      }, 1000);
    }

    function stop() {
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (tickTimer) window.clearInterval(tickTimer);
      heartbeatTimer = undefined;
      tickTimer = undefined;
    }

    const unlistenFocus = getCurrentWindow().listen(TauriEvent.WINDOW_FOCUS, start);
    const unlistenBlur = getCurrentWindow().listen(TauriEvent.WINDOW_BLUR, stop);
    return () => {
      stop();
      void unlistenFocus.then((fn) => fn());
      void unlistenBlur.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void listToolchains().then(setToolchains).catch(() => setToolchains([]));
  }, []);

  const toolchainsForLanguage = toolchains.filter((t) => t.language === currentLanguage);
  const activeToolchain = toolchainsForLanguage.find((t) => t.id === toolchainId) ?? toolchainsForLanguage[0];

  async function handleRun() {
    if (!activeToolchain || !currentProblem) return;
    await term.start(activeToolchain.id, currentCode, `${activeToolchain.label} · ${LANG_FILE[currentLanguage] ?? "solution"}`);
  }

  function handleLanguageChange(lang: string) {
    if (!currentProblem) return;
    const key = `${currentProblem.id}:${lang}`;
    setLanguageByProblem((prev) => ({ ...prev, [currentProblem.id]: lang }));
    setCodeByKey((prev) => (key in prev ? prev : { ...prev, [key]: starterCode(currentProblem, lang) }));
  }

  async function handleSubmit() {
    if (!currentProblem) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitSolution({ programmingProblemId: currentProblem.id, language: currentLanguage, sourceCode: currentCode });
      await refreshSubmissions();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Nộp bài thất bại, thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      await finishExam();
    } catch (err) {
      console.error("[exam-code] Kết thúc ca thi lỗi:", err);
    }
    setFinishing(false);
    setConfirmFinish(false);
    clearSession();
    await leave();
  }

  if (pending) {
    return (
      <ExamLobby
        pending={pending}
        onStarted={() => {
          setPending(null);
          void loadRef.current?.();
        }}
        onCancel={() => {
          clearPendingExam();
          setPending(null);
          void switchWindow(AppWindow.Main);
        }}
      />
    );
  }

  if (!session || loadingPaper || loadError || !problems || !examInfo || !currentProblem) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-app text-sm text-muted">
        {loadingPaper && session ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Đang tải đề thi…
          </>
        ) : (
          <>
            <p className={loadError ? "text-danger" : ""}>{loadError ?? (session ? "Đề thi chưa có bài nào." : "Chưa chọn kỳ thi.")}</p>
            <Button onClick={() => void leave()}>Về trang chủ</Button>
          </>
        )}
      </div>
    );
  }

  const locked = examStatus !== "IN_PROGRESS";
  const latestFor = (pid: number) => submissions.filter((s) => s.programming_problem_id === pid).sort((a, b) => b.id - a.id)[0];
  const current = latestFor(currentProblem.id);
  const historyForCurrent = submissions.filter((s) => s.programming_problem_id === currentProblem.id).sort((a, b) => b.id - a.id);

  return (
    <>
      <ExamShell
        title={examInfo.title}
        subtitle={`${session.exam.code} · Bài ${activeIdx + 1}/${problems.length} · Lần thi #${session.attemptNumber}${flagged ? " · ⚠ đang bị đánh dấu nghi vấn" : ""}`}
        remainingSeconds={remainingSeconds}
        submitLabel="Kết thúc ca thi"
        onSubmit={() => setConfirmFinish(true)}
        runtime={runtime}
        onLeave={leave}
        headerExtra={
          <div className="flex gap-1">
            {problems.map((p, idx) => {
              const s = latestFor(p.id);
              const full = s && s.total_cases_count > 0 && s.passed_cases_count === s.total_cases_count;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={cx(
                    "h-8 rounded-lg border px-3 text-xs font-medium transition",
                    idx === activeIdx
                      ? "border-accent/50 bg-accent-soft text-accent-fg"
                      : full
                        ? "border-success/40 bg-success-soft text-success"
                        : "border-line text-muted hover:bg-surface-3",
                  )}
                >
                  Bài {p.order}
                  {s && ` · ${s.passed_cases_count}/${s.total_cases_count}`}
                </button>
              );
            })}
          </div>
        }
      >
        {locked && (
          <div className="shrink-0 border-b border-danger/30 bg-danger-soft px-4 py-1.5 text-center text-xs text-danger">
            Ca thi đã kết thúc/bị khoá ({examStatus}) — không thể nộp bài thêm.
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          {/* Đề bài / lịch sử nộp */}
          <section className="flex shrink-0 flex-col bg-surface" style={{ width: left.size }}>
            <div className="flex shrink-0 gap-4 border-b border-line px-4 text-xs">
              <Tab active={leftTab === "problem"} onClick={() => setLeftTab("problem")} icon={<FileCode2 size={13} />}>
                Đề bài
              </Tab>
              <Tab active={leftTab === "history"} onClick={() => setLeftTab("history")} icon={<History size={13} />}>
                Lịch sử ({historyForCurrent.length})
              </Tab>
            </div>
            <div className="selectable min-h-0 flex-1 overflow-y-auto p-5">
              {leftTab === "problem" ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">{currentProblem.difficulty}</Badge>
                    <span className="text-[11px] text-muted">
                      {currentProblem.time_limit_ms}ms · {currentProblem.memory_limit_mb}MB
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-fg">
                    {currentProblem.order}. {currentProblem.title}
                  </h2>
                  <Markdown className="mt-3">{currentProblem.description}</Markdown>
                  {currentProblem.sample_test_cases.map((tc, i) => (
                    <div key={i} className="mt-4">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">Ví dụ {i + 1}</p>
                      <div className="overflow-hidden rounded-lg border border-line font-mono text-xs">
                        <p className="border-b border-line bg-surface-2 px-3 py-1 text-[10px] text-subtle">input</p>
                        <pre className="whitespace-pre-wrap px-3 py-2 text-fg">{tc.input}</pre>
                        <p className="border-y border-line bg-surface-2 px-3 py-1 text-[10px] text-subtle">output</p>
                        <pre className="whitespace-pre-wrap px-3 py-2 text-fg">{tc.output}</pre>
                      </div>
                    </div>
                  ))}
                </>
              ) : historyForCurrent.length === 0 ? (
                <Empty text="Chưa nộp lần nào cho bài này." />
              ) : (
                <ul className="space-y-2">
                  {historyForCurrent.map((s, i) => (
                    <SubmissionRow key={s.id} s={s} n={historyForCurrent.length - i} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <ResizeHandle axis="x" onPointerDown={left.onPointerDown} onDoubleClick={left.reset} />
          {/* Trình soạn code */}
          <section className="flex min-w-0 flex-1 flex-col bg-surface-2">
            <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line px-3 text-xs">
              <select
                value={currentLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="h-7 rounded-md border border-line bg-surface px-2 text-xs text-fg outline-none"
              >
                {currentProblem.allowed_languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {LANG_LABEL[lang] ?? lang}
                  </option>
                ))}
              </select>
              <span className="font-mono text-muted">{LANG_FILE[currentLanguage] ?? "solution"}</span>
              {toolchainsForLanguage.length > 0 ? (
                <select
                  value={activeToolchain?.id ?? ""}
                  onChange={(e) => setToolchainId(e.target.value)}
                  title="Trình biên dịch trên máy của bạn"
                  className="h-7 max-w-[200px] rounded-md border border-line bg-surface px-2 text-xs text-fg outline-none"
                >
                  {toolchainsForLanguage.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} {t.version}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11px] text-warning">Máy chưa có trình biên dịch cho {LANG_LABEL[currentLanguage] ?? currentLanguage}</span>
              )}
              <span className="ml-auto text-[11px] text-subtle">Không cho sao chép / dán</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-surface">
              <Editor
                value={currentCode}
                onValueChange={(code) => setCodeByKey((prev) => ({ ...prev, [currentKey]: code }))}
                highlight={(code) => highlight(code, currentLanguage)}
                padding={16}
                tabSize={2}
                insertSpaces
                onPaste={(e) => guard.onPaste(e, { problemId: currentProblem.id })}
                spellCheck={false}
                className="min-h-full font-mono text-[13px] leading-relaxed text-fg"
                textareaClassName="outline-none"
                style={{ fontFamily: "var(--font-mono)", fontSize: 13, minHeight: "100%" }}
              />
            </div>
            <ResizeHandle axis="y" onPointerDown={termHeight.onPointerDown} onDoubleClick={termHeight.reset} />
            <div className="flex shrink-0 flex-col border-b border-line" style={{ height: termHeight.size }}>
              <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
                <Button size="sm" variant="primary" icon={<Play size={12} />} disabled={locked || !activeToolchain || term.running} onClick={() => void handleRun()}>
                  Chạy
                </Button>
                <span className="text-[11px] text-muted">Chạy bằng trình biên dịch trên máy bạn; nhập dữ liệu ngay trong terminal bên dưới.</span>
              </div>
              <Terminal
                className="min-h-0 flex-1"
                chunks={term.chunks}
                running={term.running}
                exit={term.exit}
                onSend={(line) => void term.write(line)}
                onEof={term.eof}
                onKill={term.kill}
                onClear={term.clear}
              />
            </div>
            <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-3 py-2">
              {submitError ? (
                <p className="text-xs text-danger">{submitError}</p>
              ) : current ? (
                <SubmissionSummary s={current} />
              ) : (
                <p className="text-xs text-subtle">Chưa nộp bài này.</p>
              )}
              <Button
                variant="primary"
                className="ml-auto"
                icon={<Send size={13} />}
                loading={submitting}
                disabled={locked}
                onClick={() => void handleSubmit()}
              >
                Nộp bài {currentProblem.order}
              </Button>
            </div>
          </section>
        </div>
      </ExamShell>

      {confirmFinish && (
        <ConfirmModal
          title="Kết thúc ca thi?"
          confirmLabel="Kết thúc"
          busy={finishing}
          onCancel={() => setConfirmFinish(false)}
          onConfirm={() => void handleFinish()}
        >
          Sau khi kết thúc sẽ không thể nộp bài thêm. Bài đã nộp: {new Set(submissions.map((s) => s.programming_problem_id)).size}/
          {problems.length}.
        </ConfirmModal>
      )}
    </>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "-mb-px flex items-center gap-1.5 border-b-2 py-2.5",
        active ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SubmissionSummary({ s }: { s: Submission }) {
  if (s.status === "PENDING")
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Clock size={13} /> Lần nộp gần nhất đang chờ chấm…
      </p>
    );
  const pass = s.total_cases_count > 0 && s.passed_cases_count === s.total_cases_count;
  return (
    <p className={cx("flex items-center gap-1.5 text-xs", pass ? "text-success" : "text-warning")}>
      {pass ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {s.passed_cases_count}/{s.total_cases_count} test đúng · {s.score} điểm
    </p>
  );
}

function SubmissionRow({ s, n }: { s: Submission; n: number }) {
  return (
    <li className="rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg">
          #{n} · {LANG_LABEL[s.language] ?? s.language}
        </span>
        <span className="font-mono text-[10px] text-subtle">{formatTime(s.submitted_at ?? s.created_at, true)}</span>
      </div>
      <div className="mt-1">
        <SubmissionSummary s={s} />
      </div>
    </li>
  );
}
