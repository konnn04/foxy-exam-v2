/**
 * FoxyExam Enums & Domain Unions
 * Shared between Foxy VPS Server and FoxyClient (Tauri / Rust)
 */

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'TEACHER' | 'STUDENT';

export type OrganizationType = 'UNIVERSITY' | 'CENTER' | 'INDIVIDUAL';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export type ExamType = 'PROGRAMMING' | 'CLASSICAL' | 'HYBRID';

export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'ENDED';

export type ProblemDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export type SupportedLanguage = 'cpp' | 'python' | 'java' | 'c';

export type AttemptStatus = 'CONNECTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'DISQUALIFIED';

export type ViolationType = 
  | 'TAB_SWITCH'
  | 'BULK_PASTE'
  | 'FACE_LOST'
  | 'MULTI_FACE'
  | 'KEYSTROKE_ANOMALY'
  | 'DEVTOOLS_OPEN'
  | 'SPLIT_SCREEN';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
