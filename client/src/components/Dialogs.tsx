import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Button, cx } from "./ui";
import { dismissToast, getDialogs, getToasts, settle, subscribe, type DialogRequest, type DialogTone } from "../lib/dialog";

const TONE: Record<DialogTone, { icon: typeof Info; chip: string; button: "primary" | "danger" }> = {
  default: { icon: Info, chip: "bg-info-soft text-info", button: "primary" },
  success: { icon: CheckCircle2, chip: "bg-success-soft text-success", button: "primary" },
  warning: { icon: AlertTriangle, chip: "bg-warning-soft text-warning", button: "primary" },
  danger: { icon: XCircle, chip: "bg-danger-soft text-danger", button: "danger" },
};

function DialogCard({ d }: { d: DialogRequest }) {
  const [left, setLeft] = useState(d.delaySeconds);
  const t = TONE[d.tone];
  const Icon = t.icon;

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(d.id, false);
      if (e.key === "Enter" && left <= 0) settle(d.id, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d.id, left]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={() => d.kind === "confirm" && settle(d.id, false)}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", t.chip)}>
            <Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-fg">{d.title}</h3>
            {d.text && <p className="selectable mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted">{d.text}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {d.kind === "confirm" && <Button onClick={() => settle(d.id, false)}>{d.cancelLabel}</Button>}
          <Button variant={t.button} disabled={left > 0} onClick={() => settle(d.id, true)}>
            {d.confirmLabel}
            {left > 0 && ` (${left}s)`}
          </Button>
        </div>
      </div>
    </div>
  );
}

const TOAST_STYLE = {
  info: { icon: Info, cls: "border-info/30 text-info" },
  success: { icon: CheckCircle2, cls: "border-success/30 text-success" },
  error: { icon: XCircle, cls: "border-danger/30 text-danger" },
} as const;

export default function DialogHost() {
  const dialogs = useSyncExternalStore(subscribe, getDialogs);
  const toasts = useSyncExternalStore(subscribe, getToasts);
  const current = dialogs[0];

  return (
    <>
      {current && <DialogCard key={current.id} d={current} />}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.tone];
          const Icon = s.icon;
          return (
            <div key={t.id} className={cx("pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface px-3 py-2.5 shadow-lg", s.cls)}>
              <Icon size={15} className="mt-0.5 shrink-0" />
              <p className="selectable min-w-0 flex-1 text-xs leading-relaxed text-fg">{t.text}</p>
              <button type="button" onClick={() => dismissToast(t.id)} className="text-subtle hover:text-fg" title="Đóng">
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
