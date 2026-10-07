import { FileText, Layers, ListChecks, PencilLine, TextCursorInput, ToggleRight, type LucideIcon } from 'lucide-react';
import type { ClassicalQuestionItem, QuestionSettings } from '@/types/questions';

/**
 * Editor-side model of a classical question. The six exam-sys types map to six "kinds";
 * CHOICE is saved as SINGLE_CHOICE or MULTIPLE_CHOICE depending on how many answers are marked correct.
 */
export type Kind = 'CHOICE' | 'TRUE_FALSE' | 'FILL' | 'SHORT_ANSWER' | 'ESSAY' | 'GROUP_QUESTION';

export const KINDS: Record<Kind, { label: string; icon: LucideIcon; desc: string }> = {
  CHOICE: { label: 'Trắc nghiệm', icon: ListChecks, desc: 'Có ≥ 2 đáp án, ≥ 1 đúng' },
  TRUE_FALSE: { label: 'Đúng/Sai', icon: ToggleRight, desc: 'Chọn Đúng hoặc Sai' },
  FILL: { label: 'Điền khuyết', icon: TextCursorInput, desc: 'Mỗi ô trống [1], [2]… một đáp án' },
  SHORT_ANSWER: { label: 'Trả lời ngắn', icon: PencilLine, desc: '< 300 ký tự, chấm tự động nếu có đáp án mẫu' },
  ESSAY: { label: 'Tự luận', icon: FileText, desc: 'Viết, ghi âm hoặc nộp tệp — chấm tay' },
  GROUP_QUESTION: { label: 'Câu hỏi nhóm', icon: Layers, desc: 'Đoạn văn / audio / hình + câu con' },
};

export const DIFFICULTY_ORDER = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;
export const SKILLS = ['Nghe', 'Nói', 'Đọc', 'Viết', 'Ngữ pháp', 'Từ vựng'];
export const TF = ['Đúng', 'Sai'] as const;

export interface EssayCfg {
  mode: 'write' | 'audio' | 'file';
  min_words: number;
  max_words: number;
  prep_seconds: number;
  max_seconds: number;
  max_files: number;
  accept: string;
}
export interface GroupCfg {
  media: 'text' | 'audio' | 'image';
  passage: string;
  audio_url: string;
  listen_limit: number;
  allow_seek: boolean;
  image_url: string;
}

export interface Draft {
  id: number | null;
  parent_id: number | null;
  kind: Kind;
  content: string;
  explanation: string;
  points: number;
  difficulty: string;
  skill: string;
  image: string;
  is_true: boolean;
  answers: { content: string; is_correct: boolean }[];
  /** one entry per blank; accepted answers separated by | */
  blanks: string[];
  reference: string;
  essay: EssayCfg;
  group: GroupCfg;
}

const ESSAY0: EssayCfg = { mode: 'write', min_words: 0, max_words: 0, prep_seconds: 60, max_seconds: 120, max_files: 3, accept: '.pdf .jpg .png' };
const GROUP0: GroupCfg = { media: 'text', passage: '', audio_url: '', listen_limit: 2, allow_seek: false, image_url: '' };

export function kindOf(q: Pick<ClassicalQuestionItem, 'type'>): Kind {
  switch (q.type) {
    case 'TRUE_FALSE':
      return 'TRUE_FALSE';
    case 'MULTIPLE_FILL_IN_BLANK':
      return 'FILL';
    case 'SHORT_ANSWER':
    case 'ESSAY':
    case 'GROUP_QUESTION':
      return q.type;
    default:
      return 'CHOICE';
  }
}

