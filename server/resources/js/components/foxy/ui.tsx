/**
 * FoxyExam Screens v2 — shared building blocks.
 * Every admin screen is composed from these so spacing, radii and tones stay
 * identical to the Claude Design source ("FoxyExam Screens v2.dc.html").
 */
import * as React from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, X, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'danger' | 'violet' | 'outline';

const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-foreground/85',
  brand: 'bg-primary/15 text-brand-fg',
  success: 'bg-success/15 text-success-fg',
  warning: 'bg-warning/15 text-warning-fg',
  info: 'bg-info/15 text-info-fg',
  danger: 'bg-danger/15 text-danger-fg',
  violet: 'bg-violet/20 text-violet-fg',
  outline: 'border border-border text-muted-foreground',
};

/** Chip tint behind an icon (stat tiles, type cards). */
export const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-muted',
  brand: 'bg-primary/25',
  success: 'bg-success/25',
  warning: 'bg-warning/25',
  info: 'bg-info/25',
  danger: 'bg-danger/25',
  violet: 'bg-violet/25',
  outline: 'border border-border',
};

/** Solid dot / bar colour. */
export const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-muted-foreground/60',
  brand: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  danger: 'bg-danger',
  violet: 'bg-violet',
  outline: 'bg-border',
};

export function Pill({
  tone = 'neutral',
  mono,
  size = 'md',
  className,
  children,
}: {
  tone?: Tone;
  mono?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md font-medium',
        size === 'sm' ? 'px-[7px] py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        mono && 'font-mono font-semibold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral', pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  if (!pulse) return <span className={cn('inline-block size-[7px] shrink-0 rounded-full', TONE_DOT[tone], className)} />;
  return (
    <span className={cn('relative flex size-2 shrink-0', className)}>
      <span className={cn('absolute inset-0 rounded-full animate-[fxpulse_1.4s_ease-out_infinite]', TONE_DOT[tone])} />
      <span className={cn('relative size-2 rounded-full', TONE_DOT[tone])} />
    </span>
  );
}

/** Card surface used for every content block inside the page panel. */
export function Panel({
  className,
  padded = true,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-border bg-card', padded && 'p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelTitle({
  title,
  desc,
  actions,
  className,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-2', className)}>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        {desc && <div className="mt-0.5 text-[13px] text-muted-foreground">{desc}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bordered header row inside a padding-less Panel. */
export function PanelBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b border-border px-4 py-3', className)}>{children}</div>
  );
}

export function PageHeader({
  title,
  desc,
  badges,
  onBack,
  leading,
  actions,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  badges?: React.ReactNode;
  onBack?: () => void;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
      {onBack && <IconButton icon={ArrowLeft} label="Quay lại" onClick={onBack} className="mt-0.5 size-8" />}
      {leading}
      <div className="min-w-0 flex-[1_1_260px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="m-0 text-lg font-semibold leading-snug text-balance sm:text-xl">{title}</h1>
          {badges}
        </div>
        {desc && <div className="mt-1 max-w-[80ch] text-[13px] leading-relaxed text-muted-foreground">{desc}</div>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:max-sm:flex-1">{actions}</div>}
    </div>
  );
}

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-primary text-primary-foreground font-semibold hover:bg-primary/90',
  outline: 'border border-border bg-card text-foreground font-medium hover:bg-muted',
  ghost: 'text-foreground font-medium hover:bg-muted',
  danger: 'bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90',
};

export const FxButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: LucideIcon; iconRight?: LucideIcon }
>(({ variant = 'outline', size = 'md', icon: Icon, iconRight: IconRight, className, children, type = 'button', ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-45',
      size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3 text-sm',
      variant === 'primary' && size === 'md' && 'px-3.5',
      BTN[variant],
      className,
    )}
    {...rest}
  >
    {Icon && <Icon className="size-4 opacity-80" />}
    {children}
    {IconRight && <IconRight className="size-4 opacity-80" />}
  </button>
));
FxButton.displayName = 'FxButton';

export function IconButton({
  icon: Icon,
  label,
  className,
  danger,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted',
        danger && 'hover:bg-danger/15 hover:text-danger-fg',
        className,
      )}
      {...rest}
    >
      <Icon className="size-[15px]" />
    </button>
  );
}

