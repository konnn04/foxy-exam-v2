import type { ReactNode } from "react";
import { AlertTriangle, Camera, Clock, Cpu, Lock, Mic, Monitor, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button, cx } from "./ui";
import { LOCKDOWN, type ExamGuardState } from "../lib/examGuard";

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Khung chung cho cửa sổ thi: dải cảnh báo chế độ thi, header (tiêu đề, đồng hồ,
 * nộp bài), nội dung, panel giám sát bên phải, thanh trạng thái dưới cùng.
 */
export function ExamShell({
  title,
  subtitle,
  remainingSeconds,
  headerExtra,
  submitLabel = "Nộp bài",
  onSubmit,
  submitDisabled,
  guard,
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
  guard: ExamGuardState;
  toolbar?: ReactNode;
  children: ReactNode;
  panelExtra?: ReactNode;
}) {
  const low = remainingSeconds !== null && remainingSeconds < 300;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-fg">
      {/* Dải chế độ thi */}
      <div className="flex h-7 shrink-0 items-center gap-2 bg-[#5c1a12] px-4 text-[11px] text-white">
        <Lock size={12} />
        <span className="font-semibold uppercase tracking-wide">Chế độ thi{LOCKDOWN ? " — máy đang bị khoá" : " — bản dev (không khoá máy)"}</span>
        <span className="text-white/70">| Không thu nhỏ, đổi cửa sổ hoặc chụp màn hình</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-[#7ee2a0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7ee2a0] live-dot" /> {guard.active ? "đang giám sát" : "chưa giám sát"}
        </span>
      </div>

      {/* Header */}
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

      {toolbar}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {children}
          {guard.blockReason && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-app/85 backdrop-blur-md">
              <div className="max-w-md rounded-2xl border border-danger/40 bg-surface p-6 text-center shadow-xl">
                <ShieldAlert size={28} className="mx-auto text-danger" />
                <p className="mt-3 text-sm font-semibold text-fg">Bài thi đang bị tạm khoá</p>
                <p className="mt-1 text-xs text-muted">{guard.blockReason}</p>
                <p className="mt-3 text-[11px] text-subtle">Màn hình sẽ tự mở lại khi vấn đề được khắc phục. Vi phạm đã được ghi nhận.</p>
              </div>
            </div>
          )}
        </div>
        <GuardPanel guard={guard}>{panelExtra}</GuardPanel>
      </div>

      {/* Thanh trạng thái */}
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
    </div>
  );
}

function GuardPanel({ guard, children }: { guard: ExamGuardState; children?: ReactNode }) {
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
      <div className="space-y-1.5 p-3">
        {row(guard.displays <= 1, <Monitor size={13} />, "Màn hình", `${guard.displays}`)}
        {row(guard.cameras > 0, <Camera size={13} />, "Camera", `${guard.cameras}`)}
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
