/**
 * FoxyExam API Protocols & Payloads
 * Shared between Foxy VPS REST API and Tauri FoxyClient
 */

import { SupportedLanguage, ViolationType, SeverityLevel } from './enums';
import { ProgrammingProblem } from './models';

export interface StudentLoginRequest {
  room_code: string;
  student_id: string;
  full_name: string;
}

export interface StudentLoginResponse {
  token: string;
  student: {
    id: number;
    name: string;
    student_id: string;
  };
  exam: {
    title: string;
    duration_minutes: number;
    monitoring_config: {
      prevent_tab_switch: boolean;
      prevent_paste: boolean;
      max_paste_chars: number;
      ai_face_check: boolean;
    };
  };
}

export interface StudentPaperResponse {
  exam_title: string;
  duration_minutes: number;
  problems: ProgrammingProblem[];
}

export interface OpLogPayload {
  attempt_id: number;
  chars_added: number;
  paste_event_count: number;
  keystroke_timestamps?: number[];
}

export interface ClientViolationPayload {
  attempt_id: number;
  violation_type: ViolationType;
  severity: SeverityLevel;
  details?: Record<string, any>;
}

export interface CodeSubmissionPayload {
  problem_id: number;
  language: SupportedLanguage;
  code: string;
}
