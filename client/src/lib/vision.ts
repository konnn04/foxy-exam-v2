import { AttentionTracker, EMPTY_READING, attention, eyeAway, faceRatio, headPose, type FrameReading, type VisionEvent } from "./vision-core";

/** Which MediaPipe delegate to use. "auto" tries the GPU and quietly falls back to the CPU. */
export type FaceDelegate = "auto" | "gpu" | "cpu";

const KEY = "foxy:vision-delegate";
export const getFaceDelegate = (): FaceDelegate => {
  const v = localStorage.getItem(KEY);
  return v === "gpu" || v === "cpu" ? v : "auto";
};
export const setFaceDelegate = (v: FaceDelegate) => localStorage.setItem(KEY, v);

export interface VisionSample extends FrameReading {
  attention: number;
  delegate: "GPU" | "CPU";
}

interface Landmarker {
  detectForVideo(video: HTMLVideoElement, ts: number): {
    faceLandmarks: { x: number }[][];
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
    facialTransformationMatrixes?: { data: number[] }[];
  };
  close(): void;
}

const WASM = "/mediapipe/wasm";
const MODEL = "/mediapipe/face_landmarker.task";
const FRAME_MS = 250; // 4 readings per second is plenty for attention and keeps the CPU path cheap

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<Landmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  return (await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numFaces: 3,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  })) as unknown as Landmarker;
}

/**
 * Watches the camera stream: how many faces, how far, where the head and eyes point. Readings feed the
 * heartbeat (live attention for the proctor); sustained problems come out as violations.
 */
export class FaceMonitor {
  private lm: Landmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private timer: number | undefined;
  private tracker = new AttentionTracker();
  private last = -1;
  delegate: "GPU" | "CPU" = "CPU";

  constructor(
    private onSample: (s: VisionSample) => void,
    private onEvent: (e: VisionEvent) => void,
  ) {}

  /** Resolves with the delegate in use, or throws when MediaPipe cannot start at all (the exam goes on without it). */
  async start(stream: MediaStream, preferred: FaceDelegate = getFaceDelegate()): Promise<"GPU" | "CPU"> {
    const order: ("GPU" | "CPU")[] = preferred === "cpu" ? ["CPU"] : preferred === "gpu" ? ["GPU"] : ["GPU", "CPU"];
    let lastErr: unknown;
    for (const d of order) {
      try {
        this.lm = await createLandmarker(d);
        this.delegate = d;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!this.lm) throw lastErr ?? new Error("MediaPipe unavailable");

    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = stream;
    await v.play().catch(() => {});
    this.video = v;
    const t0 = performance.now();
    this.timer = window.setInterval(() => this.tick(t0), FRAME_MS);
    return this.delegate;
  }

  private tick(t0: number) {
    const v = this.video;
    if (!this.lm || !v || v.readyState < 2 || v.videoWidth === 0 || v.currentTime === this.last) return;
    this.last = v.currentTime;
    let r: FrameReading = EMPTY_READING;
    try {
      const res = this.lm.detectForVideo(v, performance.now());
      r = { ...EMPTY_READING, faces: res.faceLandmarks.length };
      if (r.faces > 0) {
        r.faceRatio = faceRatio(res.faceLandmarks[0]);
        const m = res.facialTransformationMatrixes?.[0]?.data;
        if (m) Object.assign(r, headPose(m));
        const shapes = res.faceBlendshapes?.[0]?.categories;
        if (shapes) r.eyeAway = eyeAway(Object.fromEntries(shapes.map((c) => [c.categoryName, c.score])));
      }
    } catch {
      return; // a bad frame is skipped
    }
    this.onSample({ ...r, attention: attention(r), delegate: this.delegate });
    for (const e of this.tracker.update(r, (performance.now() - t0) / 1000)) this.onEvent(e);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    this.lm?.close();
    this.lm = null;
  }
}
