import { invoke } from "@tauri-apps/api/core";

/** What the Rust side measures about the machine (`env_check`). */
export interface EnvCheck {
  os_family: "windows" | "linux" | "macos";
  vm: { detected: boolean; vendor: string | null; evidence: string[] };
  remote_session: boolean;
  /** seconds since the epoch, changes on every reboot */
  boot_time: number;
}

/** Same list as the server (App\Support\Precheck::VIRTUAL_CAMERAS): the server decides, this only explains early. */
const VIRTUAL_CAMERAS = [
  "obs virtual", "obs-camera", "manycam", "xsplit", "snap camera", "splitcam", "droidcam", "iriun", "epoccam",
  "ivcam", "e2esoft", "vcam", "youcam", "camtwist", "nvidia broadcast", "logi capture", "mmhmm",
  "dummy video device", "v4l2loopback", "virtual camera", "virtual webcam", "unity video capture", "newtek ndi",
  "ndi webcam", "chromacam", "vtuber", "animaze", "facerig", "webcamoid", "altercam", "fake webcam",
];

export function isVirtualCamera(label: string | null | undefined): boolean {
  const l = (label ?? "").toLowerCase().trim();
  if (!l) return false;
  return /\bcamo\b/.test(l) || VIRTUAL_CAMERAS.some((w) => l.includes(w));
}

/** Names of virtual cameras the webview can see (labels need camera permission; empty before it is granted). */
export async function virtualCameraNames(): Promise<string[]> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return [...new Set(all.filter((d) => d.kind === "videoinput" && isVirtualCamera(d.label)).map((d) => d.label))];
  } catch {
    return [];
  }
}

let cached: Promise<EnvCheck | null> | null = null;

/** VM / remote session / OS / boot time. null outside Tauri (browser dev) or on an older native side. */
export function envCheck(fresh = false): Promise<EnvCheck | null> {
  if (fresh || !cached) cached = invoke<EnvCheck>("env_check").catch(() => null);
  return cached;
}
