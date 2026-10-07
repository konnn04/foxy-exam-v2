import type { ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

/**
 * Thanh tiêu đề tự vẽ cho cửa sổ `decorations: false`. Kéo để di chuyển,
 * nhấp đúp để phóng to (nếu `maximizable`). Nút đóng chỉ ẩn cửa sổ — app vẫn
 * chạy ở khay hệ thống (xem `on_window_event` trong lib.rs).
 */
export default function TitleBar({
  title,
  right,
  maximizable = true,
  closable = true,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  maximizable?: boolean;
  closable?: boolean;
  className?: string;
}) {
  const win = getCurrentWindow();

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input")) return;
    if (e.detail === 2 && maximizable) void win.toggleMaximize();
    else void win.startDragging();
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className={`flex h-9 shrink-0 items-center gap-2 border-b border-line bg-surface-2 pl-3 ${className}`}
    >
      <span className="h-3 w-3 rounded-[3px] bg-accent" />
      <span className="truncate text-xs text-muted">{title}</span>
      <div className="ml-auto flex items-center gap-3">{right}</div>
      <div className="flex h-full items-stretch">
        <WinButton label="Thu nhỏ" onClick={() => void win.minimize()}>
          <Minus size={14} />
        </WinButton>
        {maximizable && (
          <WinButton label="Phóng to" onClick={() => void win.toggleMaximize()}>
            <Square size={11} />
          </WinButton>
        )}
        {closable && (
          <WinButton label="Đóng" danger onClick={() => void win.close()}>
            <X size={15} />
          </WinButton>
        )}
      </div>
    </div>
  );
}

function WinButton({
  children,
  onClick,
  label,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex w-11 items-center justify-center text-muted transition ${
        danger ? "hover:bg-[#e81123] hover:text-white" : "hover:bg-surface-3 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
