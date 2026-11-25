/**
 * Draws what MediaPipe found on top of the camera preview, so the candidate can SEE that the face is recognised:
 * corner brackets around each face and a few key points (eyes, nose, mouth). Colour = state (theme tokens):
 * green when the face is straight, amber when it needs adjusting, red when more than one person is in view.
 */
export type OverlayTone = "ok" | "warn" | "bad";

export interface Pt {
  x: number;
  y: number;
}

// landmark indices of the 478-point face mesh (468+ are the irises)
const KEY_POINTS = [33, 133, 263, 362, 1, 61, 291, 468, 473];

const cssColor = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function clearOverlay(canvas: HTMLCanvasElement | null) {
  const ctx = canvas?.getContext("2d");
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** `faces` are normalised (0..1 of the video frame); `video` tells how the frame is cropped inside its box. */
export function drawFaceOverlay(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null, faces: Pt[][], tone: OverlayTone) {
  if (!canvas || !video || video.videoWidth === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (faces.length === 0) return;

  // object-cover: the frame is scaled until it fills the box, the overflow is cropped evenly
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;
  const map = (p: Pt): Pt => ({ x: ox + p.x * vw * scale, y: oy + p.y * vh * scale });

  const color =
    tone === "ok" ? cssColor("--color-success", "#22a06b") : tone === "warn" ? cssColor("--color-warning", "#d9a21b") : cssColor("--color-danger", "#e5484d");
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const face of faces) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of face) {
      const m = map(p);
      x0 = Math.min(x0, m.x);
      y0 = Math.min(y0, m.y);
      x1 = Math.max(x1, m.x);
      y1 = Math.max(y1, m.y);
    }
    const padX = (x1 - x0) * 0.08;
    const padY = (y1 - y0) * 0.08;
    x0 -= padX;
    x1 += padX;
    y0 -= padY;
    y1 += padY;
    const arm = Math.min(x1 - x0, y1 - y0) * 0.22;
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ] as const) {
      ctx.moveTo(cx + dx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * arm);
    }
    ctx.stroke();

    for (const i of KEY_POINTS) {
      const p = face[i];
      if (!p) continue;
      const m = map(p);
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
