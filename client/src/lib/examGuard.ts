import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { reportViolation, sendOpLogBatch, type MonitoringConfig, type ViolationSeverity, type ViolationType } from "./api";
import {
  DEFAULT_BANNED_APPS,
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
export const LOCKDOWN = import.meta.env.PROD;

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
};

const externalKeyboards = (devices: Device[]) =>
  new Set(devices.filter((d) => d.kind === "keyboard" && d.hardwareId).map((d) => d.hardwareId)).size;

/**
 * Giám sát phòng thi dựa trên module Rust: bật khi `start()` (vào thi), tắt khi
 * `stop()` (nộp bài / rời phòng). Mọi vi phạm vừa hiện trong panel giám sát vừa
 * gửi lên server (`/student/violation`).
 */
export function useExamGuard(config: Partial<MonitoringConfig> | null | undefined) {
  const [state, setState] = useState<ExamGuardState>(INITIAL);
  const activeRef = useRef(false);
  const seq = useRef(0);
  const opLogSeq = useRef(0);
  const pasteCount = useRef(0);
  const cleanup = useRef<(() => void)[]>([]);

  const record = useCallback(
    (type: ViolationType, severity: ViolationSeverity, message: string, details?: Record<string, unknown>) => {
      const v: GuardViolation = { id: ++seq.current, type, severity, message, t: Date.now() };
      setState((s) => ({ ...s, violations: [v, ...s.violations].slice(0, 100) }));
      void reportViolation({ type, severity, details: { message, ...details } }).catch((err) =>
        console.error("[guard] Báo vi phạm lỗi:", err),
      );
    },
    [],
  );

  const flushKeylog = useCallback(async () => {
    try {
      const events = await drainKeylog();
      const downs = events.filter((e) => e.down);
      if (downs.length === 0 && pasteCount.current === 0) return;
      const injected = downs.filter((e) => e.injected).length;
      await sendOpLogBatch({
        batchSeq: ++opLogSeq.current,
        keystrokeCount: downs.filter((e) => !e.injected).length,
        pasteEventCount: pasteCount.current,
        syntheticFlags: injected > 0 ? { bulk_insert: true, chars_count: injected } : undefined,
      });
      pasteCount.current = 0;
    } catch (err) {
      console.error("[guard] Gửi op-log lỗi:", err);
    }
  }, []);

  const stop = useCallback(async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    cleanup.current.forEach((fn) => fn());
    cleanup.current = [];
    await flushKeylog();
    await stopMonitor().catch(() => {});
    if (LOCKDOWN) {
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(false).catch(() => {});
      await win.setFullscreen(false).catch(() => {});
    }
    setState(INITIAL);
  }, [flushKeylog]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    pasteCount.current = 0;
    setState({ ...INITIAL, active: true });

    const on = <T,>(off: () => T) => cleanup.current.push(off as () => void);

    on(
      onMonitor("monitor://foreground", (p) => {
        if (p.isSelf) return;
        record("WINDOW_LOST_FOCUS", "MEDIUM", `Chuyển sang ứng dụng khác: ${p.name || "không rõ"}${p.title ? ` — ${p.title}` : ""}`, {
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
        setState((s) => ({ ...s, bannedRunning: p.running }));
        if (p.running.length > 0) {
          const names = [...new Set(p.running.map((x) => x.name))].join(", ");
          record("BANNED_APP", "HIGH", `Đang chạy ứng dụng bị cấm: ${names}`, { processes: p.running });
        }
      }),
    );
    on(
      onMonitor("monitor://devices", (p) => {
        setState((s) => ({ ...s, displays: p.displays.length, microphones: p.microphones.length }));
        if (p.displays.length > 1) {
          record("MULTIPLE_MONITORS", "HIGH", `Phát hiện ${p.displays.length} màn hình`, { displays: p.displays });
        }
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

    const flushTimer = window.setInterval(() => void flushKeylog(), KEYLOG_FLUSH_MS);
    on(() => window.clearInterval(flushTimer));

    try {
      await startMonitor({
        watchDevices: true,
        watchProcesses: true,
        processIntervalMs: 1500,
        bannedApps: DEFAULT_BANNED_APPS,
        watchForeground: true,
        keyboardHook: true,
        blockShortcuts: LOCKDOWN,
      });
      const snap = await getSnapshot();
      const kb = externalKeyboards(snap.devices);
      setState((s) => ({
        ...s,
        displays: snap.displays.length,
        cameras: snap.devices.filter((d) => d.kind === "camera").length,
        microphones: snap.microphones.length,
        externalKeyboards: kb,
      }));
      if (snap.displays.length > 1) {
        record("MULTIPLE_MONITORS", "HIGH", `Vào phòng thi khi đang có ${snap.displays.length} màn hình`, { displays: snap.displays });
      }
      if (kb > 1) record("MULTIPLE_KEYBOARDS", "MEDIUM", `Phát hiện ${kb} bàn phím ngoài`);
    } catch (err) {
      console.error("[guard] Không bật được giám sát:", err);
    }

    if (LOCKDOWN) {
      const win = getCurrentWindow();
      await win.setFullscreen(true).catch(() => {});
      await win.setAlwaysOnTop(true).catch(() => {});
    }
  }, [record, flushKeylog]);

  // Chặn dán (nếu cấu hình yêu cầu) — mọi lần dán đều được đếm vào op-log.
  const onPaste = useCallback(
    (e: ClipboardEvent, extra?: { problemId?: number }) => {
      pasteCount.current += 1;
      const text = e.clipboardData.getData("text");
      const max = config?.max_paste_chars ?? 80;
      if (config?.prevent_paste && text.length > max) {
        e.preventDefault();
        record("BULK_PASTE", "HIGH", `Dán ${text.length} ký tự (vượt ngưỡng ${max}) — đã chặn`, {
          pasted_chars: text.length,
          programming_problem_id: extra?.problemId,
        });
      }
    },
    [config, record],
  );

  useEffect(() => () => void stop(), [stop]);

  // Màn hình bị che khi có app cấm hoặc nhiều màn hình — tự mở lại khi khắc phục.
  const blockReason = !state.active
    ? null
    : state.bannedRunning.length > 0
      ? `Hãy đóng ứng dụng bị cấm: ${[...new Set(state.bannedRunning.map((p) => p.name))].join(", ")}`
      : state.displays > 1
        ? `Hãy ngắt kết nối màn hình phụ (đang có ${state.displays} màn hình)`
        : null;

  return { ...state, blockReason, start, stop, onPaste };
}
