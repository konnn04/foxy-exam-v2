/**
 * FoxyExam Data Models
 * Shared contracts between Laravel Backend, Inertia Web, and Tauri Desktop Client
 */

import { 
  UserRole, 
  OrganizationType, 
  OrganizationStatus, 
  ExamType, 
  ExamStatus, 
  ProblemDifficulty, 
  SupportedLanguage,
  AttemptStatus,
  ViolationType,
  SeverityLevel 
} from './enums';

export interface Plan {
  id: number;
  name: string;
  display_name: string;
  price: number;
  max_exams_per_month: number;
  max_students_per_exam: number;
  storage_limit_gb: number;
  has_ai_proctoring: boolean;
  has_code_replay: boolean;
  is_active?: boolean;
}

export interface Organization {
  id: number;
  name: string;
  code: string;
  slug?: string;
  type: OrganizationType;
  status: OrganizationStatus;
  plan?: string;
  active_plan_name?: string;
  exams_count?: number;
  users_count?: number;
  created_at?: string;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED';
  organization_id?: number;
  organization?: {
    id?: number;
    name?: string;
    code?: string;
    type?: OrganizationType;
    plan?: string;
  };
  created_at?: string;
}

export interface Course {
  id: number;
  name: string;
  code: string;
  description?: string;
  teacher_id?: number;
  teacher_name?: string;
  organization_id?: number;
  organization_name?: string;
  exams_count?: number;
  created_at?: string;
}

export interface MonitoringConfig {
  prevent_tab_switch: boolean;
  prevent_paste: boolean;
  max_paste_chars: number;
  ai_face_check: boolean;
  track_keystroke_dynamics: boolean;
}

export interface Exam {
  id: number;
  title: string;
  code: string;
  description?: string;
  course_id: number;
  course_name?: string;
  organization_id?: number;
  organization_name?: string;
  type: ExamType;
  status: ExamStatus;
  duration_minutes: number;
  attempts_count?: number;
  monitoring_config?: MonitoringConfig;
  created_at?: string;
}

export interface TestCase {
  id?: number;
  input: string;
  expected_output: string;
  is_sample: boolean;
  points?: number;
}

export interface ProgrammingProblem {
  id: number;
  exam_id: number;
  exam_title?: string;
  exam_code?: string;
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  time_limit_ms: number;
  memory_limit_mb: number;
  allowed_languages?: SupportedLanguage[];
  starter_templates?: Record<string, string>;
  test_cases_count?: number;
  test_cases?: TestCase[];
}

export interface ExamAttempt {
  id: number;
  user_id: number;
  exam_id: number;
  student_name: string;
  student_username: string;
  status: AttemptStatus;
  score: number;
  started_at?: string;
  submitted_at?: string;
}

export interface Violation {
  id: number;
  attempt_id?: number;
  student_name: string;
  student_username?: string;
  exam_title: string;
  exam_code?: string;
  type: ViolationType;
  severity: SeverityLevel;
  details?: Record<string, any>;
  timestamp: string;
}

export interface QuotaUsage {
  plan_name: string;
  exams_used: number;
  exams_limit: number;
  students_limit: number;
  has_ai: boolean;
  has_code_replay: boolean;
}

export interface DashboardStats {
  total_organizations: number;
  total_exams: number;
  total_attempts: number;
  active_subscriptions: number;
  total_users: number;
  total_courses: number;
}
