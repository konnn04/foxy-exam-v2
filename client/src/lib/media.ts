import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";

/** Camera / microphone / screen helpers shared by the pre-exam setup and the exam windows. */

export type MediaFailure = "denied" | "notfound" | "busy" | "unsupported" | "unknown";

export function explain(err: unknown): MediaFailure {
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
  unknown: "Không mở được thiết bị.",
};

export const openCamera = () =>
  navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }, audio: false });

export const openMic = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });

/** Needs a user gesture (the student clicks a button) and shows the OS screen picker. */
export const openScreen = () =>
  navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 5, max: 10 } }, audio: false });

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
  private published = new Set<string>();

  constructor(private onState?: (state: "connecting" | "connected" | "reconnecting" | "disconnected") => void) {}

  async connect(info: LiveKitInfo): Promise<void> {
    const room = new Room({ adaptiveStream: false, dynacast: false });
    room
      .on(RoomEvent.ConnectionStateChanged, (s) => {
        this.onState?.(
          s === ConnectionState.Connected ? "connected" : s === ConnectionState.Reconnecting ? "reconnecting" : s === ConnectionState.Disconnected ? "disconnected" : "connecting",
        );
      })
      .on(RoomEvent.Disconnected, () => this.published.clear());
    this.onState?.("connecting");
    await room.connect(info.url, info.token, { autoSubscribe: false });
    this.room = room;
  }

  /** Publish a captured stream's video track. A second call for the same kind is a no-op. */
  async publish(kind: "camera" | "screen", stream: MediaStream): Promise<void> {
    const track = stream.getVideoTracks()[0];
    if (!this.room || !track || this.published.has(kind)) return;
    await this.room.localParticipant.publishTrack(track, {
      source: kind === "camera" ? Track.Source.Camera : Track.Source.ScreenShare,
      simulcast: false,
      videoEncoding: kind === "camera" ? { maxBitrate: 350_000, maxFramerate: 12 } : { maxBitrate: 700_000, maxFramerate: 5 },
    });
    this.published.add(kind);
  }

  async disconnect(): Promise<void> {
    this.published.clear();
    await this.room?.disconnect().catch(() => {});
    this.room = null;
    this.onState?.("disconnected");
  }
}
