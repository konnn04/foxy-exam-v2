/**
 * FoxyExam Enterprise Admin Shared Types
 */

export type RoleType = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'TEACHER' | 'STUDENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface UserItem {
  id: number;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  date_of_birth?: string;
  address?: string;
  username: string;
  email: string;
  role: RoleType;
  status: UserStatus;
  avatar?: string;
  organization?: {
    id?: number;
    name?: string;
    code?: string;
  };
  created_at?: string;
}

export interface OrganizationItem {
  id: number;
  name: string;
  code: string;
  type: string;
  status: string;
  plan?: string;
  active_plan_name?: string;
  exams_count?: number;
  users_count?: number;
  created_at?: string;
  slug?: string;
  is_public?: boolean;
  teachers_count?: number;
  live_exams_count?: number;
  exams_used?: number;
  exams_limit?: number;
  admin_email?: string | null;
}

export interface CourseItem {
  id: number;
  name: string;
  code: string;
  description?: string;
  teacher_name?: string;
  exams_count?: number;
  organization_name?: string;
}

export interface ExamMonitoringConfig {
  prevent_tab_switch?: boolean;
  prevent_paste?: boolean;
  max_paste_chars?: number;
  track_keystroke_dynamics?: boolean;
  ai_face_check?: boolean;
  ai_object?: boolean;
}

export interface ExamItem {
  id: number;
  title: string;
  code: string;
  type: 'PROGRAMMING' | 'QUIZ' | 'HYBRID';
  status: 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'ENDED';
  duration_minutes: number;
  start_time?: string;
  end_time?: string;
  attempts_count?: number;
  violations_count?: number;
  course_name?: string;
  course_id?: number;
  organization_name?: string;
  monitoring_config?: ExamMonitoringConfig;
}

export interface QuestionSetItem {
  id: number;
  name: string;
  code: string;
  type: 'CLASSICAL' | 'PROGRAMMING';
  description?: string;
  status: string;
  max_score: number;
  course_name?: string;
  course_code?: string;
  course_id?: number | null;
  organization_name?: string;
  questions_count: number;
  created_at?: string;
}

export interface PlanItem {
  id: number;
  name: string;
  display_name: string;
  price: number;
  billing_cycle: 'ONCE' | 'MONTHLY' | 'YEARLY';
  max_exams_per_month: number;
  max_students_per_exam: number;
  storage_limit_gb: number;
  has_ai_proctoring: boolean;
  has_code_replay: boolean;
  is_active: boolean;
  organizations_count?: number;
}

export interface InvoiceItem {
  id: number;
  invoice_code: string;
  organization_name: string;
  organization_code: string;
  plan_name: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'CANCELLED' | 'REFUNDED';
  payment_method: 'VNPAY' | 'MOMO' | 'BANK_TRANSFER' | 'CREDIT_CARD';
  transaction_id?: string;
  paid_at?: string;
  created_at: string;
  notes?: string;
}

export interface ViolationItem {
  attempt_id?: number;
  is_reviewed?: boolean;
  is_false_positive?: boolean;
  id: number;
  student_name: string;
  student_username?: string;
  exam_title: string;
  exam_id?: number;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: any;
  timestamp: string;
}