/** [1], [2]… markers used in a fill-in-blank sentence, as sorted unique numbers. */
export const blankNumbers = (content: string): number[] => [...new Set([...content.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);

export function draftOf(q: ClassicalQuestionItem): Draft {
  const s: QuestionSettings = q.settings ?? {};
  return {
    id: q.id,
    parent_id: q.parent_id ?? null,
    kind: kindOf(q),
    content: q.content,
    explanation: q.explanation ?? '',
    points: Number(q.points),
    difficulty: q.difficulty || 'MEDIUM',
    skill: q.skill ?? '',
    image: q.image ?? '',
    is_true: !!q.is_true,
    answers: (q.answers ?? []).map((a) => ({ content: a.content, is_correct: !!a.is_correct })),
    blanks: (s.blanks ?? []).map((b) => (b.answers ?? []).join(' | ')),
    reference: s.reference ?? '',
    essay: { ...ESSAY0, ...(q.type === 'ESSAY' ? (s as Partial<EssayCfg>) : {}) },
    group: {
      ...GROUP0,
      ...(q.type === 'GROUP_QUESTION'
        ? { media: s.media ?? 'text', passage: s.passage ?? '', audio_url: s.audio_url ?? '', listen_limit: s.listen_limit ?? 2, allow_seek: !!s.allow_seek, image_url: s.image_url ?? '' }
        : {}),
    },
  };
}

export function newDraft(kind: Kind, parent_id: number | null): Draft {
  return {
    id: null,
    parent_id,
    kind,
    content: '',
    explanation: '',
    points: kind === 'GROUP_QUESTION' ? 0 : 1,
    difficulty: 'MEDIUM',
    skill: '',
    image: '',
    is_true: true,
    answers: kind === 'CHOICE' ? ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'].map((content, i) => ({ content, is_correct: i === 0 })) : [],
    blanks: [],
    reference: '',
    essay: { ...ESSAY0 },
    group: { ...GROUP0 },
  };
}

/** Body of POST /admin/question-sets/{id}/classical-questions. */
export function payloadOf(d: Draft): Record<string, any> {
  const base = {
    id: d.id,
    parent_id: d.parent_id,
    content: d.content,
    explanation: d.explanation || null,
    points: d.kind === 'GROUP_QUESTION' ? 0 : d.points,
    difficulty: d.difficulty,
    skill: d.skill || null,
    image: d.image || null,
  };
  switch (d.kind) {
    case 'CHOICE':
      return { ...base, type: d.answers.filter((a) => a.is_correct).length > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE', answers: d.answers };
    case 'TRUE_FALSE':
      return { ...base, type: 'TRUE_FALSE', is_true: d.is_true };
    case 'FILL': {
      const n = Math.max(0, ...blankNumbers(d.content));
      const blanks = Array.from({ length: n }, (_, i) => ({ answers: (d.blanks[i] ?? '').split('|').map((x) => x.trim()).filter(Boolean) }));
      return { ...base, type: 'MULTIPLE_FILL_IN_BLANK', settings: { blanks } };
    }
    case 'SHORT_ANSWER':
      return { ...base, type: 'SHORT_ANSWER', settings: { reference: d.reference } };
    case 'ESSAY':
      return { ...base, type: 'ESSAY', settings: d.essay };
    case 'GROUP_QUESTION':
      return { ...base, type: 'GROUP_QUESTION', settings: d.group };
  }
}

/** Client-side mirror of the server's semantic checks, so the author sees the problem next to the field. */
export function validateDraft(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.content.trim()) e.content = 'Nhập nội dung câu hỏi.';
  if (d.kind === 'CHOICE') {
    const filled = d.answers.filter((a) => a.content.trim());
    if (filled.length < 2) e.answers = 'Trắc nghiệm cần ít nhất 2 đáp án.';
    else if (!filled.some((a) => a.is_correct)) e.answers = 'Đánh dấu ít nhất một đáp án đúng.';
  }
  if (d.kind === 'FILL') {
    const nums = blankNumbers(d.content);
    if (!nums.length) e.content = 'Dùng [1], [2]… trong nội dung để tạo ô trống.';
    else {
      const missing = nums.filter((n) => !(d.blanks[n - 1] ?? '').split('|').some((x) => x.trim()));
      if (missing.length) e.blanks = `Nhập đáp án cho ô ${missing.join(', ')}.`;
    }
  }
  if (d.kind === 'ESSAY' && d.essay.mode === 'write' && d.essay.max_words && d.essay.min_words > d.essay.max_words) e.essay = 'Số từ tối thiểu không được lớn hơn tối đa.';
  if (d.kind === 'GROUP_QUESTION') {
    if (d.group.media === 'audio' && !d.group.audio_url.trim()) e.group = 'Chọn hoặc tải tệp âm thanh.';
    if (d.group.media === 'image' && !d.group.image_url.trim()) e.group = 'Chọn hoặc tải hình ảnh.';
  }
  return e;
}
