import { getLobbyMedia } from "./lobbyMedia";
import type { ViolationType } from "./api";

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
  NO_FACE_DETECTED: "camera",
  MULTIPLE_PEOPLE: "camera",
  LOOKING_AWAY: "camera",
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

/** JPEG of the current frame of the screen share or the camera; null when that source is not running. */
export async function captureFrame(source: "screen" | "camera"): Promise<Blob | null> {
  const stream = getLobbyMedia()[source];
  if (!stream?.active) return null;
  const v = await playerFor(stream);
  if (!v) return null;
  const scale = Math.min(1, MAX_WIDTH / v.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(v.videoWidth * scale);
  canvas.height = Math.round(v.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY));
}

/** Rate limit per violation type so a burst of identical events does not fill the evidence quota. */
export function evidenceDue(type: ViolationType): boolean {
  const now = Date.now();
  if (now - (lastShot.get(type) ?? 0) < MIN_GAP_MS) return false;
  lastShot.set(type, now);
  return true;
}

export function releaseEvidence() {
  players.forEach((v) => {
    v.pause();
    v.srcObject = null;
  });
  players.clear();
  lastShot.clear();
}
