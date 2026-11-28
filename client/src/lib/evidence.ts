import { getLobbyMedia } from "./lobbyMedia";
import { attachViolationClip, ApiError, type ViolationType } from "./api";
import { captureClip } from "./clipRecorder";
import type { RealtimeClient } from "./realtime";

/** Which picture proves a violation: what was on the screen, or who was in front of the camera. */
export const EVIDENCE_SOURCE: Partial<Record<ViolationType, "screen" | "camera">> = {
  WINDOW_LOST_FOCUS: "screen",
  APP_NOT_ALLOWED: "screen",
  BANNED_APP: "screen",
  MULTIPLE_MONITORS: "screen",
  CAPTURE_DEVICE: "screen",
  BULK_PASTE: "screen",
  SYNTHETIC_INPUT: "screen",
  DEVICE_CHANGED: "screen",
  VIRTUAL_MACHINE: "screen",
  REMOTE_SESSION: "screen",
  VIRTUAL_CAMERA: "camera",
  NO_FACE_DETECTED: "camera",
  MULTIPLE_PEOPLE: "camera",
  LOOKING_AWAY: "camera",
  GAZE_AWAY: "camera",
  FACE_TOO_FAR: "camera",
};

const MAX_WIDTH = 1280;
const QUALITY = 0.6;
const MIN_GAP_MS = 8000;

const players = new Map<MediaStream, HTMLVideoElement>();
const lastShot = new Map<string, number>();

async function playerFor(stream: MediaStream): Promise<HTMLVideoElement | null> {
  let v = players.get(stream);
  if (!v) {
    v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = stream;
    players.set(stream, v);
  }
  if (v.paused) await v.play().catch(() => {});
  return v.videoWidth > 0 ? v : null;
}

type Source = "screen" | "camera" | "phone";

// Latest good frame per source. When the window is hidden (Alt+Tab, minimised) the live frame can not be drawn, but the
// violation still needs a picture: the most recent cached one (at most STALE_MS old) stands in for it.
const STALE_MS = 15_000;
const CACHE_EVERY_MS = 3000;
const cache = new Map<Source, { blob: Blob; at: number }>();
let cacheTimer: number | undefined;

async function grabLive(source: Source): Promise<Blob | null> {
  const stream = getLobbyMedia()[source];
  if (!stream?.active) {
    console.warn(`[evidence] ${source}: no active stream`);
    return null;
  }
  const v = await playerFor(stream);
  if (!v) {
    console.warn(`[evidence] ${source}: video has no frame yet`);
    return null;
  }
  const scale = Math.min(1, MAX_WIDTH / v.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(v.videoWidth * scale);
  canvas.height = Math.round(v.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY));
  if (blob?.size) cache.set(source, { blob, at: Date.now() });
  return blob;
}

/** Keeps the cache warm while the exam runs (3 sources, one small JPEG each, every few seconds). */
export function startFrameCache() {
  window.clearInterval(cacheTimer);
  cacheTimer = window.setInterval(() => {
    for (const s of ["screen", "camera", "phone"] as const) if (getLobbyMedia()[s]?.active) void grabLive(s).catch(() => undefined);
  }, CACHE_EVERY_MS);
}

/** JPEG of the current frame of the screen share or the camera (or a recent cached one); null when that source is not running. */
export async function captureFrame(source: Source): Promise<Blob | null> {
  const live = await grabLive(source).catch(() => null);
  if (live?.size) return live;
  const c = cache.get(source);
  if (c && Date.now() - c.at <= STALE_MS) {
    console.warn(`[evidence] ${source}: live capture failed, using cached frame (${Math.round((Date.now() - c.at) / 1000)}s old)`);
    return c.blob;
  }
  return null;
}

/** Rate limit per violation type so a burst of identical events does not fill the evidence quota. */
export function evidenceDue(type: ViolationType): boolean {
  const now = Date.now();
  if (now - (lastShot.get(type) ?? 0) < MIN_GAP_MS) return false;
  lastShot.set(type, now);
  return true;
}

export function releaseEvidence() {
  window.clearInterval(cacheTimer);
  cache.clear();
  players.forEach((v) => {
    v.pause();
    v.srcObject = null;
  });
  players.clear();
  lastShot.clear();
}

export interface EvidenceSet {
  /** the picture that best proves the violation (goes into violations.evidence_id) */
  primary?: string;
  /** every picture taken at that moment: screen, main camera and, when used, the phone camera */
  all: Partial<Record<"screen" | "camera" | "phone", string>>;
}

/**
 * Up to three pictures of the moment a violation happens: the screen, the main camera and the phone camera (when the exam
 * uses it). `known` lets a caller that already holds a frame (the AI check holds the camera frame) skip capturing it.
 */
export async function collectEvidence(rt: RealtimeClient, type: ViolationType, withPhone: boolean, known: { camera?: Blob; phone?: Blob } = {}): Promise<EvidenceSet> {
  const [screen, camera] = await Promise.all([captureFrame("screen"), known.camera ?? captureFrame("camera")]);
  const phone = withPhone ? (known.phone ?? (await captureFrame("phone"))) : null;
  const [screenId, cameraId, phoneId] = await Promise.all([
    screen ? rt.uploadEvidence(screen) : null,
    camera ? rt.uploadEvidence(camera) : null,
    phone ? rt.uploadEvidence(phone) : null,
  ]);
  const all: EvidenceSet["all"] = {};
  if (screenId) all.screen = screenId;
  if (cameraId) all.camera = cameraId;
  if (phoneId) all.phone = phoneId;
  const first = EVIDENCE_SOURCE[type];
  return { primary: (first && all[first]) || all.screen || all.camera || all.phone, all };
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * Takes the clip around a violation (5 s before, 5 s after), uploads it and tells the core which violation it belongs to.
 * The violation was reported long before (it never waits for this), so the attach is retried while the core has not
 * stored it yet.
 */
export async function shootClip(rt: RealtimeClient, type: ViolationType, at: number): Promise<void> {
  const clip = await captureClip();
  if (!clip) {
    console.warn(`[evidence] clip ${type}: none taken (recorder young, gap <15s, or no source running)`);
    return;
  }
  const [camera, screen] = await Promise.all([clip.camera ? rt.uploadEvidence(clip.camera) : null, clip.screen ? rt.uploadEvidence(clip.screen) : null]);
  const clips = { ...(camera ? { camera } : {}), ...(screen ? { screen } : {}) };
  if (!camera && !screen) {
    console.warn(`[evidence] clip ${type}: recorded but upload failed`);
    return;
  }
  for (let i = 0; i < 4; i++) {
    try {
      await attachViolationClip({ type, at_ms: at, clips, from_ms: clip.fromMs, to_ms: clip.toMs });
      return;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) {
        console.warn(`[evidence] clip ${type}: attach failed`, e);
        return;
      }
      await sleep(3000);
    }
  }
  console.warn(`[evidence] clip ${type}: violation not found after retries`);
}
