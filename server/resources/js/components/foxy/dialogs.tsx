/**
 * Promise-based dialogs and toasts that replace window.alert / confirm / prompt.
 *
 *   const dialog = useDialog();
 *   if (await dialog.confirm({ title: 'Xóa kỳ thi?', tone: 'danger' })) router.post(...);
 *   await dialog.alert({ title: 'Đã sao chép' });
 *   const name = await dialog.prompt({ title: 'Đổi tên', initial: 'Đề 01' });   // string | null
 *   dialog.toast.success('Đã lưu');
 *
 * The provider also turns Laravel flash messages (`flash.success|error`) and `errors.message`
 * into toasts, so controllers only need `->with('success', '...')`.
 */
import * as React from 'react';
import { router } from '@inertiajs/react';
import { CircleAlert, CircleCheck, Info, Trash2, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { Field, FxButton, FxInput, FxTextarea, Modal } from './ui';
import { cn } from '@/lib/utils';

type DialogTone = 'default' | 'danger' | 'warning';

export interface ConfirmOptions {
  title: string;
  text?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  /** Amber/red note under the text. */
  warn?: string;
  /** Force the user to type this (e.g. an organization code) before the confirm button works. */
  requireText?: string;
  icon?: LucideIcon;
}

export interface AlertOptions {
  title: string;
  text?: React.ReactNode;
  okLabel?: string;
  tone?: DialogTone | 'success';
}

export interface PromptOptions {
  title: string;
  text?: React.ReactNode;
  label?: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  multiline?: boolean;
  /** Return an error message to block submission. */
  validate?: (value: string) => string | null;
}

export interface ToastOptions {
  action?: { label: string; onClick: () => void };
  duration?: number;
}

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem extends ToastOptions {
  id: number;
  kind: ToastKind;
  message: string;
}

type Pending =
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'alert'; opts: AlertOptions; resolve: () => void }
  | { id: number; kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  toast: {
    success: (message: string, opts?: ToastOptions) => void;
    error: (message: string, opts?: ToastOptions) => void;
    info: (message: string, opts?: ToastOptions) => void;
  };
}

const DialogContext = React.createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

const TONE_ICON: Record<string, { icon: LucideIcon; chip: string }> = {
  danger: { icon: Trash2, chip: 'bg-danger/16' },
  warning: { icon: TriangleAlert, chip: 'bg-warning/16' },
  success: { icon: CircleCheck, chip: 'bg-success/16' },
  default: { icon: Info, chip: 'bg-info/16' },
};

let toastSeq = 0;

