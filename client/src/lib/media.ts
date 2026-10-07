import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";

/** Camera / microphone / screen helpers shared by the pre-exam setup and the exam windows. */

export type MediaFailure = "denied" | "notfound" | "busy" | "unsupported" | "surface" | "unknown";

export function explain(err: unknown): MediaFailure {
  if (err instanceof WrongSurfaceError) return "surface";
  const name = (err as { name?: string } | null)?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "notfound";
    case "NotReadableError":
    case "AbortError":
      return "busy";
    case "TypeError":
      return "unsupported";
    default:
      return "unknown";
  }
}

export const FAILURE_TEXT: Record<MediaFailure, string> = {
  denied: "Quyền truy cập bị từ chối — hãy cho phép trong cài đặt quyền của hệ điều hành.",
  notfound: "Không tìm thấy thiết bị.",
  busy: "Thiết bị đang được ứng dụng khác sử dụng.",
  unsupported: "Trình hiển thị không hỗ trợ tính năng này.",
  surface: "Hãy chọn “Toàn màn hình” (Entire screen), không chia sẻ một cửa sổ hay tab.",
  unknown: "Không mở được thiết bị.",
};

const CAMERA_KEY = "foxy:camera-id";

export const getPreferredCamera = (): string | null => {
  try {
    return localStorage.getItem(CAMERA_KEY);
  } catch {
    return null;
  }
};
export const setPreferredCamera = (id: string) => {
  try {
    localStorage.setItem(CAMERA_KEY, id);
  } catch {
    /* only a convenience */
  }
};

export interface CameraInfo {
  id: string;
  label: string;
}

/** Cameras the OS exposes. Labels stay empty until the page has been granted camera access once. */
export async function listCameras(): Promise<CameraInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === "videoinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

/** Opens the chosen camera (the remembered one by default); falls back to any camera if that one is gone. */
export async function openCamera(deviceId: string | null = getPreferredCamera()): Promise<MediaStream> {
  const base = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } };
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { ...base, deviceId: { exact: deviceId } }, audio: false });
    } catch (e) {
      if ((e as { name?: string })?.name !== "OverconstrainedError" && (e as { name?: string })?.name !== "NotFoundError") throw e;
    }
  }
  return navigator.mediaDevices.getUserMedia({ video: base, audio: false });
}

export const openMic = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });

/** Thrown when the student picked a window or a browser tab instead of the whole screen. */
export class WrongSurfaceError extends Error {
  constructor() {
    super("Hãy chọn “Toàn màn hình” (Entire screen), không chia sẻ một cửa sổ hay tab.");
    this.name = "WrongSurfaceError";
  }
}

/**
 * Needs a user gesture (the student clicks a button) and shows the OS screen picker. Only a whole monitor is
 * accepted - a window or tab would let the candidate hide everything else - and system audio is captured too.
 */
export async function openScreen(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 5, max: 10 }, displaySurface: "monitor" },
    audio: true,
    selfBrowserSurface: "exclude",
    monitorTypeSurfaces: "include",
    surfaceSwitching: "exclude",
    systemAudio: "include",
  } as DisplayMediaStreamOptions);
  const surface = (stream.getVideoTracks()[0]?.getSettings() as { displaySurface?: string } | undefined)?.displaySurface;
  if (surface && surface !== "monitor") {
    stopStream(stream);
    throw new WrongSurfaceError();
  }
  return stream;
}

export function stopStream(s: MediaStream | null | undefined) {
  s?.getTracks().forEach((t) => t.stop());
}

/** Live microphone level 0..1 (RMS). Returns a stop function. */
export function micMeter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  src.connect(an);
  const buf = new Uint8Array(an.fftSize);
  let raf = 0;
  const loop = () => {
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    cancelAnimationFrame(raf);
    src.disconnect();
    void ctx.close();
  };
}

/** Tell the caller when a captured track dies (camera unplugged, screen share stopped). */
export function onTrackEnded(stream: MediaStream | null, cb: () => void): () => void {
  if (!stream) return () => {};
  const tracks = stream.getTracks();
  tracks.forEach((t) => t.addEventListener("ended", cb));
  return () => tracks.forEach((t) => t.removeEventListener("ended", cb));
}

// ---------------------------------------------------------------------------------------------
// LiveKit: publish camera + screen into the exam room. The record service starts egress by itself
// when it sees the published tracks, so the client only has to publish (and never subscribe).
// ---------------------------------------------------------------------------------------------

export interface LiveKitInfo {
  url: string;
  token: string;
  room: string;
  identity: string;
}

export class LiveKitPublisher {
  private room: Room | null = null;
  private tracks = new Map<string, MediaStreamTrack>();

  constructor(private onState?: (state: "connecting" | "connected" | "reconnecting" | "disconnected") => void) {}

  async connect(info: LiveKitInfo): Promise<void> {
    const room = new Room({ adaptiveStream: false, dynacast: false });
    room
      .on(RoomEvent.ConnectionStateChanged, (s) => {
        this.onState?.(
          s === ConnectionState.Connected ? "connected" : s === ConnectionState.Reconnecting ? "reconnecting" : s === ConnectionState.Disconnected ? "disconnected" : "connecting",
        );
      })
      .on(RoomEvent.Disconnected, () => this.tracks.clear());
    this.onState?.("connecting");
    await room.connect(info.url, info.token, { autoSubscribe: false });
    this.room = room;
  }

  /** Publish a captured stream's video track; a new track of the same kind replaces the old one (camera plugged back in). */
  async publishAudio(stream: MediaStream): Promise<void> {
    const track = stream.getAudioTracks()[0];
    if (!this.room || !track || this.tracks.get("screen-audio") === track) return;
    await this.room.localParticipant.publishTrack(track, { source: Track.Source.ScreenShareAudio }).catch(() => {});
    this.tracks.set("screen-audio", track);
  }

  async publish(kind: "camera" | "screen", stream: MediaStream): Promise<void> {
    const track = stream.getVideoTracks()[0];
    if (!this.room || !track) return;
    const old = this.tracks.get(kind);
    if (old === track) return;
    if (old) await this.room.localParticipant.unpublishTrack(old).catch(() => {});
    await this.room.localParticipant.publishTrack(track, {
      source: kind === "camera" ? Track.Source.Camera : Track.Source.ScreenShare,
      simulcast: false,
      videoEncoding: kind === "camera" ? { maxBitrate: 350_000, maxFramerate: 12 } : { maxBitrate: 700_000, maxFramerate: 5 },
    });
    this.tracks.set(kind, track);
  }

  async disconnect(): Promise<void> {
    this.tracks.clear();
    await this.room?.disconnect().catch(() => {});
    this.room = null;
    this.onState?.("disconnected");
  }
}
