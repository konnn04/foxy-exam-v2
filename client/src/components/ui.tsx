import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
  secondary: "border border-line bg-surface text-fg hover:bg-surface-3",
  ghost: "text-muted hover:bg-surface-3 hover:text-fg",
  danger: "bg-danger text-white hover:opacity-90",
  dark: "bg-fg text-app hover:opacity-90",
};

/** Hover tooltip for icon-only controls; `side` picks where the bubble opens. */
export function Tip({ label, children, side = "bottom", className }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left"; className?: string }) {
  return (
    <span className={cx("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute z-[90] w-max max-w-[240px] rounded-md bg-fg px-2 py-1 text-[11px] font-normal leading-snug text-app opacity-0 shadow-lg transition-opacity delay-150 group-hover/tip:opacity-100",
          side === "bottom" && "left-1/2 top-full mt-1.5 -translate-x-1/2",
          side === "top" && "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
          side === "left" && "right-full top-1/2 mr-1.5 -translate-y-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-8 px-3 text-xs",
        size === "lg" && "h-10 px-4 text-sm",
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; trailing?: ReactNode }
>(function Input({ icon, trailing, className, ...rest }, ref) {
  return (
    <div
      className={cx(
        "flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 transition focus-within:border-fg/60 focus-within:ring-2 focus-within:ring-fg/10",
        rest.disabled && "opacity-60",
        className,
      )}
    >
      {icon && <span className="text-subtle">{icon}</span>}
      <input ref={ref} className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle" {...rest} />
      {trailing}
    </div>
  );
});

type Tone = "neutral" | "accent" | "success" | "danger" | "warning" | "info" | "dark";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted border-line",
  accent: "bg-accent-soft text-accent-fg border-accent/30",
  success: "bg-success-soft text-success border-success/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  info: "bg-info-soft text-info border-info/25",
  dark: "bg-fg text-app border-fg",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

export function CardHeader({ icon, title, right }: { icon?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-4 py-3">
      {icon && <span className="text-muted">{icon}</span>}
      <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/** Ô vuông chữ viết tắt (mã tổ chức, mã môn...). */
export function CodeTile({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-3 font-mono text-[10px] font-semibold text-muted",
        className,
      )}
    >
      {code.slice(0, 3).toUpperCase()}
    </span>
  );
}

export function BrandMark({ subtitle, compact }: { subtitle?: string; compact?: boolean }) {
  return (
    <div className={cx("flex min-w-0 items-center gap-2.5", compact && "justify-center")}>
      <img src="/mark.png" alt="" className="h-9 w-9 shrink-0 object-contain" draggable={false} />
      <div className={cx("min-w-0 leading-tight", compact && "hidden")}>
        <p className="text-sm font-semibold text-fg">Foxy Exam</p>
        {subtitle && <p className="truncate text-[11px] text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Empty({ icon, text, className }: { icon?: ReactNode; text: string; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-xs text-subtle", className)}>
      {icon}
      {text}
    </div>
  );
}

export function Placeholder({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cx("stripes flex items-center justify-center rounded-xl border border-dashed border-line-strong", className)}>
      <span className="rounded border border-line bg-surface px-2 py-1 font-mono text-[10px] text-subtle">{label}</span>
    </div>
  );
}
