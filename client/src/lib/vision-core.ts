/**
 * Pure maths + decision logic of the camera attention check (no MediaPipe, no DOM): head pose from the facial
 * transformation matrix, gaze from blendshapes, an attention score, and the debounce that turns noisy per-frame
 * readings into a few meaningful violations.
 */

export interface FrameReading {
  faces: number;
  /** face width / frame width of the first face, 0..1 */
  faceRatio: number;
  /** degrees; 0 = looking at the screen */
  yaw: number;
  pitch: number;
  /** 0..1 how far the eyes look away from the screen centre */
  eyeAway: number;
  /** 0..1 how closed both eyes are (1 = shut or hidden, e.g. sunglasses / a hand) */
  eyesClosed: number;
  /** signed gaze: x sideways, y up (+) / down (-), each -1..1 */
  eyeX: number;
  eyeY: number;
}

export const EMPTY_READING: FrameReading = { faces: 0, faceRatio: 0, yaw: 0, pitch: 0, eyeAway: 0, eyesClosed: 0, eyeX: 0, eyeY: 0 };

const deg = (r: number) => (r * 180) / Math.PI;

/** Head yaw / pitch (degrees) from MediaPipe's 4x4 column-major facial transformation matrix. */
export function headPose(m: ArrayLike<number>): { yaw: number; pitch: number } {
  // third column of the rotation = where the face looks
  const fx = m[8];
  const fy = m[9];
  const fz = m[10];
  return { yaw: deg(Math.atan2(fx, Math.abs(fz))), pitch: deg(Math.atan2(fy, Math.hypot(fx, fz))) };
}

type Shapes = Record<string, number>;

/** Signed gaze from the eye blendshapes: where the eyes point relative to the head (the head may face the screen while the eyes glance away). */
export function eyeGaze(s: Shapes): { x: number; y: number } {
  const g = (k: string) => s[k] ?? 0;
  const x = (g("eyeLookOutRight") + g("eyeLookInLeft") - g("eyeLookInRight") - g("eyeLookOutLeft")) / 2;
  const y = (g("eyeLookUpLeft") + g("eyeLookUpRight") - g("eyeLookDownLeft") - g("eyeLookDownRight")) / 2;
  return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
}

/** 0..1 how far the eyes look sideways / up / down (MediaPipe blendshape scores). */
export function eyeAway(s: Shapes): number {
  const { x, y } = eyeGaze(s);
  return Math.min(1, Math.max(Math.abs(x), Math.abs(y)));
}

export const gazeWords = (r: Pick<FrameReading, "eyeX" | "eyeY">) => (Math.abs(r.eyeX) >= Math.abs(r.eyeY) ? "ngang" : r.eyeY > 0 ? "lên" : "xuống");

/** 0..1 how closed BOTH eyes are: the weaker blink score, so a single blink does not count. */
export function eyesClosed(s: Shapes): number {
  return Math.min(s.eyeBlinkLeft ?? 0, s.eyeBlinkRight ?? 0);
}

/** Face width as a share of the frame, from normalized landmarks. */
export function faceRatio(points: { x: number }[]): number {
  if (points.length === 0) return 0;
  let lo = 1;
  let hi = 0;
  for (const p of points) {
    if (p.x < lo) lo = p.x;
    if (p.x > hi) hi = p.x;
  }
  return Math.max(0, hi - lo);
}

export const LIMITS = { yaw: 25, pitch: 20, eye: 0.45, eyesClosed: 0.6, tooFar: 0.14 };

/** What the lobby demands before the exam may start: face straight at the camera, both eyes open and clearly visible. */
export const FRONTAL = { yaw: 15, pitch: 15, eye: 0.35, eyesClosed: 0.5, minRatio: 0.18 };

/** The head itself is turned away from the screen. */
export function headAway(r: FrameReading): boolean {
  return Math.abs(r.yaw) > LIMITS.yaw || Math.abs(r.pitch) > LIMITS.pitch;
}

/** Head straight, but the eyes look off the screen (a glance at a phone, notes, another person). */
export function gazeAway(r: FrameReading): boolean {
  return !headAway(r) && r.eyeAway > LIMITS.eye;
}

export function isLookingAway(r: FrameReading): boolean {
  return headAway(r) || r.eyeAway > LIMITS.eye || r.eyesClosed > LIMITS.eyesClosed;
}

export function isFrontal(r: FrameReading): boolean {
  return (
    r.faces === 1 &&
    Math.abs(r.yaw) <= FRONTAL.yaw &&
    Math.abs(r.pitch) <= FRONTAL.pitch &&
    r.eyeAway <= FRONTAL.eye &&
    r.eyesClosed <= FRONTAL.eyesClosed &&
    r.faceRatio >= FRONTAL.minRatio
  );
}

/** Why the face is not accepted yet, in words for the candidate. */
export function frontalHint(r: FrameReading): string {
  if (r.faces === 0) return "Không thấy khuôn mặt — hãy ngồi vào khung hình";
  if (r.faces > 1) return `${r.faces} khuôn mặt trong khung — chỉ một người được ngồi thi`;
  if (r.faceRatio < FRONTAL.minRatio) return "Ngồi gần camera hơn";
  if (r.eyesClosed > FRONTAL.eyesClosed) return "Chưa thấy rõ mắt — mở mắt, bỏ kính tối màu hoặc vật che";
  if (Math.abs(r.yaw) > FRONTAL.yaw || Math.abs(r.pitch) > FRONTAL.pitch) return "Hãy nhìn thẳng vào camera";
  return "Hãy nhìn thẳng vào camera, giữ hai mắt hướng về màn hình";
}

