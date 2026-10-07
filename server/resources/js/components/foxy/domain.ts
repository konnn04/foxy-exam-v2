import { formatTime } from '@/lib/datetime';
import type { Tone } from './ui';

/** Severity → short label + tone, as in the design's SEV map (CRITICAL folds into "Cao"). */
export const SEVERITY: Record<string, { label: string; long: string; tone: Tone }> = {
  CRITICAL: { label: 'Cao', long: 'Nghiêm trọng', tone: 'danger' },
  HIGH: { label: 'Cao', long: 'Cao', tone: 'danger' },
  MEDIUM: { label: 'TB', long: 'Trung bình', tone: 'warning' },
  LOW: { label: 'Thấp', long: 'Thấp', tone: 'info' },
};
export const severityOf = (s?: string) => SEVERITY[(s || 'MEDIUM').toUpperCase()] ?? SEVERITY.MEDIUM;

/** violations.violation_type enum → Vietnamese label. */
export const VIOLATION_LABEL: Record<string, string> = {
  BULK_PASTE: 'Dán code hàng loạt',
  SYNTHETIC_INPUT: 'Nhập liệu giả lập',
  TAB_SWITCH: 'Chuyển tab',
  WINDOW_LOST_FOCUS: 'Chuyển sang cửa sổ khác',
  DEVTOOLS_OPENED: 'Mở Developer Tools',
  MULTIPLE_KEYBOARDS: 'Nhiều bàn phím',
  FACE_MISMATCH: 'Khuôn mặt không khớp',
  MULTIPLE_PEOPLE: 'Nhiều người trong khung hình',
  NO_FACE_DETECTED: 'Không thấy khuôn mặt',
  PROHIBITED_DEVICE: 'Thiết bị / vật cấm',
};
export const violationLabel = (t?: string) => (t && VIOLATION_LABEL[t]) || t || 'Vi phạm';

/** Groups used by the "Vi phạm theo loại" donut. */
export const VIOLATION_GROUP: Record<string, { label: string; tone: Tone }> = {
  BULK_PASTE: { label: 'Dán code (BULK_PASTE)', tone: 'danger' },
  SYNTHETIC_INPUT: { label: 'Dán code (BULK_PASTE)', tone: 'danger' },
  TAB_SWITCH: { label: 'Chuyển tab / cửa sổ', tone: 'warning' },
  WINDOW_LOST_FOCUS: { label: 'Chuyển tab / cửa sổ', tone: 'warning' },
  NO_FACE_DETECTED: { label: 'Không nhìn camera / khuôn mặt', tone: 'info' },
  FACE_MISMATCH: { label: 'Không nhìn camera / khuôn mặt', tone: 'info' },
  MULTIPLE_PEOPLE: { label: 'Không nhìn camera / khuôn mặt', tone: 'info' },
  DEVTOOLS_OPENED: { label: 'DevTools / phím cấm', tone: 'violet' },
  MULTIPLE_KEYBOARDS: { label: 'DevTools / phím cấm', tone: 'violet' },
};

/** Hex-free colours for SVG / conic charts — resolved from the theme tokens. */
export const TONE_VAR: Record<Tone, string> = {
  neutral: 'color-mix(in oklch, var(--muted-foreground) 55%, transparent)',
  brand: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  danger: 'var(--danger)',
  violet: 'var(--violet)',
  outline: 'var(--border)',
};

/** Review status of a violation (is_reviewed / is_false_positive). */
export function reviewStatus(v: { is_reviewed?: boolean; is_false_positive?: boolean }): { key: string; label: string; tone: Tone } {
  if (v.is_false_positive) return { key: 'false_positive', label: 'Báo nhầm', tone: 'outline' };
  if (v.is_reviewed) return { key: 'confirmed', label: 'Đã xác nhận', tone: 'danger' };
  return { key: 'pending', label: 'Chờ duyệt', tone: 'neutral' };
}

export const ATTEMPT_STATUS: Record<string, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: 'Chưa vào', tone: 'neutral' },
  IN_PROGRESS: { label: 'Đang làm', tone: 'success' },
  SUBMITTED: { label: 'Đã nộp', tone: 'info' },
  FORCE_ENDED: { label: 'Bị đình chỉ', tone: 'danger' },
};

export const VERDICT: Record<string, { label: string; tone: Tone }> = {
  ACCEPTED: { label: 'AC', tone: 'success' },
  WRONG_ANSWER: { label: 'WA', tone: 'danger' },
  TIME_LIMIT_EXCEEDED: { label: 'TLE', tone: 'warning' },
  RUNTIME_ERROR: { label: 'RE', tone: 'danger' },
  PENDING: { label: '…', tone: 'neutral' },
  PARTIAL: { label: 'PA', tone: 'warning' },
};

export const DIFFICULTY: Record<string, { label: string; short: string; tone: Tone }> = {
  EASY: { label: 'Dễ', short: 'Dễ', tone: 'success' },
  MEDIUM: { label: 'Trung bình', short: 'TB', tone: 'warning' },
  HARD: { label: 'Khó', short: 'Khó', tone: 'danger' },
  EXPERT: { label: 'Rất khó', short: 'Rất khó', tone: 'violet' },
};

export const PLAN_TONE: Record<string, Tone> = { FREE: 'neutral', PRO: 'brand', ENTERPRISE: 'info' };

export const ORG_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Hoạt động', tone: 'success' },
  EXPIRED: { label: 'Hết hạn', tone: 'warning' },
  SUSPENDED: { label: 'Tạm khóa', tone: 'danger' },
};

export const initials = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** "00:23:14" offset of `t` from `start`. */
export function clockOffset(start?: string | null, t?: string | null) {
  if (!start || !t) return '--:--:--';
  const s = Math.max(0, Math.floor((new Date(t).getTime() - new Date(start).getTime()) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ`;
  return `${Math.floor(s / 86400)} ngày`;
}

export const hhmm = (iso?: string | null) =>
  iso ? formatTime(iso) : '--:--';
export const hhmmss = (iso?: string | null) =>
  iso ? formatTime(iso, true) : '--:--:--';

/** Short human summary of a violation's JSON `details`. */
export function violationDetail(details: unknown): string {
  if (!details) return '';
  if (typeof details === 'string') return details;
  const d = details as Record<string, unknown>;
  if (d.chars_count != null || d.length != null) return `${d.chars_count ?? d.length} ký tự${d.file ? ` vào ${d.file}` : ''}`;
  if (d.duration_ms != null) return `${Math.round(Number(d.duration_ms) / 1000)} giây`;
  if (d.message) return String(d.message);
  return Object.entries(d)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}
