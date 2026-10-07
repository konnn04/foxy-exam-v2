import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Camera, Clock, Cpu, Eye, Lock, Mic, Monitor, MonitorUp, ShieldAlert, ShieldCheck, WifiOff } from "lucide-react";
import { Button, cx } from "./ui";
import { DevPanel } from "./DevPanel";
import { lockdownOn } from "../lib/examGuard";
import { activeBypasses } from "../lib/dev";
import { OFFLINE_LIMIT_S, type useExamRuntime } from "../lib/examRuntime";

type Runtime = ReturnType<typeof useExamRuntime>;

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Shared frame of the exam windows: lockdown banner with live status chips, header (title, clock, submit),
 * the content, the monitoring panel (camera preview, attention, devices, violations) and the blocking overlays
 * (lost camera / screen share, banned app, offline, paused). Closing the window asks first.
 */
export function ExamShell({
  title,
  subtitle,
  remainingSeconds,
  headerExtra,
  submitLabel = "Nộp bài",
  onSubmit,
  submitDisabled,
  runtime,
  onLeave,
  toolbar,
  children,
  panelExtra,
}: {
  title: string;
  subtitle: string;
  remainingSeconds: number | null;
  headerExtra?: ReactNode;
  submitLabel?: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  runtime: Runtime;
  /** Leave the room WITHOUT submitting (the attempt stays open for 5 minutes). */
  onLeave: () => Promise<void> | void;
  toolbar?: ReactNode;
  children: ReactNode;
  panelExtra?: ReactNode;
}) {
  const { guard, warning, paused, status, mediaState, blocker, offlineFor } = runtime;
  const low = remainingSeconds !== null && remainingSeconds < 300;
  const offline = offlineFor >= 10; // ignore short hiccups

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-fg">
      <div className="flex h-7 shrink-0 items-center gap-2 bg-[#5c1a12] px-4 text-[11px] text-white">
        <Lock size={12} />
        <span className="font-semibold uppercase tracking-wide">Chế độ thi{lockdownOn() ? " — máy đang bị khoá" : " — không khoá máy (dev)"}</span>
        <span className="text-white/70">| Không thu nhỏ, đổi cửa sổ hoặc chụp màn hình</span>
        <span className="ml-auto flex items-center gap-3 font-mono text-[10px]">
          <Chip ok={guard.active} label={guard.active ? "giám sát" : "chưa giám sát"} />
          <Chip ok={runtime.camera !== "lost"} off={runtime.camera === "none"} label="camera" />
          <Chip ok={runtime.screen !== "lost"} off={runtime.screen === "none"} label="màn hình" />
          <Chip ok={status === "live" || status === "off"} warn={status === "degraded"} label={status === "live" ? "realtime" : status === "degraded" ? "mạng chập chờn" : status === "connecting" ? "đang kết nối" : "REST"} />
          {mediaState === "connected" && <Chip ok label="đang phát" />}
          {activeBypasses().length > 0 && <span className="text-[#ffd479]">DEV bypass: {activeBypasses().join(",")}</span>}
        </span>
      </div>

      <header className="flex shrink-0 items-center gap-4 border-b border-line bg-surface px-5 py-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-fg">{title}</h1>
          <p className="truncate text-[11px] text-muted">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          {headerExtra}
          <span
            className={cx(
              "flex h-8 items-center gap-1.5 rounded-lg border px-3 font-mono text-[15px] font-semibold tabular-nums",
              low ? "live-dot border-danger/50 bg-danger-soft text-danger" : "border-line bg-surface-2 text-fg",
            )}
          >
            <Clock size={14} /> {remainingSeconds !== null ? formatCountdown(remainingSeconds) : "--:--"}
          </span>
          <Button variant="danger" size="md" className="h-8" onClick={onSubmit} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      </header>

      {warning && (
        <div className="flex shrink-0 items-start gap-3 border-b border-warning/50 bg-warning-soft px-5 py-2.5 text-sm">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warning">Giám thị nhắc nhở</p>
            <p className="whitespace-pre-wrap text-fg">{warning.message}</p>
          </div>
          <Button size="sm" onClick={runtime.dismissWarning}>
            Đã hiểu
          </Button>
        </div>
      )}
      {offline && offlineFor < OFFLINE_LIMIT_S && (
        <div className="flex shrink-0 items-center gap-2 border-b border-danger/50 bg-danger-soft px-5 py-2 text-xs text-danger">
          <WifiOff size={14} /> Mất kết nối {formatCountdown(offlineFor)} — nếu quá {OFFLINE_LIMIT_S / 60} phút bạn sẽ bị tính vắng thi. Còn {formatCountdown(OFFLINE_LIMIT_S - offlineFor)}.
        </div>
      )}

      {toolbar}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {children}
          {paused && (
            <Overlay z={30} icon={<Clock size={28} className="text-warning" />} title="Giám thị đã tạm dừng bài thi của bạn">
              Vui lòng chờ — bài làm sẽ tự mở lại khi giám thị cho phép tiếp tục.
            </Overlay>
          )}
          {blocker && (
            <Overlay z={25} icon={blocker.kind === "camera" ? <Camera size={28} className="text-danger" /> : <MonitorUp size={28} className="text-danger" />} title="Bài thi đang bị tạm khoá">
              {blocker.text}
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button variant="primary" onClick={() => void (blocker.kind === "camera" ? runtime.restoreCamera() : runtime.restoreScreen())}>
                  {blocker.kind === "camera" ? "Bật lại camera" : "Chia sẻ lại màn hình"}
                </Button>
                {runtime.restoreError && <span className="text-danger">{runtime.restoreError}</span>}
                <span className="text-[11px] text-subtle">Sự việc đã được ghi nhận và gửi cho giám thị.</span>
              </div>
            </Overlay>
          )}
          {guard.blockReason && (
            <Overlay z={20} icon={<ShieldAlert size={28} className="text-danger" />} title="Bài thi đang bị tạm khoá">
              {guard.blockReason}
              <p className="mt-3 text-[11px] text-subtle">Màn hình sẽ tự mở lại khi vấn đề được khắc phục. Vi phạm đã được ghi nhận.</p>
            </Overlay>
          )}
        </div>
        <GuardPanel runtime={runtime}>{panelExtra}</GuardPanel>
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface-2 px-4 text-[11px] text-muted">
        <span className={cx("flex items-center gap-1", guard.violations.length > 0 && "text-danger")}>
          <AlertTriangle size={12} /> {guard.violations.length} vi phạm
        </span>
        <span className={cx("flex items-center gap-1", guard.displays > 1 && "text-danger")}>
          <Monitor size={12} /> {guard.displays} màn hình
        </span>
        <span className="flex items-center gap-1">
          <Camera size={12} /> {guard.cameras} camera
        </span>
        <span className="flex items-center gap-1">
          <Mic size={12} /> {guard.microphones} micro
        </span>
        <span className={cx("flex items-center gap-1", guard.bannedRunning.length > 0 && "text-danger")}>
          <Cpu size={12} /> Theo dõi tiến trình
        </span>
        <span className="ml-auto">Foxy Exam</span>
      </footer>

      {runtime.closeRequested && <ExitDialog onStay={runtime.dismissClose} onLeave={onLeave} />}
      <DevPanel />
    </div>
  );
}

