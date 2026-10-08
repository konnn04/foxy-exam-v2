import { API_BASE_URL } from "./config";
import { getAuth } from "./authStore";
import { getSession } from "./session";

/**
 * Client gọi FoxyExam Core API. Toàn bộ type ở dưới lấy từ dữ liệu response
 * THẬT (đã test trực tiếp từng endpoint bằng tài khoản mẫu, không suy đoán từ
 * `openapi.json` — file đó chỉ mô tả request, không khai báo response schema).
 *
 * Dùng `fetch()` thẳng (không qua `@tauri-apps/plugin-http`): server Laravel
 * đã trả `Access-Control-Allow-Origin: *` nên WebView gọi thẳng được. Nếu sau
 * này CORS bị siết lại ở production, chuyển client này sang plugin-http.
 */

/** Media paths from the server are relative (`/storage/...`): resolve them against the API origin. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  try {
    return new URL(path, API_BASE_URL).toString();
  } catch {
    return path;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string[]>,
    /** Body lỗi gốc — vài endpoint gắn thêm cờ riêng, vd `action: "FORCE_LOGOUT"`
     * ở `/student/heartbeat` khi phiên thi đã kết thúc. */
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { auth = true }: { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const auth = getAuth();
    if (auth) headers.Authorization = `Bearer ${auth.token}`;
    // a student can hold several attempts (retakes, parallel exams): name the one this window belongs to
    const attempt = getSession()?.attemptId;
    if (attempt) headers["X-Foxy-Attempt"] = String(attempt);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (err) {
    throw new ApiError(0, "Không kết nối được máy chủ FoxyExam.", undefined);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Một số response (vd 204) không có body JSON — bỏ qua.
  }

  if (!res.ok) {
    const b = (body ?? {}) as { message?: string; errors?: Record<string, string[]> };
    throw new ApiError(
      res.status,
      b.message ?? `Lỗi máy chủ (HTTP ${res.status})`,
      b.errors,
      body as Record<string, unknown>,
    );
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Kiểu dữ liệu dùng chung
// ---------------------------------------------------------------------------

export interface MonitoringConfig {
  /** process names (lowercase, no .exe) usable during the exam; empty = everything but the exam is a violation */
  allowed_apps?: string[];
  require_screen?: boolean;
  require_mic?: boolean;
  prevent_tab_switch: boolean;
  prevent_paste: boolean;
  max_paste_chars: number;
  track_keystroke_dynamics: boolean;
  ai_face_check: boolean;
  /** the phone as a second camera */
  extra_camera?: "off" | "optional" | "required";
  /** AI services: identity (face service) and prohibited objects (object service) */
  ai_identity?: boolean;
  ai_objects?: boolean;
  /** sub-options of the phone camera */
  extra_camera_objects?: boolean;
  extra_camera_spot_check?: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  system: string;
  version: string;
  timestamp: string;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health", {}, { auth: false });
}

export interface AiStatusResponse {
  status: string;
  message?: string;
}

export function getAiStatus(): Promise<AiStatusResponse> {
  return request<AiStatusResponse>("/ai/status", {}, { auth: false });
}

export interface PublicOrganization {
  id: number;
  name: string;
  code: string;
  slug: string;
  type: string;
}

export function getPublicOrganizations(): Promise<ApiEnvelope<PublicOrganization[]>> {
  return request<ApiEnvelope<PublicOrganization[]>>("/public/organizations", {}, { auth: false });
}

// ---------------------------------------------------------------------------
// Auth (tài khoản sinh viên) — `/auth/*`
// ---------------------------------------------------------------------------

export interface AuthUserDto {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  organization: { id: number; name: string; code: string } | null;
}

export interface LoginResponse {
  success: boolean;
  access_token: string;
  token_type: "Bearer";
  user: AuthUserDto;
}

export function login(input: {
  orgCode: string;
  login: string;
  password: string;
}): Promise<LoginResponse> {
  return request<LoginResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        org_code: input.orgCode.trim().toUpperCase() || undefined,
        login: input.login,
        password: input.password,
        device_name: "FoxyClient Desktop",
      }),
    },
    { auth: false },
  );
}

/** `/auth/me` trả thêm vài trường hồ sơ so với lúc đăng nhập. */
export interface MeDto extends AuthUserDto {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  address: string | null;
  status: string;
}

export function getMe(): Promise<ApiEnvelope<MeDto>> {
  return request<ApiEnvelope<MeDto>>("/auth/me");
}