export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  icon: Icon,
  tone = 'brand',
  bar,
}: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  tone?: Tone;
  bar?: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <div className={cn('flex size-8 items-center justify-center rounded-lg', TONE_CHIP[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-bold tabular-nums tracking-tight">{value}</span>
        {delta != null && (
          <span
            className={cn(
              'text-xs',
              deltaTone === 'up' && 'font-medium text-success-fg',
              deltaTone === 'down' && 'font-medium text-danger-fg',
              deltaTone === 'neutral' && 'text-muted-foreground',
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {bar != null && <Meter value={bar} />}
    </div>
  );
}

/** Thin progress bar; turns red above 85% like the quota bars in the design. */
export function Meter({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full', pct > 85 ? 'bg-danger' : 'bg-primary')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  stretch,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  stretch?: boolean;
}) {
  return (
    <div role="radiogroup" className={cn('flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-0.5', stretch && 'w-full', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'shrink-0 cursor-pointer whitespace-nowrap rounded-md px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              stretch && 'flex-1',
              on ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Underlined numbered tabs used by the wizards (Soạn bài, Bộ đề, Tạo kỳ thi). */
export function StepTabs({
  labels,
  current,
  done = [],
  onChange,
}: {
  labels: string[];
  current: number;
  done?: number[];
  onChange: (i: number) => void;
}) {
  return (
    <div className="-mt-1 flex gap-0.5 overflow-x-auto border-b border-border">
      {labels.map((label, i) => {
        const on = i === current;
        const ok = done.includes(i) && !on;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(i)}
            className={cn(
              'flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-3.5 text-sm font-medium',
              on ? 'text-foreground shadow-[inset_0_-2px_0_var(--primary)]' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[11px] font-bold',
                ok ? 'bg-success/20 text-success-fg' : on ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/85',
              )}
            >
              {ok ? <Check className="size-3" /> : i + 1}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function StepFooter({
  labels,
  current,
  onChange,
  lastAction,
}: {
  labels: string[];
  current: number;
  onChange: (i: number) => void;
  lastAction?: React.ReactNode;
}) {
  const last = current >= labels.length - 1;
  return (
    <div className="sticky bottom-0 z-[5] flex items-center gap-3 rounded-xl border border-border bg-card/85 px-4 py-3 backdrop-blur-md">
      <FxButton icon={ArrowLeft} disabled={current === 0} onClick={() => onChange(Math.max(0, current - 1))}>
        Trước
      </FxButton>
      <span className="flex-1 text-center text-[13px] text-muted-foreground">
        Bước {current + 1}/{labels.length} · {labels[current]}
      </span>
      {last && lastAction ? (
        lastAction
      ) : (
        <FxButton variant="primary" iconRight={ArrowRight} disabled={last} onClick={() => onChange(Math.min(labels.length - 1, current + 1))}>
          Tiếp
        </FxButton>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors',
        checked ? 'justify-end bg-primary' : 'justify-start bg-foreground/20',
      )}
    >
      <span className="block size-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}

export interface ToggleItem {
  key: string;
  label: string;
  desc?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** a sub-option of the item above it: indented, and off + locked while its parent is off */
  indent?: boolean;
  badge?: React.ReactNode;
}

export function ToggleList({ items }: { items: ToggleItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((it, i) => (
        <div
          key={it.key}
          className={cn(
            'flex items-center gap-3 py-3',
            i < items.length - 1 && 'border-b border-border',
            it.indent && 'ml-5 border-l-2 border-l-border pl-4',
            it.disabled && 'opacity-60',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {it.label}
              {it.badge}
            </div>
            {it.desc && <div className="mt-0.5 text-xs text-muted-foreground">{it.desc}</div>}
          </div>
          <Switch checked={it.checked} onChange={(v) => !it.disabled && it.onChange(v)} label={it.label} />
        </div>
      ))}
    </div>
  );
}

export function RadioCards<T extends string | number>({
  options,
  value,
  onChange,
  minWidth = 200,
}: {
  options: { value: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
  minWidth?: number;
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${minWidth}px,1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'flex cursor-pointer flex-col items-start gap-1.5 rounded-[10px] border p-3.5 text-left transition-colors',
              on ? 'border-primary bg-primary/8' : 'border-border bg-card hover:border-foreground/20',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn('size-3.5 shrink-0 rounded-full', on ? 'border-4 border-primary' : 'border-2 border-foreground/30')} />
              {o.label}
            </span>
            {o.desc && <span className="text-xs leading-[1.45] text-muted-foreground">{o.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}

interface FieldCtx {
  id: string;
  describedBy?: string;
  invalid: boolean;
}
const FieldContext = React.createContext<FieldCtx | null>(null);

/**
 * Label + control + hint/error. The control inside (FxInput, FxSelect, FxTextarea) is wired to the label and to the
 * hint/error for screen readers automatically. `required` adds a star, `optional` a quiet "tuỳ chọn".
 */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  aside,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  /** small action at the right of the label (e.g. "Tạo từ tên") */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  const msgId = `${id}-msg`;
  return (
    <FieldContext.Provider value={{ id, describedBy: hint || error ? msgId : undefined, invalid: !!error }}>
      <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={id} className="text-[13px] font-medium text-foreground">
            {label}
            {required && <span className="ml-0.5 text-danger-fg" aria-hidden>*</span>}
            {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">tuỳ chọn</span>}
          </label>
          {aside && <span className="shrink-0 text-xs">{aside}</span>}
        </div>
        {children}
        {error ? (
          <span id={msgId} role="alert" className="text-xs text-danger-fg">
            {error}
          </span>
        ) : (
          hint && (
            <span id={msgId} className="text-xs leading-relaxed text-muted-foreground">
              {hint}
            </span>
          )
        )}
      </div>
    </FieldContext.Provider>
  );
}

/** id / aria props of the Field a control sits in (an explicit id on the control wins). */
function useFieldProps(id?: string) {
  const ctx = React.useContext(FieldContext);
  if (!ctx) return { id };
  return { id: id ?? ctx.id, 'aria-describedby': ctx.describedBy, 'aria-invalid': ctx.invalid || undefined };
}

/**
 * Two-column form block: what the section is about on the left, its fields on the right. Stacks on narrow screens.
 * Use it for long forms so people can scan the sections instead of reading every label.
 */
export function FormSection({ title, desc, children, className }: { title: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-4 border-b border-border py-6 first:pt-0 last:border-b-0 last:pb-0 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-10', className)}>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export const inputCls =
  'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger sm:h-9';

export const FxInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { suffix?: React.ReactNode; mono?: boolean }
>(({ className, suffix, mono, id, ...rest }, ref) => {
  const field = useFieldProps(id);
  if (!suffix) return <input ref={ref} className={cn(inputCls, mono && 'font-mono text-[13px]', className)} {...field} {...rest} />;
  return (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 transition-colors hover:border-foreground/25 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 sm:h-9',
        field['aria-invalid'] && 'border-danger',
        className,
      )}
    >
      <input ref={ref} className={cn('h-full min-w-0 flex-1 bg-transparent text-sm outline-none', mono && 'font-mono text-[13px]')} {...field} {...rest} />
      <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>
    </div>
  );
});
FxInput.displayName = 'FxInput';

export function FxSelect({ className, children, id, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useFieldProps(id);
  return (
    <select className={cn(inputCls, 'cursor-pointer pr-2', className)} {...field} {...rest}>
      {children}
    </select>
  );
}

export function FxTextarea({ className, id, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useFieldProps(id);
  return <textarea className={cn(inputCls, 'h-auto min-h-[88px] py-2 leading-relaxed sm:h-auto', className)} {...field} {...rest} />;
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-[22px]" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      {desc && <div className="max-w-[360px] text-sm text-muted-foreground">{desc}</div>}
      {action}
    </div>
  );
}

/** Striped placeholder used where a camera / screen feed renders. */
export function FeedPlaceholder({ label, className, children }: { label: string; className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn('relative flex aspect-[16/10] items-center justify-center', className)}
      style={{
        background:
          'repeating-linear-gradient(135deg, color-mix(in oklch, var(--foreground) 6%, var(--card)) 0 7px, color-mix(in oklch, var(--foreground) 3%, var(--card)) 7px 14px)',
      }}
    >
      <span className="font-mono text-[11px] text-muted-foreground/70">{label}</span>
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  desc,
  width = 620,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  desc?: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-[4px] sm:items-center sm:p-6">
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-[0_24px_64px_rgb(0_0_0/0.5)] outline-none sm:max-h-[90vh] sm:rounded-xl"
        style={{ maxWidth: width }}
      >
        {title && (
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold">{title}</div>
              {desc && <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{desc}</div>}
            </div>
            <IconButton icon={X} label="Đóng" onClick={onClose} className="-mr-1.5 -mt-0.5" />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-card px-5 py-3.5 [&>*]:max-sm:flex-1">{footer}</div>}
      </div>
    </div>
  );
}


/**
 * A small "?" that explains a technical term in plain words on hover / focus. Use it instead of putting jargon in the
 * main text: the sentence stays simple for teachers, the detail is one hover away.
 */
export function Tip({ children, label = 'Giải thích' }: { children: React.ReactNode; label?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={label} className="ml-1 inline-flex cursor-help align-middle text-muted-foreground hover:text-foreground focus-visible:text-foreground">
            <CircleHelp className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
