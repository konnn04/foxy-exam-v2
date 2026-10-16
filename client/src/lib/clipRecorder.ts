import { getLobbyMedia } from "./lobbyMedia";

/**
 * Short clips around a violation, recorded by the candidate machine itself (light: no server-side video work).
 *
 * MediaRecorder output is only playable from its first chunk, so a rolling "last 5 seconds" is made of two recorders
 * per source that restart every RUN_MS, shifted by half a run. At a violation the OLDER one (5..10 s of footage already
 * in it) is kept running for POST_MS more and then stopped: the file holds PRE (>= 5 s) before and POST (5 s) after.
 * The streams are cloned and scaled down first so the live publishing is untouched.
 */
const RUN_MS = 10_000;
const POST_MS = 5_000;
const MIN_PRE_MS = 4_000;
const MIN_GAP_MS = 15_000;

type Source = "camera" | "screen";

const PROFILE: Record<Source, MediaTrackConstraints> = {
  camera: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 10, max: 15 } },
  screen: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 5, max: 8 } },
};
const BITRATE: Record<Source, number> = { camera: 300_000, screen: 450_000 };

function mime(): string {
  for (const m of ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

interface Slot {
  rec: MediaRecorder | null;
  chunks: Blob[];
  startedAt: number;
  held: { until: number; done: Promise<Blob | null> } | null;
  timer?: number;
  clone?: MediaStream;
}

class Lane {
  private slots: Slot[] = [
    { rec: null, chunks: [], startedAt: 0, held: null },
    { rec: null, chunks: [], startedAt: 0, held: null },
  ];
  private alive = false;

  constructor(private source: Source) {}

  start() {
    this.alive = true;
    this.spawn(0, 0);
    this.spawn(1, RUN_MS / 2);
  }

  stop() {
    this.alive = false;
    for (const s of this.slots) {
      window.clearTimeout(s.timer);
      this.halt(s);
    }
  }

  private halt(s: Slot) {
    try {
      if (s.rec && s.rec.state !== "inactive") s.rec.stop();
    } catch {
      /* already stopped */
    }
    s.clone?.getTracks().forEach((t) => t.stop());
    s.rec = null;
    s.clone = undefined;
    s.held = null;
  }

  private spawn(i: number, delay: number) {
    const s = this.slots[i];
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => {
      if (!this.alive) return;
      const stream = getLobbyMedia()[this.source];
      if (!stream?.active || !stream.getVideoTracks().length) {
        this.spawn(i, 2000); // the source is not running (yet): look again soon
        return;
      }
      try {
        const clone = new MediaStream(stream.getVideoTracks().map((t) => t.clone()));
        clone.getVideoTracks().forEach((t) => void t.applyConstraints(PROFILE[this.source]).catch(() => undefined));
        const type = mime();
        const rec = new MediaRecorder(clone, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: BITRATE[this.source] });
        s.chunks = [];
        s.clone = clone;
        s.rec = rec;
        s.startedAt = Date.now();
        rec.ondataavailable = (e) => e.data.size && s.chunks.push(e.data);
        rec.start(2000);
        // a free-running recorder restarts itself; a held one is stopped by capture()
        s.timer = window.setTimeout(() => {
          if (s.held) return;
          this.halt(s);
          this.spawn(i, 0);
        }, RUN_MS);
      } catch {
        this.spawn(i, 5000);
      }
    }, delay);
  }

  isHeld(now: number): boolean {
    return this.slots.some((s) => s.held && s.held.until >= now);
  }

  /** Keeps the recorder with the most footage for POST_MS more; resolves its file, or null when nothing usable. */
  capture(now: number): { done: Promise<Blob | null>; from: number; until: number } | null {
    const running = this.slots.map((s, i) => ({ s, i })).filter((x) => x.s.rec && x.s.rec.state === "recording");
    if (running.length === 0) return null;
    const held = running.find((x) => x.s.held && x.s.held.until >= now);
    if (held) return { done: held.s.held!.done, from: held.s.startedAt, until: held.s.held!.until };
    const { s, i } = running.sort((a, b) => a.s.startedAt - b.s.startedAt)[0];
    if (now - s.startedAt < MIN_PRE_MS) return null;
    const rec = s.rec!;
    const until = now + POST_MS;
    const other = this.slots[1 - i];
    const done = new Promise<Blob | null>((resolve) => {
      rec.onstop = () => {
        const blob = s.chunks.length ? new Blob(s.chunks, { type: "video/webm" }) : null;
        this.halt(s);
        // keep the half-run shift between the two recorders
        const base = other.rec ? other.startedAt : Date.now();
        let next = base + RUN_MS / 2;
        while (next < Date.now()) next += RUN_MS;
        this.spawn(i, next - Date.now());
        resolve(blob);
      };
      window.setTimeout(() => {
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          resolve(null);
        }
      }, POST_MS);
    });
    s.held = { until, done };
    return { done, from: s.startedAt, until };
  }
}

export interface ClipResult {
  camera?: Blob;
  screen?: Blob;
  fromMs: number;
  toMs: number;
}

let lanes: Lane[] = [];
const bySource = new Map<Source, Lane>();
let lastClip = 0;

export function startClipRecorder(opts: { camera: boolean; screen: boolean }) {
  stopClipRecorder();
  if (typeof MediaRecorder === "undefined") return;
  for (const src of ["camera", "screen"] as const) {
    if (!opts[src]) continue;
    const lane = new Lane(src);
    lane.start();
    lanes.push(lane);
    bySource.set(src, lane);
  }
}

export function stopClipRecorder() {
  lanes.forEach((l) => l.stop());
  lanes = [];
  bySource.clear();
  lastClip = 0;
}

export const clipRecorderActive = () => lanes.length > 0;

/** Clip of the camera and the screen around now; null when the recorder is off, still too young, or a clip was just taken. */
export async function captureClip(): Promise<ClipResult | null> {
  if (lanes.length === 0) return null;
  const now = Date.now();
  // a violation inside the window of the clip being taken shares that clip; otherwise keep a gap between clips
  const sharing = lanes.some((l) => l.isHeld(now));
  if (!sharing && now - lastClip < MIN_GAP_MS) return null;
  const r = await collect(now);
  if (r && !sharing) lastClip = now;
  return r;
}

async function collect(now: number): Promise<ClipResult | null> {
  const parts = await Promise.all(
    ([...bySource.entries()] as [Source, Lane][]).map(async ([src, lane]) => {
      const c = lane.capture(now);
      return c ? { src, from: c.from, until: c.until, blob: await c.done } : null;
    }),
  );
  const ok = parts.filter((p): p is NonNullable<typeof p> => !!p && !!p.blob);
  if (ok.length === 0) return null;
  const out: ClipResult = { fromMs: Math.min(...ok.map((p) => p.from)), toMs: Math.max(...ok.map((p) => p.until)) };
  for (const p of ok) out[p.src] = p.blob!;
  return out;
}