export function logoutRemote(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/auth/logout", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Student - Dashboard / khoá học / kỳ thi
// ---------------------------------------------------------------------------

export type ExamKind = "PROGRAMMING" | "QUIZ" | "HYBRID";

export interface DashboardExam {
  id: number;
  title: string;
  code: string;
  type: ExamKind;
  status: string;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  course: { id: number; name: string; code: string };
  has_attempt: boolean;
  attempt_status: string | null;
  attempt_score: number | null;
}

export interface DashboardCourse {
  id: number;
  name: string;
  code: string;
  description: string | null;
  teacher_name: string;
  exams_count: number;
}

export interface DashboardAttempt {
  id: number;
  exam_id: number;
  exam_title: string;
  exam_code: string;
  course_name: string;
  type: ExamKind;
  status: string;
  score: number | null;
  started_at: string | null;
  submitted_at: string | null;
}

export interface DashboardData {
  statistics: {
    total_courses: number;
    total_exams: number;
    completed_attempts: number;
    in_progress_attempts: number;
  };
  courses: DashboardCourse[];
  upcoming_exams: DashboardExam[];
  recent_attempts: DashboardAttempt[];
}

export interface AttemptSummary {
  id: number;
  status: string; // IN_PROGRESS | SUBMITTED | GRADED | ...
  score: number | null;
  started_at: string | null;
  submitted_at: string | null;
}

export interface Course {
  id: number;
  name: string;
  code: string;
  description: string | null;
  enrolled_at: string | null;
  status: string;
  teacher: { id: number; name: string; email: string; avatar: string | null } | null;
  organization_name: string | null;
  exams_count: number;
}

export function getCourses(): Promise<ApiEnvelope<Course[]>> {
  return request<ApiEnvelope<Course[]>>("/student/courses");
}

export interface CourseExam {
  id: number;
  title: string;
  code: string;
  type: ExamKind;
  duration_minutes: number;
  /** null = không giới hạn số lượt thi. */
  max_attempts: number | null;
  /** Số lượt thí sinh đã dùng cho kỳ thi này. */
  attempts_count: number;
  start_time: string | null;
  end_time: string | null;
  monitoring_config: Partial<MonitoringConfig> | null;
  latest_attempt: AttemptSummary | null;
}

export function getCourseExams(courseId: number): Promise<ApiEnvelope<CourseExam[]>> {
  return request<ApiEnvelope<CourseExam[]>>(`/student/courses/${courseId}/exams`);
}

export function getDashboard(): Promise<ApiEnvelope<DashboardData>> {
  return request<ApiEnvelope<DashboardData>>("/student/dashboard");
}

export interface StartExamData {
  attempt_id: number;
  attempt_number: number;
  status: string;
  duration_minutes: number;
  time_remaining_seconds: number;
  exam: {
    id: number;
    title: string;
    code: string;
    type: ExamKind;
    monitoring_config: MonitoringConfig;
  };
}

export function startExam(examId: number): Promise<ApiEnvelope<StartExamData>> {
  return request<ApiEnvelope<StartExamData>>(`/student/exams/${examId}/start`, {
    method: "POST",
    body: JSON.stringify({
      device_info: {
        os: "windows",
        app_version: "0.1.0-tauri",
        screen: `${window.screen.width}x${window.screen.height}`,
      },
    }),
  });
}

// ---------------------------------------------------------------------------
// Student - Exam
// ---------------------------------------------------------------------------

export interface SampleTestCase {
  input: string;
  output: string;
}

export interface Problem {
  id: number;
  order: number;
  title: string;
  description: string;
  difficulty: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  allowed_languages: string[];
  starter_templates: Partial<Record<"cpp" | "python" | "java", string>>;
  sample_test_cases: SampleTestCase[];
}

export interface PaperData {
  attempt_id: number;
  exam: {
    id: number;
    title: string;
    description: string;
    duration_minutes: number;
    remaining_seconds: number;
    monitoring_config: MonitoringConfig;
  };
  problems: Problem[];
}

export function getPaper(): Promise<ApiEnvelope<PaperData>> {
  return request<ApiEnvelope<PaperData>>("/student/paper");
}

/** Lưu ý: response KHÔNG bọc trong `data` (khác các endpoint khác). */
export interface HeartbeatResponse {
  success: boolean;
  status: string; // "IN_PROGRESS" | "FINISHED" | ...
  remaining_seconds: number;
  is_flagged: boolean;
}

export function sendHeartbeat(): Promise<HeartbeatResponse> {
  return request<HeartbeatResponse>("/student/heartbeat", { method: "POST" });
}

export interface SubmitResponseData {
  submission_id: number;
  status: string;
  submitted_at: string;
}

export function submitSolution(input: {
  programmingProblemId: number;
  language: string;
  sourceCode: string;
}): Promise<ApiEnvelope<SubmitResponseData>> {
  return request<ApiEnvelope<SubmitResponseData>>("/student/submit", {
    method: "POST",
    body: JSON.stringify({
      programming_problem_id: input.programmingProblemId,
      language: input.language,
      source_code: input.sourceCode,
    }),
  });
}

export interface Submission {
  id: number;
  exam_attempt_id: number;
  programming_problem_id: number;
  language: string;
  source_code: string;
  passed_cases_count: number;
  total_cases_count: number;
  score: number;
  status: string; // "PENDING" | "GRADED" | ...
  grading_details: unknown;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  problem: { id: number; title: string };
}

export function getSubmissions(): Promise<ApiEnvelope<Submission[]>> {
  return request<ApiEnvelope<Submission[]>>("/student/submissions");
}

export function finishExam(): Promise<{ success: boolean; message?: string }> {
  return request<{ success: boolean; message?: string }>("/student/finish", {
    method: "POST",
  });
}

export interface ClassicalOption {
  id: number;
  content: string;
  order?: number;
}

export type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "MULTIPLE_FILL_IN_BLANK"
  | "SHORT_ANSWER"
  | "ESSAY"
  | "GROUP_QUESTION";

/**
 * Per-type options as the server sends them to a candidate (never an answer key):
 * fill-in-blank -> blank_count, short answer -> max_length, essay -> mode + limits, group -> media + passage.
 */
export interface QuestionSettings {
  blank_count?: number;
  max_length?: number;
  mode?: "write" | "audio" | "file";
  min_words?: number;
  max_words?: number;
  prep_seconds?: number;
  max_seconds?: number;
  max_files?: number;
  accept?: string;
  media?: "text" | "audio" | "image";
  passage?: string;
  audio_url?: string | null;
  listen_limit?: number;
  allow_seek?: boolean;
  image_url?: string | null;
}

export interface ClassicalQuestionItem {
  id: number;
  type: QuestionType;
  content: string;
  points?: number;
  difficulty?: string;
  order?: number;
  parent_id?: number | null;
  image?: string | null;
  skill?: string | null;
  settings?: QuestionSettings | null;
  options: ClassicalOption[];
  saved_answer?: {
    answer_id?: number | null;
    selected_answer_ids?: number[] | null;
    answer_content?: string | null;
  } | null;
}

export interface TakeExamResponse {
  attempt_id: number;
  status: string;
  started_at: string;
  duration_minutes: number;
  time_remaining_seconds: number;
  is_classical: boolean;
  questions?: ClassicalQuestionItem[];
  problems?: Problem[];
}

export function takeExam(examId: number, attemptId: number): Promise<ApiEnvelope<TakeExamResponse>> {
  return request<ApiEnvelope<TakeExamResponse>>(`/student/exams/${examId}/take/${attemptId}`);
}

export function saveQuestionAnswer(input: {
  examId: number;
  attemptId: number;
  questionId: number;
  answerId?: number | null;
  selectedAnswerIds?: number[] | null;
  answerContent?: string | null;
}): Promise<{ success: boolean; message: string; saved_at: string }> {
  return request<{ success: boolean; message: string; saved_at: string }>(
    `/student/exams/${input.examId}/take/${input.attemptId}/save-answer`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "CLASSICAL",
        question_id: input.questionId,
        answer_id: input.answerId ?? undefined,
        selected_answer_ids: input.selectedAnswerIds ?? undefined,
        answer_content: input.answerContent ?? undefined,
      }),
    },
  );
}