function Chip({ ok, warn, off, label }: { ok: boolean; warn?: boolean; off?: boolean; label: string }) {
  const color = off ? "text-white/40" : warn ? "text-[#ffd479]" : ok ? "text-[#7ee2a0]" : "text-[#ff8a80]";
  return (
    <span className={cx("flex items-center gap-1.5", color)}>
      <span className={cx("h-1.5 w-1.5 rounded-full bg-current", ok && !off && !warn && "live-dot")} /> {label}
    </span>
  );
}

function Overlay({ icon, title, children, z }: { icon: ReactNode; title: string; children: ReactNode; z: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-app/90 backdrop-blur-md" style={{ zIndex: z }}>
      <div className="max-w-md rounded-2xl border border-line bg-surface p-6 text-center text-xs text-muted shadow-xl">
        <div className="flex justify-center">{icon}</div>
        <p className="mt-3 text-sm font-semibold text-fg">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

/** Closing the window = leaving the room: 5 seconds before the button works, so it cannot be hit by accident. */
function ExitDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => Promise<void> | void }) {
  const [left, setLeft] = useState(5);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-danger/40 bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-2 text-danger">
          <AlertTriangle size={18} />
          <h3 className="text-base font-semibold text-fg">Rời phòng thi?</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Bài của bạn <b className="text-fg">chưa được nộp</b>. Đồng hồ vẫn chạy, camera và giám sát sẽ tắt. Bạn có tối đa{" "}
          <b className="text-fg">5 phút</b> để vào lại phòng thi; quá thời gian đó bạn bị tính <b className="text-danger">vắng thi</b> và bài làm hiện có sẽ được nộp tự động.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="primary" onClick={onStay} disabled={busy}>
            Tiếp tục làm bài
          </Button>
          <Button
            variant="danger"
            disabled={left > 0 || busy}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onLeave();
            }}
          >
            {left > 0 ? `Rời phòng thi (${left}s)` : "Rời phòng thi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CameraPreview({ runtime }: { runtime: Runtime }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { cameraStream, camera, sample, visionError } = runtime;
  useEffect(() => {
    if (ref.current) ref.current.srcObject = cameraStream;
  }, [cameraStream]);

  if (camera === "none" && !cameraStream) {
    return <div className="mx-3 mt-3 rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-subtle">Không dùng camera trong kỳ thi này</div>;
  }
  const att = sample?.attention;
  return (
    <div className="mx-3 mt-3 overflow-hidden rounded-lg border border-line bg-black">
      <div className="relative">
        <video ref={ref} autoPlay muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
        <span className={cx("absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold", camera === "lost" ? "text-[#ff8a80]" : "text-white")}>
          <span className={cx("h-1.5 w-1.5 rounded-full", camera === "lost" ? "bg-danger" : "live-dot bg-danger")} /> {camera === "lost" ? "MẤT CAMERA" : "LIVE"}
        </span>
        {sample && sample.faces !== 1 && (
          <span className="absolute inset-x-0 bottom-0 bg-danger/80 px-2 py-0.5 text-center text-[10px] font-semibold text-white">
            {sample.faces === 0 ? "Không thấy khuôn mặt" : `${sample.faces} khuôn mặt trong khung`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 bg-surface-2 px-2.5 py-1.5 text-[10px] text-muted">
        <Eye size={11} />
        {att !== undefined ? (
          <>
            <span>Tập trung</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span className={cx("block h-full rounded-full", att >= 60 ? "bg-success" : att >= 30 ? "bg-warning" : "bg-danger")} style={{ width: `${att}%` }} />
            </span>
            <span className="font-mono">{att}%</span>
            <span className="font-mono text-subtle">{sample?.delegate}</span>
          </>
        ) : (
          <span>{visionError ? "Phân tích khuôn mặt tắt" : "Đang khởi động phân tích…"}</span>
        )}
      </div>
    </div>
  );
}

function GuardPanel({ runtime, children }: { runtime: Runtime; children?: ReactNode }) {
  const guard = runtime.guard;
  const row = (ok: boolean, icon: ReactNode, label: string, value: string) => (
    <div
      className={cx(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        ok ? "border-line bg-surface-2 text-fg" : "border-danger/40 bg-danger-soft text-danger",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span className="font-mono text-[11px] text-muted">{value}</span>
    </div>
  );

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-l border-line bg-surface">
      <p className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-danger live-dot" /> Đang giám sát
      </p>
      <CameraPreview runtime={runtime} />
      <div className="space-y-1.5 p-3">
        {row(guard.displays <= 1, <Monitor size={13} />, "Màn hình", `${guard.displays}`)}
        {row(guard.cameras > 0 || runtime.camera !== "none", <Camera size={13} />, "Camera", runtime.camera === "lost" ? "mất" : `${Math.max(guard.cameras, runtime.camera === "ok" ? 1 : 0)}`)}
        {row(guard.microphones > 0, <Mic size={13} />, "Micro", `${guard.microphones}`)}
        {row(guard.bannedRunning.length === 0, <Cpu size={13} />, "Ứng dụng bị cấm", `${guard.bannedRunning.length}`)}
      </div>
      {children}
      <div className="flex min-h-0 flex-1 flex-col border-t border-line">
        <p className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-fg">
          <ShieldCheck size={13} className={guard.violations.length ? "text-danger" : "text-success"} /> Vi phạm
          <span className="ml-auto rounded-full bg-surface-3 px-1.5 text-[10px] text-muted">{guard.violations.length}</span>
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {guard.violations.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-subtle">Chưa có vi phạm nào</p>
          ) : (
            <ul className="space-y-1.5">
              {guard.violations.map((v) => (
                <li key={v.id} className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5">
                  <p className="text-[11px] leading-snug text-fg">{v.message}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-subtle">
                    {new Date(v.t).toLocaleTimeString("vi-VN")} · {v.type}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

export function ConfirmModal({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        <div className="mt-2 text-xs leading-relaxed text-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onCancel} disabled={busy}>
            Tiếp tục làm bài
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
