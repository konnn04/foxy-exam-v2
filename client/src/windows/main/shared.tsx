import { useCallback, useEffect, useState } from "react";
import { ClipboardX, Code2, Keyboard, Layers, ListChecks, ScanFace, AppWindow as AppWindowIcon } from "lucide-react";
import type { Course, CourseExam, DashboardData, ExamKind, MeDto } from "../../lib/api";
import { captureDevices, getSnapshot, screenCount, type SystemSnapshot } from "../../lib/monitor";
import { Badge, Tip } from "../../components/ui";
import { formatDate, formatDateTime, formatTime } from "../../lib/datetime";

export type Page = "dashboard" | "courses" | "exams" | "history" | "profile" | "settings";

/** Kỳ thi kèm thông tin khoá học — gộp từ `/student/courses/{id}/exams`. */
export interface ExamItem extends CourseExam {
  course: { id: number; name: string; code: string };
}

export interface StudentData {
  dashboard: DashboardData | null;
  courses: Course[];
  exams: ExamItem[];
  me: MeDto | null;
}

export interface PageProps {
  data: StudentData;
  loading: boolean;
  startingId: number | null;
  onStart: (exam: { id: number; title: string; code: string; type: "QUIZ" | "PROGRAMMING" | "HYBRID" }) => void;
  onNavigate: (page: Page) => void;
  device: DeviceCheck;
}

// ---------------------------------------------------------------------------
// Trạng thái kỳ thi
// ---------------------------------------------------------------------------

export type ExamState = "in_progress" | "open" | "upcoming" | "done" | "missed";

export function examState(e: CourseExam, now = Date.now()): ExamState {
  const a = e.latest_attempt;
  if (a?.status === "IN_PROGRESS") return "in_progress";
  if (a && a.status !== "IN_PROGRESS") return "done";
  const start = e.start_time ? Date.parse(e.start_time) : null;
  const end = e.end_time ? Date.parse(e.end_time) : null;
  if (start && now < start) return "upcoming";
  if (end && now > end) return "missed";
  return "open";
}

/** Đang trong khung giờ mở phòng (NULL = không giới hạn phía đó). */
export function withinSchedule(e: CourseExam, now = Date.now()) {
  const start = e.start_time ? Date.parse(e.start_time) : null;
  const end = e.end_time ? Date.parse(e.end_time) : null;
  return (!start || now >= start) && (!end || now <= end);
}

/** Số lượt còn lại; null = không giới hạn. */
export function attemptsLeft(e: CourseExam): number | null {
  if (e.max_attempts == null) return null;
  return Math.max(0, e.max_attempts - (e.attempts_count ?? 0));
}

/** Đã nộp lượt trước, còn lượt và phòng vẫn đang mở -> được thi lại. */
export function canRetake(e: CourseExam) {
  const left = attemptsLeft(e);
  return examState(e) === "done" && (left === null || left > 0) && withinSchedule(e);
}

export function ExamStateBadge({ exam }: { exam: CourseExam }) {
  const s = examState(exam);
  switch (s) {
    case "in_progress":
      return <Badge tone="danger">Đang thi</Badge>;
    case "open":
      return <Badge tone="accent">Sẵn sàng</Badge>;
    case "upcoming":
      return <Badge>Chưa mở</Badge>;
    case "missed":
      return <Badge tone="warning">Quá hạn</Badge>;
    case "done":
      return exam.latest_attempt?.score != null ? (
        <Badge tone="success">{fmtScore(exam.latest_attempt.score)} điểm</Badge>
      ) : (
        <Badge tone="success">Đã nộp</Badge>
      );
  }
}

export const KIND_LABEL: Record<ExamKind, string> = {
  PROGRAMMING: "Lập trình",
  QUIZ: "Trắc nghiệm",
  HYBRID: "Hỗn hợp",
};

export function KindIcon({ kind, size = 15 }: { kind: ExamKind; size?: number }) {
  if (kind === "PROGRAMMING") return <Code2 size={size} />;
  if (kind === "QUIZ") return <ListChecks size={size} />;
  return <Layers size={size} />;
}

/** Icon các cơ chế giám sát mà kỳ thi yêu cầu (`monitoring_config`). */
export const MONITOR_FLAGS = [
  { key: "ai_face_check", label: "Xác thực khuôn mặt (AI)", icon: ScanFace },
  { key: "prevent_tab_switch", label: "Chặn chuyển cửa sổ", icon: AppWindowIcon },
  { key: "prevent_paste", label: "Chặn dán từ ngoài", icon: ClipboardX },
  { key: "track_keystroke_dynamics", label: "Ghi nhận nhịp gõ phím", icon: Keyboard },
] as const;

export function MonitorIcons({ config }: { config: CourseExam["monitoring_config"] }) {
  const active = MONITOR_FLAGS.filter((f) => config?.[f.key]);
  if (active.length === 0) return <span className="text-subtle">—</span>;
  return (
    <span className="flex items-center gap-1.5 text-muted">
      {active.map(({ key, label, icon: Icon }) => (
        <Tip key={key} label={label}>
          <Icon size={14} />
        </Tip>
      ))}
    </span>
  );
}


// ---------------------------------------------------------------------------
// Định dạng
// ---------------------------------------------------------------------------

export const fmtScore = (n: number) => (Math.round(n * 10) / 10).toString();

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return formatDate(iso).slice(0, 5);
}

export function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return formatTime(iso);
}

export function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return formatDateTime(iso);
}

/** "4 giờ nữa", "2 ngày trước"... */
export function fromNow(iso: string | null, now = Date.now()) {
  if (!iso) return "";
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const min = 60_000;
  const [v, unit] =
    abs < min ? [0, "phút"] : abs < 60 * min ? [Math.round(abs / min), "phút"] : abs < 24 * 60 * min ? [Math.round(abs / (60 * min)), "giờ"] : [Math.round(abs / (24 * 60 * min)), "ngày"];
  if (v === 0) return "bây giờ";
  return diff > 0 ? `${v} ${unit} nữa` : `${v} ${unit} trước`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// ---------------------------------------------------------------------------
// Kiểm tra thiết bị (dùng API giám sát Rust)
// ---------------------------------------------------------------------------

export interface DeviceCheck {
  snapshot: SystemSnapshot | null;
  checking: boolean;
  error: string | null;
  refresh: () => void;
  cameras: number;
  microphones: number;
  displays: number;
  captureCards: number;
  /** Bàn phím NGOÀI (USB/Bluetooth có VID:PID) — bàn phím tích hợp laptop không tính. */
  keyboards: number;
}

export function useDeviceCheck(): DeviceCheck {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setChecking(true);
    setError(null);
    getSnapshot()
      .then(setSnapshot)
      .catch((e) => setError(String(e)))
      .finally(() => setChecking(false));
  }, []);

  useEffect(refresh, [refresh]);

  const devices = snapshot?.devices ?? [];
  return {
    snapshot,
    checking,
    error,
    refresh,
    cameras: devices.filter((d) => d.kind === "camera").length,
    microphones: snapshot?.microphones.length ?? 0,
    displays: snapshot ? screenCount(snapshot.displays, devices) : 0,
    captureCards: captureDevices(devices).length,
    keyboards: new Set(devices.filter((d) => d.kind === "keyboard" && d.hardwareId).map((d) => d.hardwareId)).size,
  };
}
