/**
 * Imperative dialogs and toasts, callable from anywhere (components, hooks, plain modules).
 * `<DialogHost />` (components/Dialogs.tsx) renders them; one host is mounted per window.
 *
 *   if (await dialog.confirm({ title: "Vào phòng thi?", text: "...", confirmLabel: "Vào thi" })) ...
 *   await dialog.alert({ title: "Lỗi", text: err.message, tone: "danger" });
 *   toast.success("Đã lưu");
 */
export type DialogTone = "default" | "danger" | "warning" | "success";

export interface DialogRequest {
  id: number;
  kind: "alert" | "confirm";
  title: string;
  text?: string;
  tone: DialogTone;
  confirmLabel: string;
  cancelLabel: string;
  /** the confirm button stays disabled for this many seconds (e.g. leaving an exam) */
  delaySeconds: number;
  resolve: (ok: boolean) => void;
}

export interface ToastItem {
  id: number;
  tone: "info" | "success" | "error";
  text: string;
}

type Listener = () => void;

let seq = 0;
let dialogs: DialogRequest[] = [];
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const getDialogs = () => dialogs;
export const getToasts = () => toasts;

interface Options {
  title: string;
  text?: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  delaySeconds?: number;
}

function open(kind: "alert" | "confirm", o: Options): Promise<boolean> {
  return new Promise((resolve) => {
    dialogs = [
      ...dialogs,
      {
        id: ++seq,
        kind,
        title: o.title,
        text: o.text,
        tone: o.tone ?? "default",
        confirmLabel: o.confirmLabel ?? (kind === "alert" ? "Đã hiểu" : "Xác nhận"),
        cancelLabel: o.cancelLabel ?? "Huỷ",
        delaySeconds: o.delaySeconds ?? 0,
        resolve,
      },
    ];
    emit();
  });
}

export function settle(id: number, ok: boolean) {
  const d = dialogs.find((x) => x.id === id);
  if (!d) return;
  dialogs = dialogs.filter((x) => x.id !== id);
  emit();
  d.resolve(ok);
}

export const dialog = {
  alert: (o: Options) => open("alert", o).then(() => undefined),
  confirm: (o: Options) => open("confirm", o),
};

function push(tone: ToastItem["tone"], text: string, ms = 4000) {
  const id = ++seq;
  toasts = [...toasts.slice(-3), { id, tone, text }];
  emit();
  window.setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  info: (text: string) => push("info", text),
  success: (text: string) => push("success", text),
  error: (text: string) => push("error", text, 7000),
};

/** Turns any thrown value into text a candidate can read. */
export function errorText(err: unknown, fallback = "Có lỗi xảy ra, thử lại sau."): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
