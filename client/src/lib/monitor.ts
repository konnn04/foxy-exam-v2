import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Cầu nối tới module giám sát Rust (`src-tauri/src/monitor`). Lấy dữ liệu 1 lần
 * bằng các hàm `get*`; giám sát liên tục bằng `startMonitor` + `onMonitor`
 * (theo sự kiện, không cần polling phía JS).
 */

export type DeviceKind = "keyboard" | "mouse" | "camera" | "usb" | "display" | "capture";

export interface Device {
  id: string;
  name: string;
  class: string;
  kind: DeviceKind;
  /** `VID:PID` — gộp theo trường này để đếm thiết bị vật lý. */
  hardwareId: string | null;
}

export interface DisplayInfo {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

export interface AudioInput {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
}

export type ScreenCaptureStatus = "not_required" | "granted" | "denied" | "unknown";

export interface SystemSnapshot {
  os: string;
  displays: DisplayInfo[];
  devices: Device[];
  microphones: AudioInput[];
  screenCapture: ScreenCaptureStatus;
  processCount: number;
}

export interface KeyEvent {
  vk: number;
  down: boolean;
  t: number;
  injected: boolean;
  foreign: boolean;
}

export interface MonitorConfig {
  watchDevices?: boolean;
  watchProcesses?: boolean;
  processIntervalMs?: number;
  /** `discord` = đúng tên, `obs*` = tiền tố. Không phân biệt hoa thường, bỏ `.exe`. */
  bannedApps?: string[];
  watchForeground?: boolean;
  keyboardHook?: boolean;
  blockShortcuts?: boolean;
}

export interface MonitorEvents {
  "monitor://devices": {
    added: Device[];
    removed: Device[];
    displays: DisplayInfo[];
    microphones: AudioInput[];
  };
  "monitor://process": { started: ProcessInfo[]; exited: ProcessInfo[] };
  "monitor://banned-app": { running: ProcessInfo[] };
  "monitor://foreground": { pid: number; name: string; title: string; isSelf: boolean };
  "monitor://shortcut": { combo: string; blocked: boolean; t: number };
  "monitor://synthetic-input": { count: number; t: number };
}

const isTauri = "__TAURI_INTERNALS__" in window;

export const getSnapshot = () => invoke<SystemSnapshot>("monitor_snapshot");
export const getDisplays = () => invoke<DisplayInfo[]>("monitor_displays");
export const getDevices = () => invoke<Device[]>("monitor_devices");
export const getMicrophones = () => invoke<AudioInput[]>("monitor_microphones");
export const getProcesses = () => invoke<ProcessInfo[]>("monitor_processes");
export const getScreenCaptureStatus = () => invoke<ScreenCaptureStatus>("monitor_screen_capture_status");
export const requestScreenCapture = () => invoke<ScreenCaptureStatus>("monitor_request_screen_capture");
export const startMonitor = (config: MonitorConfig = {}) => invoke<void>("monitor_start", { config });
export const stopMonitor = () => invoke<void>("monitor_stop");
export const drainKeylog = () => invoke<KeyEvent[]>("monitor_keylog_drain");

export function onMonitor<K extends keyof MonitorEvents>(
  event: K,
  handler: (payload: MonitorEvents[K]) => void,
): () => void {
  if (!isTauri) return () => {};
  const p: Promise<UnlistenFn> = listen<MonitorEvents[K]>(event, (e) => handler(e.payload));
  return () => void p.then((off) => off());
}

/** Số thiết bị vật lý theo loại (gộp các interface HID cùng VID:PID). */
export function countPhysical(devices: Device[], kind: DeviceKind): number {
  const keys = new Set(
    devices.filter((d) => d.kind === kind).map((d) => d.hardwareId ?? `builtin:${d.name}`),
  );
  return keys.size;
}

/** Screens in use: active desktops, or monitors / virtual display drivers the OS still reports (mirrored or cloned). */
export const screenCount = (displays: DisplayInfo[], devices: Device[]) =>
  Math.max(displays.length, devices.filter((d) => d.kind === "display").length);

/** HDMI / USB capture cards and similar video-in hardware. */
export const captureDevices = (devices: Device[]) => devices.filter((d) => d.kind === "capture");

/** Ứng dụng cấm mặc định (quay/chia sẻ màn hình, điều khiển từ xa, chat). */
export const DEFAULT_BANNED_APPS = [
  "obs*",
  "anydesk",
  "teamviewer*",
  "ultraviewer*",
  "discord*",
  "zoom",
  "skype*",
  "telegram",
  "zalo",
  "slack",
  "bandicam*",
  "snippingtool",
  "screenclippinghost",
  "sharex",
  "rustdesk",
  "parsecd",
];