export function DialogProvider({
  children,
  initialFlash,
}: {
  children: React.ReactNode;
  initialFlash?: { success?: string | null; error?: string | null } | null;
}) {
  // One dialog at a time; later calls wait their turn.
  const queue = React.useRef<Pending[]>([]);
  const [current, setCurrent] = React.useState<Pending | null>(null);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const next = React.useCallback(() => {
    setCurrent(queue.current.shift() ?? null);
  }, []);

  const push = React.useCallback(
    (p: Pending) => {
      setCurrent((c) => {
        if (c) {
          queue.current.push(p);
          return c;
        }
        return p;
      });
    },
    [],
  );

  const dismissToast = React.useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const addToast = React.useCallback(
    (kind: ToastKind, message: string, opts?: ToastOptions) => {
      const id = ++toastSeq;
      setToasts((t) => [...t.slice(-3), { id, kind, message, ...opts }]);
      setTimeout(() => dismissToast(id), opts?.duration ?? (opts?.action ? 6000 : 3800));
    },
    [dismissToast],
  );

  const api = React.useMemo<DialogApi>(
    () => ({
      confirm: (opts) => new Promise<boolean>((resolve) => push({ id: ++toastSeq, kind: 'confirm', opts, resolve })),
      alert: (opts) => new Promise<void>((resolve) => push({ id: ++toastSeq, kind: 'alert', opts, resolve })),
      prompt: (opts) => new Promise<string | null>((resolve) => push({ id: ++toastSeq, kind: 'prompt', opts, resolve })),
      toast: {
        success: (m, o) => addToast('success', m, o),
        error: (m, o) => addToast('error', m, o),
        info: (m, o) => addToast('info', m, o),
      },
    }),
    [push, addToast],
  );

  // Laravel flash messages and `errors.message` -> toasts
  React.useEffect(() => {
    if (initialFlash?.success) addToast('success', initialFlash.success);
    if (initialFlash?.error) addToast('error', initialFlash.error);
    const offNav = router.on('navigate', (e) => {
      const flash = (e.detail.page.props as any).flash;
      if (flash?.success) addToast('success', flash.success);
      if (flash?.error) addToast('error', flash.error);
    });
    const offErr = router.on('error', (e) => {
      const msg = (e.detail.errors as Record<string, string>)?.message;
      if (msg) addToast('error', msg);
    });
    // Server rejected the request (e.g. a function the active organization does not have): explain, don't dump HTML
    const offHttp = router.on('httpException', (e) => {
      const status = e.detail.response.status;
      const msg: Record<number, string> = {
        403: 'Bạn không có quyền thực hiện thao tác này trong tổ chức hiện tại.',
        404: 'Không tìm thấy dữ liệu yêu cầu.',
        419: 'Phiên làm việc đã hết hạn. Hãy tải lại trang rồi thử lại.',
      };
      if (msg[status]) {
        addToast('error', msg[status]);
        return false;
      }
    });
    return () => {
      offNav();
      offErr();
      offHttp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current?.kind === 'confirm' && (
        <ConfirmView
          key={current.id}
          opts={current.opts}
          onDone={(v) => {
            current.resolve(v);
            next();
          }}
        />
      )}
      {current?.kind === 'alert' && (
        <AlertView
          key={current.id}
          opts={current.opts}
          onDone={() => {
            current.resolve();
            next();
          }}
        />
      )}
      {current?.kind === 'prompt' && (
        <PromptView
          key={current.id}
          opts={current.opts}
          onDone={(v) => {
            current.resolve(v);
            next();
          }}
        />
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </DialogContext.Provider>
  );
}

function Header({ tone, icon, title, text }: { tone: string; icon?: LucideIcon; title: string; text?: React.ReactNode }) {
  const t = TONE_ICON[tone] ?? TONE_ICON.default;
  const Icon = icon ?? t.icon;
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className={cn('flex size-11 items-center justify-center rounded-xl', t.chip)}>
        <Icon className="size-5" />
      </div>
      <div className="text-[17px] font-semibold">{title}</div>
      {text && <div className="text-sm leading-relaxed text-muted-foreground">{text}</div>}
    </div>
  );
}

function ConfirmView({ opts, onDone }: { opts: ConfirmOptions; onDone: (v: boolean) => void }) {
  const [typed, setTyped] = React.useState('');
  const ok = !opts.requireText || typed.trim().toUpperCase() === opts.requireText.toUpperCase();
  const tone = opts.tone ?? 'default';
  return (
    <Modal
      open
      onClose={() => onDone(false)}
      width={470}
      footer={
        <>
          <FxButton onClick={() => onDone(false)}>{opts.cancelLabel ?? 'Hủy'}</FxButton>
          <FxButton variant={tone === 'danger' ? 'danger' : 'primary'} disabled={!ok} onClick={() => onDone(true)} autoFocus={!opts.requireText}>
            {opts.confirmLabel ?? (tone === 'danger' ? 'Xóa' : 'Xác nhận')}
          </FxButton>
        </>
      }
    >
      <Header tone={tone} icon={opts.icon} title={opts.title} text={opts.text} />
      {opts.warn && (
        <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger-fg">
          <TriangleAlert className="size-3.5 shrink-0" />
          {opts.warn}
        </div>
      )}
      {opts.requireText && (
        <Field
          label={
            <>
              Nhập <span className="font-mono text-danger-fg">{opts.requireText}</span> để xác nhận
            </>
          }
        >
          <FxInput
            mono
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ok && onDone(true)}
          />
        </Field>
      )}
    </Modal>
  );
}

function AlertView({ opts, onDone }: { opts: AlertOptions; onDone: () => void }) {
  return (
    <Modal
      open
      onClose={onDone}
      width={440}
      footer={
        <FxButton variant="primary" onClick={onDone} autoFocus>
          {opts.okLabel ?? 'Đã hiểu'}
        </FxButton>
      }
    >
      <Header tone={opts.tone ?? 'default'} title={opts.title} text={opts.text} />
    </Modal>
  );
}

function PromptView({ opts, onDone }: { opts: PromptOptions; onDone: (v: string | null) => void }) {
  const [value, setValue] = React.useState(opts.initial ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const submit = () => {
    const err = opts.validate?.(value) ?? null;
    if (err) return setError(err);
    onDone(value);
  };
  return (
    <Modal
      open
      onClose={() => onDone(null)}
      width={480}
      title={opts.title}
      desc={opts.text}
      footer={
        <>
          <FxButton onClick={() => onDone(null)}>Hủy</FxButton>
          <FxButton variant="primary" onClick={submit}>
            {opts.confirmLabel ?? 'Lưu'}
          </FxButton>
        </>
      }
    >
      <Field label={opts.label ?? ''} error={error ?? undefined}>
        {opts.multiline ? (
          <FxTextarea autoFocus rows={4} value={value} placeholder={opts.placeholder} onChange={(e) => setValue(e.target.value)} />
        ) : (
          <FxInput
            autoFocus
            value={value}
            placeholder={opts.placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        )}
      </Field>
    </Modal>
  );
}

const TOAST_ICON: Record<ToastKind, LucideIcon> = { success: CircleCheck, error: CircleAlert, info: Info };

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[130] flex w-[min(380px,calc(100vw-48px))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-popover px-4 py-3 text-sm shadow-[0_12px_32px_rgb(0_0_0/0.5)]"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', t.kind === 'success' && 'text-success', t.kind === 'error' && 'text-danger', t.kind === 'info' && 'text-info')} />
            <span className="min-w-0 flex-1 leading-snug">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 cursor-pointer text-[13px] font-semibold text-brand-fg"
                onClick={() => {
                  t.action!.onClick();
                  onDismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Đóng" className="shrink-0 cursor-pointer opacity-50 hover:opacity-100" onClick={() => onDismiss(t.id)}>
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