/** 0..100: how much the candidate faces the screen. 0 when nobody is there. */
export function attention(r: FrameReading): number {
  if (r.faces === 0) return 0;
  const worst = Math.max(Math.abs(r.yaw) / 35, Math.abs(r.pitch) / 30, r.eyeAway / 0.6, r.eyesClosed / 0.8);
  return Math.round(Math.max(0, Math.min(1, 1 - worst)) * 100);
}

// ---------------------------------------------------------------------------------------------

export type VisionEventKind = "NO_FACE_DETECTED" | "MULTIPLE_PEOPLE" | "LOOKING_AWAY" | "GAZE_AWAY" | "FACE_TOO_FAR";

export interface VisionEvent {
  kind: VisionEventKind;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  seconds: number;
}

/** How long a condition must last before it is a violation, and how long before it may be reported again. */
export const RULES: Record<VisionEventKind, { after: number; severity: VisionEvent["severity"]; cooldown: number; message: string }> = {
  NO_FACE_DETECTED: { after: 5, severity: "MEDIUM", cooldown: 30, message: "Không thấy khuôn mặt thí sinh" },
  MULTIPLE_PEOPLE: { after: 2, severity: "HIGH", cooldown: 30, message: "Có nhiều hơn một người trong khung hình" },
  LOOKING_AWAY: { after: 6, severity: "LOW", cooldown: 45, message: "Quay đầu ra ngoài màn hình quá lâu" },
  GAZE_AWAY: { after: 4, severity: "LOW", cooldown: 40, message: "Mắt liếc ra ngoài màn hình" },
  FACE_TOO_FAR: { after: 8, severity: "LOW", cooldown: 60, message: "Ngồi quá xa camera" },
};

/** Feeds frame readings in, emits an event when a condition has lasted long enough (once per cooldown). */
export class AttentionTracker {
  private since: Partial<Record<VisionEventKind, number>> = {};
  private lastEmit: Partial<Record<VisionEventKind, number>> = {};

  /** @param t seconds (monotonic) */
  update(r: FrameReading, t: number): VisionEvent[] {
    const active: Record<VisionEventKind, boolean> = {
      NO_FACE_DETECTED: r.faces === 0,
      MULTIPLE_PEOPLE: r.faces > 1,
      LOOKING_AWAY: r.faces === 1 && headAway(r),
      GAZE_AWAY: r.faces === 1 && gazeAway(r),
      FACE_TOO_FAR: r.faces === 1 && r.faceRatio < LIMITS.tooFar,
    };
    const out: VisionEvent[] = [];
    for (const kind of Object.keys(active) as VisionEventKind[]) {
      if (!active[kind]) {
        delete this.since[kind];
        continue;
      }
      this.since[kind] ??= t;
      const lasted = t - this.since[kind]!;
      const rule = RULES[kind];
      const quiet = t - (this.lastEmit[kind] ?? -Infinity) >= rule.cooldown;
      if (lasted >= rule.after && quiet) {
        this.lastEmit[kind] = t;
        const dir = kind === "GAZE_AWAY" ? ` (liếc ${gazeWords(r)})` : "";
        out.push({ kind, severity: rule.severity, message: rule.message + dir, seconds: Math.round(lasted) });
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------- liveness (pre-exam "is this a real person")

export type LivenessStep = "blink" | "turn";

const STEP_TIME_S = 10;
const BLINKS_NEEDED = 2;

export interface LivenessState {
  step: LivenessStep | null;
  /** 0..1 over the whole challenge */
  progress: number;
  done: boolean;
  failed: boolean;
}

/**
 * A still photo or a printed face cannot blink twice and turn the head. The two steps come in random order, each
 * with a time limit; the challenge only advances while exactly one face is in view.
 *   blink  eyes closed (>= 0.6) then open (<= 0.3), twice
 *   turn   head beyond 22 degrees to either side, then back to frontal
 */
export class LivenessChallenge {
  readonly steps: LivenessStep[];
  private index = 0;
  private startedAt: number | null = null;
  private closed = false;
  private blinks = 0;
  private turned = false;
  private result: "running" | "done" | "failed" = "running";

  constructor(random: () => number = Math.random) {
    this.steps = random() < 0.5 ? ["blink", "turn"] : ["turn", "blink"];
  }

  update(r: FrameReading, now: number): LivenessState {
    if (this.result === "running") {
      this.startedAt ??= now;
      if (now - this.startedAt > STEP_TIME_S) this.result = "failed";
      else if (r.faces === 1) this.advance(r, now);
    }
    const done = this.result === "done";
    return { step: done ? null : this.steps[this.index], progress: done ? 1 : this.index / this.steps.length, done, failed: this.result === "failed" };
  }

  private advance(r: FrameReading, now: number) {
    const step = this.steps[this.index];
    let finished = false;
    if (step === "blink") {
      if (r.eyesClosed >= 0.6) this.closed = true;
      else if (r.eyesClosed <= 0.3 && this.closed) {
        this.closed = false;
        this.blinks += 1;
      }
      finished = this.blinks >= BLINKS_NEEDED;
    } else {
      if (Math.abs(r.yaw) >= 22) this.turned = true;
      else if (this.turned && Math.abs(r.yaw) <= 12) finished = true;
    }
    if (!finished) return;
    this.index += 1;
    this.startedAt = now;
    this.closed = false;
    this.blinks = 0;
    this.turned = false;
    if (this.index >= this.steps.length) this.result = "done";
  }
}

export const livenessText = (s: LivenessStep) => (s === "blink" ? "Chớp mắt 2 lần" : "Quay đầu sang một bên rồi nhìn thẳng lại");
