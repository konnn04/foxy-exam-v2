import { invoke } from "@tauri-apps/api/core";

export interface SystemInfo {
  os: string;
  hostname: string;
  cpu_model: string;
  cores: number;
  ram_total_mb: number;
  machine_id: string;
}

export interface SystemLoad {
  cpu: number;
  ram: number;
}

let cached: Promise<Record<string, unknown>> | null = null;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** What the server shows next to an attempt. The machine id leaves this machine only as a salted hash. */
export function deviceInfo(): Promise<Record<string, unknown>> {
  cached ??= (async () => {
    const base = { os: "windows", app_version: "0.1.0-tauri", screen: `${window.screen.width}x${window.screen.height}` };
    try {
      const s = await invoke<SystemInfo>("system_info");
      return {
        ...base,
        os: s.os || base.os,
        hostname: s.hostname,
        cpu_model: s.cpu_model,
        cores: s.cores,
        ram_total_mb: s.ram_total_mb,
        fingerprint: s.machine_id ? await sha256(`foxyexam:${s.machine_id}`) : undefined,
      };
    } catch {
      return base;
    }
  })();
  return cached;
}

export const systemLoad = () => invoke<SystemLoad>("system_load");
