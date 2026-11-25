import { diag } from "./diag";
import { AttentionTracker, EMPTY_READING, attention, eyeGaze, eyesClosed, faceRatio, headPose, type FrameReading, type VisionEvent } from "./vision-core";

/** Which MediaPipe delegate to use. "auto" tries the GPU and quietly falls back to the CPU. */
export type FaceDelegate = "auto" | "gpu" | "cpu";

const KEY = "foxy:vision-delegate";
/**
 * Linux (WebKitGTK): MediaPipe's GPU delegate runs on the webview's WebGL, which on many Linux GPU/driver setups
 * (notably Wayland, NVIDIA, some Mesa builds) hangs and then takes the whole web process down. A thrown error
 * could be caught and retried on the CPU, a crashed process cannot — so Linux goes straight to the CPU unless the
 * user picked a delegate explicitly.
 */
const IS_LINUX = typeof navigator !== "undefined" && /Linux|X11/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent);

export const getFaceDelegate = (): FaceDelegate => {
  const v = localStorage.getItem(KEY);
  if (v === "gpu" || v === "cpu") return v;
  return IS_LINUX ? "cpu" : "auto";
};
export const setFaceDelegate = (v: FaceDelegate) => localStorage.setItem(KEY, v);

export interface VisionSample extends FrameReading {
  /** Landmarks of every face found (normalised 0..1), for drawing an overlay on the preview. */
  landmarks: { x: number; y: number }[][];
  attention: number;
  delegate: "GPU" | "CPU";
}

interface Landmarker {
  detectForVideo(video: HTMLVideoElement, ts: number): {
    faceLandmarks: { x: number; y: number }[][];
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
    facialTransformationMatrixes?: { data: number[] }[];
  };
  close(): void;
}

const WASM = "/mediapipe/wasm";
const MODEL = "/mediapipe/face_landmarker.task";
// the GPU delegate can afford 15 readings a second (catches quick glances); the CPU path stays at 5
const FRAME_MS = { GPU: 1000 / 15, CPU: 1000 / 5 } as const;

/** A step that never finishes must not freeze the screen: fail it after `ms` so the caller can move on. */
function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** MediaPipe draws through WebGL2 even on the CPU path; without it nothing can run. */
function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<Landmarker> {
  if (!hasWebGL2()) throw new Error("WebGL2 is not available in this webview");
  diag(`vision: loading MediaPipe (${delegate})`);
  const { FaceLandmarker, FilesetResolver } = await within(import("@mediapipe/tasks-vision"), 15_000, "loading the MediaPipe library");
  const fileset = await within(FilesetResolver.forVisionTasks(WASM), 15_000, "loading the MediaPipe runtime");
  diag("vision: runtime ready, loading the face model");
  const landmarker = await within(FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numFaces: 3,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  }), 25_000, "creating the face model");
  diag(`vision: model ready (${delegate})`);
  return landmarker as unknown as Landmarker;
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
  /** Called once when detection keeps failing (the analysis cannot run on this machine). */
  onFailure?: (err: unknown) => void;
  private fails = 0;
  private failed = false;

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
        diag(`vision: ${d} delegate failed: ${e instanceof Error ? e.message : String(e)}`);
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
    this.timer = window.setInterval(() => this.tick(t0), FRAME_MS[this.delegate]);
    return this.delegate;
  }

  private tick(t0: number) {
    const v = this.video;
    if (!this.lm || !v || v.readyState < 2 || v.videoWidth === 0 || v.currentTime === this.last) return;
    this.last = v.currentTime;
    let r: FrameReading = EMPTY_READING;
    let faceLandmarks: { x: number; y: number }[][] = [];
    try {
      const res = this.lm.detectForVideo(v, performance.now());
      faceLandmarks = res.faceLandmarks;
      r = { ...EMPTY_READING, faces: res.faceLandmarks.length };
      if (r.faces > 0) {
        r.faceRatio = faceRatio(res.faceLandmarks[0]);
        const m = res.facialTransformationMatrixes?.[0]?.data;
        if (m) Object.assign(r, headPose(m));
        const shapes = res.faceBlendshapes?.[0]?.categories;
        if (shapes) {
          const named = Object.fromEntries(shapes.map((c) => [c.categoryName, c.score]));
          const gaze = eyeGaze(named);
          r.eyeX = gaze.x;
          r.eyeY = gaze.y;
          r.eyeAway = Math.min(1, Math.max(Math.abs(gaze.x), Math.abs(gaze.y)));
          r.eyesClosed = eyesClosed(named);
        }
      }
      this.fails = 0;
    } catch (e) {
      // one bad frame is skipped; a stream of them means detection cannot work here
      this.fails += 1;
      if (this.fails === 1) diag(`vision: detect error: ${e instanceof Error ? e.message : String(e)}`);
      if (this.fails >= 8 && !this.failed) {
        this.failed = true;
        this.onFailure?.(e);
      }
      return;
    }
    this.onSample({ ...r, landmarks: faceLandmarks, attention: attention(r), delegate: this.delegate });
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
