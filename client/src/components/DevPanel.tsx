import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { DEV_FLAGS, IS_DEV, bypass, setBypass } from "../lib/dev";
import { cx } from "./ui";

/**
 * Floating dev-bypass switchboard. Renders nothing in production builds
 * (IS_DEV is a build-time constant, so this component is also tree-shaken).
 */
export function DevPanel({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const on = () => tick((n) => n + 1);
    window.addEventListener("foxy:dev-bypass", on);
    return () => window.removeEventListener("foxy:dev-bypass", on);
  }, []);

  if (!IS_DEV) return null;
  const active = DEV_FLAGS.filter((f) => bypass(f.flag)).length;

  return (
    <div className={cx("fixed bottom-9 right-3 z-[60] text-xs", className)}>
      {open && (
        <div className="mb-2 w-72 rounded-xl border border-warning/50 bg-surface p-3 shadow-2xl">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-warning">Dev bypass — chỉ có ở bản dev</p>
          <div className="space-y-1.5">
            {DEV_FLAGS.map((f) => (
              <label key={f.flag} className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-surface-2">
                <input type="checkbox" className="mt-0.5" checked={bypass(f.flag)} onChange={(e) => setBypass(f.flag, e.target.checked)} />
                <span>
                  <span className="block text-fg">{f.label}</span>
                  <span className="block text-[10px] text-subtle">{f.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-subtle">Cần vào lại phòng thi để áp dụng cờ khoá máy / realtime.</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-auto flex items-center gap-1.5 rounded-full border border-warning/60 bg-surface px-2.5 py-1 font-mono text-[10px] font-semibold text-warning shadow-lg"
      >
        <FlaskConical size={12} /> DEV{active > 0 ? ` · ${active}` : ""}
      </button>
    </div>
  );
}