export function submitExamAttempt(examId: number, attemptId: number): Promise<{ success: boolean; message: string; data: any }> {
  return request<{ success: boolean; message: string; data: any }>(
    `/student/exams/${examId}/submit/${attemptId}`,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// Student - AntiCheat
// ---------------------------------------------------------------------------

/** Lưu ý: response KHÔNG bọc trong `data`. */
export interface OpLogResponse {
  success: boolean;
  message: string;
  log_id: number;
}

export function sendOpLogBatch(input: {
  programmingProblemId?: number;
  batchSeq: number;
  keystrokeCount: number;
  pasteEventCount: number;
  syntheticFlags?: { bulk_insert?: boolean; chars_count?: number };
}): Promise<OpLogResponse> {
  return request<OpLogResponse>("/student/op-log", {
    method: "POST",
    body: JSON.stringify({
      programming_problem_id: input.programmingProblemId,
      batch_seq: input.batchSeq,
      keystroke_count: input.keystrokeCount,
      paste_event_count: input.pasteEventCount,
      synthetic_flags: input.syntheticFlags,
    }),
  });
}

export interface MobileCameraLink {
  url: string;
  expires_at: string;
  viewer: { url: string; token: string; room: string } | null;
}

export const issueMobileCamera = (examId: number) =>
  request<{ success: boolean; data: MobileCameraLink }>(`/student/exams/${examId}/mobile-camera`, { method: "POST" });

export function verifyMobileLayout(examId: number, frame: Blob) {
  const body = new FormData();
  body.append("frame", frame, "phone.jpg");
  return request<{ ok: boolean; message: string; problem: string | null; skipped?: boolean }>(`/student/exams/${examId}/mobile-camera/verify`, { method: "POST", body });
}

export interface MobileViewer {
  viewer: { url: string; token: string; room: string } | null;
  connected: boolean;
}

/** Credentials to watch the student's linked phone; data is null when no phone was linked for this exam. */
export const getMobileViewer = (examId: number) => request<{ success: boolean; data: MobileViewer | null }>(`/student/exams/${examId}/mobile-camera`);

export interface FaceStatus {
  enrolled: boolean;
  locked: boolean;
  enrolled_at: string | null;
}

export const getFaceStatus = () => request<{ success: boolean; data: FaceStatus }>("/student/face");

export function enrollFace(frame: Blob) {
  const body = new FormData();
  body.append("frame", frame, "face.jpg");
  return request<{ success: boolean; message: string }>("/student/face/enroll", { method: "POST", body });
}

export type ViolationType =
  | "BULK_PASTE"
  | "SYNTHETIC_INPUT"
  | "TAB_SWITCH"
  | "WINDOW_LOST_FOCUS"
  | "DEVTOOLS_OPENED"
  | "MULTIPLE_KEYBOARDS"
  | "FACE_MISMATCH"
  | "MULTIPLE_PEOPLE"
  | "NO_FACE_DETECTED"
  | "PROHIBITED_DEVICE"
  // Phát hiện bởi module giám sát Rust (server nhận chuỗi tự do, tối đa 50 ký tự).
  | "BANNED_APP"
  | "MULTIPLE_MONITORS"
  | "CAPTURE_DEVICE"
  | "SYSTEM_SHORTCUT"
  | "DEVICE_CHANGED"
  | "APP_NOT_ALLOWED"
  | "LOOKING_AWAY"
  | "GAZE_AWAY"
  | "SPOT_CHECK_FAILED"
  | "PHONE_DISCONNECTED"
  | "FACE_TOO_FAR"
  | "CAMERA_LOST"
  | "SCREEN_SHARE_STOPPED"
  | "OFFLINE_TOO_LONG";

export type ViolationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Lưu ý: response KHÔNG bọc trong `data`. */
export interface ViolationResponse {
  success: boolean;
  message: string;
  violation_id: number;
  current_risk_score: number;
  is_flagged: boolean;
}

export function reportViolation(input: {
  type: ViolationType;
  severity: ViolationSeverity;
  details?: Record<string, unknown>;
}): Promise<ViolationResponse> {
  return request<ViolationResponse>("/student/violation", {
    method: "POST",
    body: JSON.stringify({
      violation_type: input.type,
      severity: input.severity,
      details: input.details,
    }),
  });
}


// ---------------------------------------------------------------------------
// Exam detail (lobby) + realtime session
// ---------------------------------------------------------------------------

export interface ExamDetail {
  id: number;
  title: string;
  code: string;
  type: ExamKind;
  status: string;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  monitoring_config: (Partial<MonitoringConfig> & { require_mic?: boolean }) | null;
  can_start: boolean;
  ai_service: { required: boolean; available: boolean; status: string; message: string };
  course: { id: number | null; name: string | null; code: string | null };
  latest_attempt: { id: number; status: string } | null;
}

export function getExam(examId: number): Promise<ApiEnvelope<ExamDetail>> {
  return request<ApiEnvelope<ExamDetail>>(`/student/exams/${examId}`);
}

export interface RealtimeSession {
  attempt_id: number;
  exam_id: number;
  server_time_ms: number;
  remaining_seconds: number;
  expires_at: string;
  ingest: {
    url: string;
    time_url: string;
    token: string;
    flush_interval_ms: number;
    max_batch_events: number;
    max_body_bytes: number;
    compress: string;
  };
  evidence: { presign_url: string; commit_url: string; allowed_content_types: string[] };
  livekit: { url: string; room: string; identity: string; token: string } | null;
}

/** 503 + `error_code: "REALTIME_DISABLED"` when the server runs without the realtime plane. */
export function getRealtimeSession(attemptId?: number): Promise<ApiEnvelope<RealtimeSession>> {
  return request<ApiEnvelope<RealtimeSession>>("/student/realtime/session", {
    method: "POST",
    body: JSON.stringify(attemptId ? { attempt_id: attemptId } : {}),
  });
}
