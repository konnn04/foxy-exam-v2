import type { MonitoringConfig } from "./api";

export interface SessionStudent {
  id: number;
  username: string;
  name: string;
}

export interface SessionExam {
  id: number;
  title: string;
  code: string;
  duration_minutes: number;
  monitoring_config: MonitoringConfig;
}

export interface Session {
  token: string;
  attemptId: number;
  attemptNumber: number;
  /** null = không giới hạn số lượt thi. */
  maxAttempts: number | null;
  student: SessionStudent;
  exam: SessionExam;
}

const STORAGE_KEY = "foxyexam:session";

/**
 * Lưu phiên đăng nhập vào `localStorage`. Mọi cửa sổ của app dùng chung 1
 * WebView profile nên đọc lại được ngay (xem `getSession`) — chỉ cần đọc lại
 * đúng lúc (khi cửa sổ đó được focus/mở lên), vì mỗi cửa sổ có runtime JS
 * riêng, không tự động nghe được thay đổi từ cửa sổ khác.
 */
export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
