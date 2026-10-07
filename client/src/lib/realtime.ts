import { ApiError, getRealtimeSession, type RealtimeSession } from "./api";
import { bypass } from "./dev";

/**
 * Client side of the realtime plane (see docs/REALTIME.md).
 *
 * - Events (heartbeat, violations, op-logs, logs) are queued with a per-attempt `seq` and sent in ONE batch
 *   about every second (`next_flush_ms` is dictated by the server and grows under load).
 * - A failed request keeps the queue and retries the same events: ingest and the core are idempotent.
 * - Server commands (WARN / PAUSE / RESUME / FORCE_END) ride back on the response and are acknowledged
 *   with a `cmd_ack` event; `end: true` means the attempt is over.
 * - When the server has no realtime plane (503 REALTIME_DISABLED) or the dev bypass "realtime" is on,
 *   `enabled` stays false and callers use the plain REST endpoints.
 */

export type RtEventType = "hb" | "violation" | "oplog" | "log" | "cmd_ack";

export interface RtCommand {
  id: string;
  type: "WARN" | "PAUSE" | "RESUME" | "FORCE_END";
  message?: string;
  at: number;
}

export interface HeartbeatState {
  focus?: boolean;
  fullscreen?: boolean;
  camera?: boolean;
  screen?: boolean;
  latency_ms?: number;
  question?: number;
}

interface QueuedEvent {
  seq: number;
  t: RtEventType;
  ts: number;
  data: unknown;
}

export type RtStatus = "off" | "connecting" | "live" | "degraded";

export interface RealtimeHandlers {
  onCommand?: (cmd: RtCommand) => void;
  /** The attempt was ended on the server (force end / exam closed). */
  onEnd?: (status: string) => void;
  onStatus?: (status: RtStatus) => void;
  /** Called once per successful session; lets the caller read `livekit` / `evidence` details. */
  onSession?: (session: RealtimeSession) => void;
}

const MAX_QUEUE = 5000;
const FLUSH_TIMEOUT_MS = 8000;

/** Violation types the realtime plane knows; the client's extra detectors are mapped onto them. */
const SERVER_TYPE: Record<string, string> = {
  BANNED_APP: "PROHIBITED_DEVICE",
  MULTIPLE_MONITORS: "PROHIBITED_DEVICE",
  DEVICE_CHANGED: "PROHIBITED_DEVICE",
  SYSTEM_SHORTCUT: "TAB_SWITCH",
};

export function toServerViolation(type: string): string {
  return SERVER_TYPE[type] ?? type;
}

export class RealtimeClient {
  private session: RealtimeSession | null = null;
  private queue: QueuedEvent[] = [];
  private seq = 0;
  private hb: HeartbeatState = {};
  private timer: number | undefined;
  private stopped = true;
  private failures = 0;
  private nextFlushMs = 1000;
  private attemptId = 0;
  private status: RtStatus = "off";
  private lastLatency = 0;

  constructor(private handlers: RealtimeHandlers = {}) {}

  get enabled(): boolean {
    return this.status === "live" || this.status === "degraded" || this.status === "connecting";
  }

  private setStatus(s: RtStatus) {
    if (this.status !== s) {
      this.status = s;
      this.handlers.onStatus?.(s);
    }
  }

  private seqKey = () => `foxy:rt:seq:${this.attemptId}`;

  /** Open the session. Resolves false when realtime is unavailable (the caller keeps using REST). */
  async start(attemptId: number): Promise<boolean> {
    if (bypass("realtime")) {
      this.setStatus("off");
      return false;
    }
    this.attemptId = attemptId;
    this.seq = Number(localStorage.getItem(this.seqKey()) ?? 0); // survive a window reload: seq must never go backwards
    this.stopped = false;
    this.setStatus("connecting");
    const ok = await this.refreshSession();
    if (ok) await this.syncSeq();
    if (!ok) {
      this.stopped = true;
      this.setStatus("off");
      return false;
    }
    this.schedule(0);
    return true;
  }

