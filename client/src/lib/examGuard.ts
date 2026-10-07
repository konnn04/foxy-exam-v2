import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { reportViolation, sendOpLogBatch, type MonitoringConfig, type ViolationSeverity, type ViolationType } from "./api";
import { bypass } from "./dev";
import { type RealtimeClient } from "./realtime";
import {
  DEFAULT_BANNED_APPS,
  captureDevices,
  screenCount,
  drainKeylog,
  getSnapshot,
  onMonitor,
  startMonitor,
  stopMonitor,
  type Device,
  type ProcessInfo,
} from "./monitor";

/**
 * Khoá máy (toàn màn hình + luôn trên cùng + chặn phím tắt hệ thống) chỉ bật ở
 * bản build production — chạy `tauri dev` vẫn thấy & báo vi phạm nhưng không
 * khoá máy, để lập trình viên không bị kẹt.
 */
export const lockdownOn = () => !bypass("lockdown");

const KEYLOG_FLUSH_MS = 15_000;

export interface GuardViolation {
  id: number;
  type: ViolationType;
  message: string;
  severity: ViolationSeverity;
  t: number;
}

export interface ExamGuardState {
  active: boolean;
  violations: GuardViolation[];
  bannedRunning: ProcessInfo[];
  displays: number;
  cameras: number;
  microphones: number;
  externalKeyboards: number;
  /** Lý do màn hình làm bài đang bị che (phải khắc phục mới làm tiếp được). */
  blockReason: string | null;
  /** The foreground app is one the exam allows (e.g. Visual Studio): the exam window then steps aside. */
  allowedForeground: boolean;
}

const INITIAL: ExamGuardState = {
  active: false,
  violations: [],
  bannedRunning: [],
  displays: 0,
  cameras: 0,
  microphones: 0,
  externalKeyboards: 0,
  blockReason: null,
  allowedForeground: false,
};

const DEDUPE_MS = 2000;

const procName = (n: string) => n.toLowerCase().replace(/\.exe$/, "");

const externalKeyboards = (devices: Device[]) =>
  new Set(devices.filter((d) => d.kind === "keyboard" && d.hardwareId).map((d) => d.hardwareId)).size;

/**
 * Giám sát phòng thi dựa trên module Rust: bật khi `start()` (vào thi), tắt khi
 * `stop()` (nộp bài / rời phòng). Mọi vi phạm vừa hiện trong panel giám sát vừa
 * gửi lên server (`/student/violation`).
 */
