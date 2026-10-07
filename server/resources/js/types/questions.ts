export type ClassicalQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'MULTIPLE_FILL_IN_BLANK'
  | 'SHORT_ANSWER'
  | 'ESSAY'
  | 'GROUP_QUESTION';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

/** Per-type options stored in classical_questions.settings (see App\Support\QuestionSettings). */
export interface QuestionSettings {
  blanks?: { answers: string[] }[];
  reference?: string;
  mode?: 'write' | 'audio' | 'file';
  min_words?: number;
  max_words?: number;
  prep_seconds?: number;
  max_seconds?: number;
  max_files?: number;
  accept?: string;
  media?: 'text' | 'audio' | 'image';
  passage?: string;
  audio_url?: string | null;
  listen_limit?: number;
  allow_seek?: boolean;
  image_url?: string | null;
}

export interface ClassicalAnswer {
  id?: number;
  content: string;
  is_correct: boolean;
  order?: number;
}

export interface ClassicalQuestionItem {
  id: number;
  parent_id?: number | null;
  type: ClassicalQuestionType;
  content: string;
  explanation?: string | null;
  is_true?: boolean | null;
  settings?: QuestionSettings | null;
  skill?: string | null;
  image?: string | null;
  points: number;
  difficulty: string;
  order: number;
  answers?: ClassicalAnswer[];
  children?: ClassicalQuestionItem[];
}

export interface TestCaseItem {
  id?: number;
  input_data: string;
  expected_output: string;
  is_sample: boolean;
  score_weight: number;
}

export interface ProgrammingProblemItem {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  allowed_languages?: string[];
  starter_templates?: Record<string, string>;
  order: number;
  test_cases?: TestCaseItem[];
}

export interface QuestionSetDetail {
  id: number;
  name: string;
  code: string;
  type: 'CLASSICAL' | 'PROGRAMMING';
  description?: string;
  status: string;
  max_score: number;
  limit_questions?: number;
  ratio_per_difficulty?: Partial<Record<Difficulty, number>> | null;
  course_name?: string;
  course_id?: number | null;
  organization_name?: string;
  creator_name?: string;
}

export interface CourseOption {
  id: number;
  name: string;
  code: string;
}

export interface QuestionSetOtherSet {
  id: number;
  name: string;
  code: string;
  type: string;
}