  /** Continue after whatever the server already acknowledged (cleared storage, reinstall, second device). */
  private async syncSeq() {
    if (!this.session) return;
    try {
      const url = this.session.ingest.url.replace(/\/v1\/batch$/, "/v1/state");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.session.ingest.token}` } });
      if (res.ok) {
        const { last_seq } = (await res.json()) as { last_seq: number };
        if (last_seq > this.seq) {
          this.seq = last_seq;
          localStorage.setItem(this.seqKey(), String(this.seq));
        }
      }
    } catch {
      /* the first batch will still work; at worst some events are treated as duplicates */
    }
  }

  private async refreshSession(): Promise<boolean> {
    try {
      const res = await getRealtimeSession(this.attemptId);
      this.session = res.data;
      this.nextFlushMs = res.data.ingest.flush_interval_ms || 1000;
      this.handlers.onSession?.(res.data);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.body?.error_code === "REALTIME_DISABLED") return false;
      console.warn("[realtime] session failed:", err);
      return false;
    }
  }

  /** Merge fields into the heartbeat state sent with every flush (focus, camera...). */
  setState(patch: HeartbeatState) {
    this.hb = { ...this.hb, ...patch };
  }

  emit(t: Exclude<RtEventType, "hb">, data: unknown) {
    if (this.stopped) return;
    this.push(t, data);
  }

  private push(t: RtEventType, data: unknown) {
    if (this.queue.length >= MAX_QUEUE) {
      // keep violations: drop the oldest heartbeat / log instead
      const i = this.queue.findIndex((e) => e.t === "hb" || e.t === "log");
      this.queue.splice(i >= 0 ? i : 0, 1);
    }
    this.seq += 1;
    localStorage.setItem(this.seqKey(), String(this.seq));
    this.queue.push({ seq: this.seq, t, ts: Date.now(), data });
  }

  private schedule(ms: number) {
    window.clearTimeout(this.timer);
    if (!this.stopped) this.timer = window.setTimeout(() => void this.flush(), ms);
  }

  /** Send everything queued. Also used once at the end of the exam. */
  async flush(final = false): Promise<void> {
    if (!this.session) return;
    if (!final) this.push("hb", { ...this.hb, latency_ms: this.lastLatency || undefined });
    const batch = this.queue.slice(0, 500);
    if (batch.length === 0) {
      if (!final) this.schedule(this.nextFlushMs);
      return;
    }

    const started = performance.now();
    try {
      const res = await this.post(batch);
      this.lastLatency = Math.round(performance.now() - started);

      if (res.status === 401) {
        // token expired: renew the session, keep the queue
        if (await this.refreshSession()) return this.schedule(0);
        throw new Error("session refresh failed");
      }
      if (res.status === 429 || res.status === 503) {
        const wait = Number(res.headers.get("Retry-After") ?? "2") * 1000;
        this.failures += 1;
        this.setStatus("degraded");
        return final ? undefined : this.schedule(Math.max(wait, 1000));
      }
      if (!res.ok) {
        // 4xx other than the above: the events themselves are bad; drop them so the queue cannot jam
        console.error("[realtime] batch refused", res.status);
        this.queue.splice(0, batch.length);
        return final ? undefined : this.schedule(this.nextFlushMs);
      }

      const body = (await res.json()) as {
        ack_seq: number;
        next_flush_ms: number;
        commands?: RtCommand[];
        end?: boolean;
        status?: string;
      };
      this.queue = this.queue.filter((e) => e.seq > body.ack_seq);
      this.failures = 0;
      this.nextFlushMs = Math.max(500, body.next_flush_ms || 1000);
      this.setStatus("live");

      for (const cmd of body.commands ?? []) {
        this.push("cmd_ack", { id: cmd.id });
        this.handlers.onCommand?.(cmd);
      }
      if (body.end) {
        this.handlers.onEnd?.(body.status ?? "ended");
        this.stopped = true;
        return;
      }
    } catch (err) {
      this.failures += 1;
      this.setStatus("degraded");
      console.warn("[realtime] flush failed, will retry:", err);
      if (final) return;
      // exponential backoff 1s..15s; the queue (and its seq numbers) is kept
      return this.schedule(Math.min(15_000, 1000 * 2 ** Math.min(this.failures, 4)));
    }
    if (!final) this.schedule(this.nextFlushMs);
  }

  private async post(batch: QueuedEvent[]): Promise<Response> {
    const ing = this.session!.ingest;
    const json = JSON.stringify({ events: batch });
    const headers: Record<string, string> = { Authorization: `Bearer ${ing.token}`, "Content-Type": "application/json" };
    let body: BodyInit = json;
    // gzip the body when the WebView supports CompressionStream (Chromium/WebView2 do) and it is worth it
    if (json.length > 1024 && "CompressionStream" in window) {
      try {
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
        body = await new Response(stream).blob();
        headers["Content-Encoding"] = "gzip";
      } catch {
        body = json;
      }
    }
    const ctl = new AbortController();
    const to = window.setTimeout(() => ctl.abort(), FLUSH_TIMEOUT_MS);
    try {
      return await fetch(ing.url, { method: "POST", headers, body, signal: ctl.signal });
    } finally {
      window.clearTimeout(to);
    }
  }

  /** Stop the loop and make one last attempt to deliver what is queued. */
  async stop(): Promise<void> {
    if (!this.session) return;
    window.clearTimeout(this.timer);
    this.stopped = true;
    await this.flush(true).catch(() => {});
    this.session = null;
    this.setStatus("off");
  }

  get livekit() {
    return this.session?.livekit ?? null;
  }

  get evidence() {
    return this.session?.evidence ?? null;
  }
}
