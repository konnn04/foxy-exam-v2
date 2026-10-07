import { stopStream } from "./media";

/**
 * The camera / screen streams opened in the pre-exam lobby. They live in this module (one JS runtime per
 * Tauri window) so the exam screen of the SAME window can publish them without asking the student again.
 */
interface LobbyMedia {
  camera: MediaStream | null;
  screen: MediaStream | null;
}

let media: LobbyMedia = { camera: null, screen: null };

export const getLobbyMedia = (): LobbyMedia => media;

export function setLobbyMedia(patch: Partial<LobbyMedia>) {
  media = { ...media, ...patch };
}

export function releaseLobbyMedia() {
  stopStream(media.camera);
  stopStream(media.screen);
  media = { camera: null, screen: null };
}

/** Pending exam picked in the dashboard: the attempt is created only AFTER the lobby, so setup time is not exam time. */
export interface PendingExam {
  id: number;
  title: string;
  code: string;
  type: "QUIZ" | "PROGRAMMING" | "HYBRID";
}

const PENDING_KEY = "foxyexam:pending-exam";

export const savePendingExam = (p: PendingExam) => localStorage.setItem(PENDING_KEY, JSON.stringify(p));
export const clearPendingExam = () => localStorage.removeItem(PENDING_KEY);
/** The pending exam, but only for the window that runs its type: every window shares this storage. */
export function getPendingExam(window?: "classic" | "code"): PendingExam | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as PendingExam | null;
    if (!p || !window) return p;
    return (p.type === "QUIZ") === (window === "classic") ? p : null;
  } catch {
    return null;
  }
}