export function useExamGuard(config: Partial<MonitoringConfig> | null | undefined, rt?: RealtimeClient | null) {
  const [state, setState] = useState<ExamGuardState>(INITIAL);
  const activeRef = useRef(false);
  const seq = useRef(0);
  const opLogSeq = useRef(0);
  const pasteCount = useRef(0);
  const cleanup = useRef<(() => void)[]>([]);
  const clipboardHandled = useRef<WeakSet<Event> | null>(null);
  const allowedApps = useRef<string[]>([]);
  const lastSeen = useRef(new Map<string, number>());
  const blockClipboard = useRef(true);
  blockClipboard.current = config?.prevent_paste !== false;
  allowedApps.current = (config?.allowed_apps ?? []).map(procName);

  const record = useCallback(
    (type: ViolationType, severity: ViolationSeverity, message: string, details?: Record<string, unknown>) => {
      // one physical action often raises several identical events (Alt+Tab, a focus flicker): report it once
      const subject = type === "WINDOW_LOST_FOCUS" || type === "APP_NOT_ALLOWED" ? String(details?.process ?? message) : message;
      const key = `${type}|${subject}`;
      const now = Date.now();
      if (now - (lastSeen.current.get(key) ?? 0) < DEDUPE_MS) return;
      lastSeen.current.set(key, now);
      const v: GuardViolation = { id: ++seq.current, type, severity, message, t: Date.now() };
      setState((s) => ({ ...s, violations: [v, ...s.violations].slice(0, 100) }));
      if (rt?.enabled) {
        // batched with everything else (about once a second); the original type is kept in details
        rt.emit("violation", {
          violation_type: type,
          severity,
          details: { message, client_type: type, ...details },
        });
      } else {
        void reportViolation({ type, severity, details: { message, ...details } }).catch((err) =>
          console.error("[guard] Báo vi phạm lỗi:", err),
        );
      }
    },
    [rt],
  );

  const flushKeylog = useCallback(async () => {
    try {
      const events = await drainKeylog();
      const downs = events.filter((e) => e.down);
      if (downs.length === 0 && pasteCount.current === 0) return;
      const injected = downs.filter((e) => e.injected).length;
      const flags = injected > 0 ? { bulk_insert: true, chars_count: injected } : undefined;
      if (rt?.enabled) {
        rt.emit("oplog", {
          batch_seq: ++opLogSeq.current,
          keystroke_count: downs.filter((e) => !e.injected).length,
          paste_event_count: pasteCount.current,
          synthetic_flags: flags,
          // compact keystroke stream [vk, t, injected] for replay; archived to object storage by the worker
          raw_ops_payload: JSON.stringify(downs.slice(0, 3000).map((e) => [e.vk, e.t, e.injected ? 1 : 0])),
        });
      } else {
        await sendOpLogBatch({
          batchSeq: ++opLogSeq.current,
          keystrokeCount: downs.filter((e) => !e.injected).length,
          pasteEventCount: pasteCount.current,
          syntheticFlags: flags,
        });
      }
      pasteCount.current = 0;
    } catch (err) {
      console.error("[guard] Gửi op-log lỗi:", err);
    }
  }, [rt]);

  const stop = useCallback(async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    cleanup.current.forEach((fn) => fn());
    cleanup.current = [];
    await flushKeylog();
    await stopMonitor().catch(() => {});
    if (lockdownOn()) {
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(false).catch(() => {});
      await win.setFullscreen(false).catch(() => {});
    }
    setState(INITIAL);
  }, [flushKeylog]);

  const start = useCallback(async (cfg?: Partial<MonitoringConfig> | null) => {
    if (activeRef.current) return;
    activeRef.current = true;
    // the exam paper (and so its config) usually arrives in the same tick that starts the guard: read it from here, not from a stale render
    if (cfg) {
      allowedApps.current = (cfg.allowed_apps ?? []).map(procName);
      blockClipboard.current = cfg.prevent_paste !== false;
    }
    pasteCount.current = 0;
    setState({ ...INITIAL, active: true });

    const on = <T,>(off: () => T) => cleanup.current.push(off as () => void);

    on(
      onMonitor("monitor://foreground", (p) => {
        const allowed = allowedApps.current.includes(procName(p.name));
        rt?.setState({ focus: p.isSelf || allowed });
        setState((st) => (st.allowedForeground === allowed && !p.isSelf ? st : { ...st, allowedForeground: allowed && !p.isSelf }));
        if (p.isSelf || allowed) return;
        // with an allow-list the offence is "app not allowed", otherwise plain loss of focus
        record(allowedApps.current.length > 0 ? "APP_NOT_ALLOWED" : "WINDOW_LOST_FOCUS", "MEDIUM", `Chuyển sang ứng dụng khác: ${p.name || "không rõ"}${p.title ? ` — ${p.title}` : ""}`, {
          process: p.name,
          title: p.title,
        });
      }),
    );
    on(
      onMonitor("monitor://shortcut", (p) =>
        record("SYSTEM_SHORTCUT", p.blocked ? "LOW" : "MEDIUM", `Nhấn ${p.combo}${p.blocked ? " (đã chặn)" : ""}`, { combo: p.combo }),
      ),
    );
    on(
      onMonitor("monitor://synthetic-input", (p) =>
        record("SYNTHETIC_INPUT", "HIGH", `Phát hiện ${p.count} phím do phần mềm giả lập`, { count: p.count }),
      ),
    );
    on(
      onMonitor("monitor://banned-app", (p) => {
        if (bypass("devices")) return; // dev: OBS & co do not lock the exam
        setState((s) => ({ ...s, bannedRunning: p.running }));
        if (p.running.length > 0) {
          const names = [...new Set(p.running.map((x) => x.name))].join(", ");
          record("BANNED_APP", "HIGH", `Đang chạy ứng dụng bị cấm: ${names}`, { processes: p.running });
        }
      }),
    );
    on(
      onMonitor("monitor://devices", (p) => {
        setState((s) => ({ ...s, displays: bypass("devices") ? Math.min(1, p.displays.length) : p.displays.length, microphones: p.microphones.length }));
        if (bypass("devices")) return;
        void getSnapshot().then((snap) => {
          const screens = screenCount(snap.displays, snap.devices);
          const cards = captureDevices(snap.devices);
          setState((st) => ({ ...st, displays: screens }));
          if (screens > 1) record("MULTIPLE_MONITORS", "HIGH", `Phát hiện ${screens} màn hình`, { displays: snap.displays });
          if (cards.length > 0) record("CAPTURE_DEVICE", "HIGH", `Có thiết bị capture: ${cards.map((c) => c.name).join(", ")}`, { devices: cards.map((c) => c.name) });
        });
        const changed = [...p.added.map((d) => ({ ...d, action: "cắm" })), ...p.removed.map((d) => ({ ...d, action: "rút" }))];
        if (changed.length > 0) {
          void getSnapshot().then((snap) =>
            setState((s) => ({
              ...s,
              cameras: snap.devices.filter((d) => d.kind === "camera").length,
              externalKeyboards: externalKeyboards(snap.devices),
            })),
          );
          const list = changed.map((d) => `${d.action} ${d.name}`).join(", ");
          record("DEVICE_CHANGED", "MEDIUM", `Thay đổi thiết bị: ${list}`, { added: p.added, removed: p.removed });
        }
      }),
    );

    // Clipboard lockdown: paste, copy, cut and dropped text are refused everywhere in the window unless the exam allows them
    const handled = new WeakSet<Event>();
    const refuse = (e: Event) => {
      if (!blockClipboard.current) return;
      e.preventDefault();
      e.stopPropagation();
      handled.add(e);
      if (e.type === "paste") {
        const text = (e as unknown as { clipboardData?: DataTransfer }).clipboardData?.getData("text") ?? "";
        pasteCount.current += 1;
        record("BULK_PASTE", text.length > 100 ? "CRITICAL" : "HIGH", `Cố dán ${text.length} ký tự — đã chặn`, { pasted_chars: text.length });
      }
    };
    const events = ["paste", "copy", "cut", "drop"] as const;
    events.forEach((n) => document.addEventListener(n, refuse, true));
    on(() => events.forEach((n) => document.removeEventListener(n, refuse, true)));
    clipboardHandled.current = handled;

    const flushTimer = window.setInterval(() => void flushKeylog(), KEYLOG_FLUSH_MS);
    on(() => window.clearInterval(flushTimer));

    // presence signals for the proctor dashboard: window focus + fullscreen, sent with every heartbeat
    rt?.setState({ focus: document.hasFocus(), fullscreen: !lockdownOn() });
    const onFocus = () => rt?.setState({ focus: true });
    const onBlur = () => rt?.setState({ focus: false });
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    on(() => window.removeEventListener("focus", onFocus));
    on(() => window.removeEventListener("blur", onBlur));

    // Lockdown: keep the exam window fullscreen, on top and focused. Re-asserted every 1.5 s because another
    // always-on-top window (or Alt+Tab) can take the top spot at any time. With an allow-list the candidate
    // must be able to open the allowed software, so the window is not forced and the app is only watched.
    if (allowedApps.current.length === 0) {
      const win = getCurrentWindow();
      let busy = false;
      let locked = false;
      const enforce = async () => {
        if (busy || !activeRef.current) return;
        busy = true;
        try {
          if (!lockdownOn()) {
            // a dev bypass switched on mid-exam: let go of the window right away
            if (locked) {
              locked = false;
              await win.setAlwaysOnTop(false).catch(() => {});
              await win.setFullscreen(false).catch(() => {});
            }
            return;
          }
          locked = true;
          if (await win.isMinimized()) {
            await win.unminimize();
            record("WINDOW_LOST_FOCUS", "MEDIUM", "Thu nhỏ cửa sổ thi");
          }
          const fs = await win.isFullscreen();
          rt?.setState({ fullscreen: fs });
          if (!fs) await win.setFullscreen(true);
          await win.setAlwaysOnTop(true);
          if (!(await win.isFocused())) await win.setFocus();
        } catch {
          /* a failed enforcement round is retried on the next tick */
        } finally {
          busy = false;
        }
      };
      void enforce();
      const t = window.setInterval(() => void enforce(), 1500);
      on(() => window.clearInterval(t));
    }

    try {
      await startMonitor({
        watchDevices: true,
        watchProcesses: true,
        processIntervalMs: 1500,
        bannedApps: DEFAULT_BANNED_APPS,
        watchForeground: true,
        keyboardHook: true,
        blockShortcuts: lockdownOn() && allowedApps.current.length === 0,
      });
      const snap = await getSnapshot();
      const kb = externalKeyboards(snap.devices);
      setState((s) => ({
        ...s,
        displays: bypass("devices") ? Math.min(1, screenCount(snap.displays, snap.devices)) : screenCount(snap.displays, snap.devices),
        cameras: snap.devices.filter((d) => d.kind === "camera").length,
        microphones: snap.microphones.length,
        externalKeyboards: kb,
      }));
      if (!bypass("devices")) {
        const screens = screenCount(snap.displays, snap.devices);
        if (screens > 1) {
          record("MULTIPLE_MONITORS", "HIGH", `Vào phòng thi khi đang có ${screens} màn hình`, { displays: snap.displays });
        }
        const cards = captureDevices(snap.devices);
        if (cards.length > 0) record("CAPTURE_DEVICE", "HIGH", `Có thiết bị capture: ${cards.map((c) => c.name).join(", ")}`, { devices: cards.map((c) => c.name) });
        if (kb > 1) record("MULTIPLE_KEYBOARDS", "MEDIUM", `Phát hiện ${kb} bàn phím ngoài`);
      }
    } catch (err) {
      console.error("[guard] Không bật được giám sát:", err);
    }

  }, [record, flushKeylog, rt]);

  // Chặn dán (nếu cấu hình yêu cầu) — mọi lần dán đều được đếm vào op-log.
  // Kept for the input elements: the document-level listener already refused and reported the paste
  const onPaste = useCallback((e: ClipboardEvent | React.ClipboardEvent, extra?: { problemId?: number }) => {
    const native = "nativeEvent" in e ? e.nativeEvent : e;
    if (clipboardHandled.current?.has(native) || !blockClipboard.current) return;
    e.preventDefault();
    record("BULK_PASTE", "HIGH", "Cố dán nội dung — đã chặn", { programming_problem_id: extra?.problemId });
  }, [record]);

  useEffect(() => () => void stop(), [stop]);

  // Màn hình bị che khi có app cấm hoặc nhiều màn hình — tự mở lại khi khắc phục.
  const blockReason = !state.active
    ? null
    : state.bannedRunning.length > 0
      ? `Hãy đóng ứng dụng bị cấm: ${[...new Set(state.bannedRunning.map((p) => p.name))].join(", ")}`
      : state.displays > 1
        ? `Hãy ngắt kết nối màn hình phụ (đang có ${state.displays} màn hình)`
        : null;

  return { ...state, blockReason, start, stop, onPaste, report: record };
}
