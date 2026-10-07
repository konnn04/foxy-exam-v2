import { useCallback, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * Drag-to-resize for panes: `size` is the width (axis "x") or height (axis "y") in pixels, remembered per `key`.
 * `grow` is +1 when dragging right / down makes the pane bigger and -1 when it makes it smaller.
 */
export function useResizable(key: string, initial: number, min: number, max: number, axis: "x" | "y", grow: 1 | -1 = 1) {
  const storageKey = `foxy:size:${key}`;
  const [size, setSize] = useState(() => {
    try {
      const v = Number(localStorage.getItem(storageKey));
      return v >= min && v <= max ? v : initial;
    } catch {
      return initial;
    }
  });
  const latest = useRef(size);
  latest.current = size;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const start = axis === "x" ? e.clientX : e.clientY;
      const from = latest.current;
      document.body.style.userSelect = "none";
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      const move = (m: PointerEvent) => {
        const delta = ((axis === "x" ? m.clientX : m.clientY) - start) * grow;
        setSize(Math.min(max, Math.max(min, from + delta)));
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        try {
          localStorage.setItem(storageKey, String(Math.round(latest.current)));
        } catch {
          /* the size is only a convenience */
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    },
    [axis, grow, max, min, storageKey],
  );

  return { size, onPointerDown, reset: () => setSize(initial) };
}

/** The thin draggable bar between two panes. */
export function ResizeHandle({ axis, onPointerDown, onDoubleClick }: { axis: "x" | "y"; onPointerDown: (e: React.PointerEvent) => void; onDoubleClick?: () => void }) {
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title="Kéo để đổi kích thước (nhấp đúp để đặt lại)"
      className={cx(
        "shrink-0 bg-line transition-colors hover:bg-accent/60 active:bg-accent",
        axis === "x" ? "w-[3px] cursor-col-resize" : "h-[3px] cursor-row-resize",
      )}
    />
  );
}
