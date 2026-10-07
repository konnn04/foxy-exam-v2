/**
 * Dev-only bypasses for testing the exam flow without a proctoring-grade machine
 * (no camera, two monitors, OBS running...). Lockdown is ON in dev builds too; the `lockdown` flag turns it off.
 *
 * HARD RULE: every flag is `false` unless `import.meta.env.DEV` is true (`pnpm tauri dev` / `pnpm dev`).
 * Production builds replace DEV with `false` at build time, so these code paths are dead and tree-shaken —
 * a student can never turn a bypass on in a released client, whatever they put in localStorage.
 *
 * Turn flags on by either
 *   - the floating "DEV" panel (persisted in localStorage), or
 *   - `VITE_FOXY_DEV_BYPASS=all` / `VITE_FOXY_DEV_BYPASS=setup,camera,devices` in client/.env.development.local
 */
export const IS_DEV = import.meta.env.DEV;

export type DevFlag =
  | "setup" // skip the pre-exam device check ("lobby") entirely
  | "camera" // treat the camera as OK / not required, do not publish video
  | "screen" // treat screen sharing as OK / not required
  | "lockdown" // do not force fullscreen / always-on-top / shortcut blocking (lockdown is on in dev builds too)
  | "devices" // ignore extra monitors, banned apps and external keyboards (no lockdown block, no violations for them)
  | "realtime" // do not use the realtime plane, fall back to the plain REST endpoints
  | "protect" // allow screenshots / screen capture of the exam windows (content protection off)
  | "network"; // continue even when the server health check fails

export const DEV_FLAGS: { flag: DevFlag; label: string; hint: string }[] = [
  { flag: "setup", label: "Bỏ qua bước kiểm tra thiết bị", hint: "Vào thẳng phòng thi" },
  { flag: "camera", label: "Bỏ qua camera", hint: "Không cần camera, không phát video" },
  { flag: "screen", label: "Bỏ qua chia sẻ màn hình", hint: "Không cần quyền quay màn hình" },
  { flag: "lockdown", label: "Không khoá máy", hint: "Không ép toàn màn hình / luôn trên cùng / chặn phím tắt" },
  { flag: "devices", label: "Bỏ qua nhiều màn hình / app cấm", hint: "Không khoá bài khi có OBS, màn hình phụ…" },
  { flag: "realtime", label: "Tắt realtime (dùng REST)", hint: "Test đường dự phòng /student/violation, /op-log" },
  { flag: "protect", label: "Cho phép chụp / quay màn hình", hint: "Tắt chống chụp màn hình của cửa sổ thi để debug" },
  { flag: "network", label: "Bỏ qua kiểm tra mạng", hint: "Cho vào thi dù health check lỗi" },
];

const KEY = "foxy:dev-bypass";

function fromEnv(): Set<DevFlag> {
  const raw = (import.meta.env.VITE_FOXY_DEV_BYPASS as string | undefined)?.trim();
  if (!raw) return new Set();
  if (raw === "all" || raw === "1" || raw === "true") return new Set(DEV_FLAGS.map((f) => f.flag));
  return new Set(raw.split(",").map((s) => s.trim() as DevFlag));
}

function stored(): Set<DevFlag> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as DevFlag[]);
  } catch {
    return new Set();
  }
}

/** Is this bypass active right now? Always false outside dev builds. */
export function bypass(flag: DevFlag): boolean {
  if (!IS_DEV) return false;
  return fromEnv().has(flag) || stored().has(flag);
}

export function setBypass(flag: DevFlag, on: boolean): void {
  if (!IS_DEV) return;
  const s = stored();
  if (on) s.add(flag);
  else s.delete(flag);
  localStorage.setItem(KEY, JSON.stringify([...s]));
  window.dispatchEvent(new Event("foxy:dev-bypass"));
}

export function activeBypasses(): DevFlag[] {
  return IS_DEV ? DEV_FLAGS.map((f) => f.flag).filter(bypass) : [];
}
