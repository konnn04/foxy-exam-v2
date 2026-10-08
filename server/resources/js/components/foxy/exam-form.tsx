/**
 * Shared pieces of the two exam forms (Thi phổ thông / Thi lập trình).
 * Create and edit render the very same page; only `exam` (null on create) differs.
 */
import React, { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { CalendarCheck, Code, GraduationCap, KeyRound, ListChecks, Plus, Save, ShieldCheck, Trash2, TriangleAlert, Users, X } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import {
  EmptyState,
  Field,
  FxButton,
  FxInput,
  FxSelect,
  PageHeader,
  Panel,
  PanelBar,
  PanelTitle,
  Pill,
  RadioCards,
  Segmented,
  StepFooter,
  StepTabs,
  Switch,
  ToggleList,
  type Tone,
} from './ui';
import { DIFFICULTY, initials } from './domain';
import { useDialog } from './dialogs';
import { Combobox } from './combobox';
import { DateTimeInput } from './datetime-input';
import { StudentPicker } from './student-picker';
import { cn } from '@/lib/utils';

export type ExamKind = 'general' | 'programming';

export interface ExamSetOption {
  id: number;
  name: string;
  code: string;
  type: 'CLASSICAL' | 'PROGRAMMING';
  status?: string;
  course_id: number | null;
  course_name?: string | null;
  max_score?: number;
  questions_count?: number;
  problems?: { id: number; title: string; difficulty: string; time_limit_ms: number; memory_limit_mb: number }[];
}

export interface ExamPayload {
  id: number;
  title: string;
  code: string;
  course_id: number;
  question_set_id: number | null;
  duration_minutes: number;
  start_time: string | null;
  end_time: string | null;
  max_attempts: number | null;
  status: string;
  monitoring_config: Record<string, any>;
  attempts_count: number;
  proctor_ids?: number[];
  excluded_student_ids?: number[];
}

export interface ProctorOption {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface ExamFormPageProps {
  user: any;
  teams: TeamItem[];
  courses: { id: number; name: string; code: string; students_count?: number }[];
  questionSets: ExamSetOption[];
  proctorOptions?: ProctorOption[];
  defaultCourseId?: number | null;
  quota?: { plan_name: string; exams_used: number; exams_limit: number; students_limit: number; has_ai: boolean };
  exam: ExamPayload | null;
}

export const EXAM_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  PUBLISHED: { label: 'Đã lên lịch', tone: 'info' },
  IN_PROGRESS: { label: 'Đang diễn ra', tone: 'success' },
  ENDED: { label: 'Đã kết thúc', tone: 'outline' },
};

export const KIND_META: Record<ExamKind, { label: string; desc: string; icon: typeof Code; chip: string; tone: Tone; setLabel: string }> = {
  general: {
    label: 'Thi phổ thông',
    desc: 'Trắc nghiệm, đúng/sai, trả lời ngắn, tự luận, câu hỏi nhóm. Dùng bộ đề phổ thông.',
    icon: ListChecks,
    chip: 'bg-info/25',
    tone: 'info',
    setLabel: 'bộ đề phổ thông',
  },
  programming: {
    label: 'Thi lập trình',
    desc: 'Bài code chạy testcase, chấm tự động, Op-Log & phát hiện dán code. Dùng bộ bài lập trình.',
    icon: Code,
    chip: 'bg-primary/25',
    tone: 'brand',
    setLabel: 'bộ bài lập trình',
  },
};

export type MonLevel = 'none' | 'standard' | 'strict' | 'custom';
type MonKey = 'prevent_tab_switch' | 'ai_face_check' | 'prevent_paste' | 'track_keystroke' | 'require_mic';
const MON_KEYS: Record<ExamKind, MonKey[]> = {
  general: ['prevent_tab_switch', 'ai_face_check', 'prevent_paste', 'require_mic'],
  programming: ['prevent_tab_switch', 'ai_face_check', 'prevent_paste', 'track_keystroke'],
};
const PRESET: Record<Exclude<MonLevel, 'custom'>, MonKey[]> = {
  none: ['prevent_tab_switch'],
  standard: ['prevent_tab_switch', 'ai_face_check', 'prevent_paste', 'track_keystroke'],
  strict: ['prevent_tab_switch', 'ai_face_check', 'prevent_paste', 'track_keystroke', 'require_mic'],
};

function detectLevel(kind: ExamKind, f: Record<MonKey, boolean>): MonLevel {
  const keys = MON_KEYS[kind];
  const on = keys.filter((k) => f[k]);
  for (const lvl of ['none', 'standard', 'strict'] as const) {
    const want = keys.filter((k) => PRESET[lvl].includes(k));
    if (want.length === on.length && want.every((k) => on.includes(k))) return lvl;
  }
  return 'custom';
}

export function useExamForm(kind: ExamKind, { courses, questionSets, defaultCourseId, exam, user }: ExamFormPageProps) {
  const cfg = exam?.monitoring_config ?? {};
  const pick = <T,>(k: string, d: T): T => (cfg[k] ?? d) as T;
  const [form, setForm] = useState(() => ({
    course_id: exam?.course_id ?? defaultCourseId ?? courses[0]?.id ?? 0,
    question_set_id: exam?.question_set_id ?? 0,
    title: exam?.title ?? '',
    duration_minutes: exam?.duration_minutes ?? 90,
    start_time: exam?.start_time ?? (null as string | null),
    end_time: exam?.end_time ?? (null as string | null),
    max_attempts: exam ? exam.max_attempts : (1 as number | null),
    status: exam?.status ?? 'PUBLISHED',
    prevent_tab_switch: pick('prevent_tab_switch', true),
    ai_face_check: pick('ai_face_check', true),
    prevent_paste: pick('prevent_paste', true),
    max_paste_chars: pick('max_paste_chars', 80),
    track_keystroke: pick('track_keystroke_dynamics', true),
    is_shuffle_questions: pick('is_shuffle_questions', true),
    is_shuffle_answers: pick('is_shuffle_answers', true),
    is_hide_score: pick('is_hide_score', false),
    is_allow_review: pick('is_allow_review', true),
    number_questions_per_page: pick('number_questions_per_page', 1),
    require_mic: pick('require_mic', false),
    require_screen: pick('require_screen', false),
    extra_camera: pick<'off' | 'optional' | 'required'>('extra_camera', 'off'),
    allowed_apps_enabled: pick('allowed_apps_enabled', false),
    allowed_apps: pick<string[]>('allowed_apps', ['devenv', 'code']),
    excluded_student_ids: (exam?.excluded_student_ids ?? []) as number[],
    proctor_ids: (exam?.proctor_ids ?? (user?.id ? [user.id] : [])) as number[],
  }));
  const [step, setStep] = useState(0);
  const [mon, setMon] = useState<MonLevel>(() => (exam ? detectLevel(kind, form) : 'standard'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [dirty, setDirty] = useState(false);

  type Form = typeof form;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const sets = useMemo(() => {
    const forCourse = questionSets.filter((q) => !q.course_id || q.course_id === Number(form.course_id));
    return forCourse.length ? forCourse : questionSets;
  }, [questionSets, form.course_id]);
  const chosen = questionSets.find((q) => q.id === form.question_set_id) ?? null;
  const course = courses.find((c) => c.id === Number(form.course_id));

  const applyLevel = (lvl: MonLevel) => {
    setMon(lvl);
    if (lvl === 'custom') return;
    setForm((f) => ({ ...f, ...Object.fromEntries(MON_KEYS[kind].map((k) => [k, PRESET[lvl].includes(k)])) }));
    setDirty(true);
  };
  const flipMon = (k: MonKey, v: boolean) => {
    setMon('custom');
    set(k, v);
  };

  const done = [form.title.trim() && form.course_id ? 0 : -1, form.question_set_id ? 1 : -1].filter((i) => i >= 0);

  const submit = (status?: string) => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Nhập tên kỳ thi.';
    if (!form.question_set_id) errs.question_set_id = `Chọn một ${KIND_META[kind].setLabel}.`;
    if (Object.keys(errs).length) {
      setErrors(errs);
      setStep(errs.title ? 0 : 1);
      return;
    }
    setProcessing(true);
    const data = { ...form, status: status ?? form.status };
    const url = exam ? `/admin/exams/${exam.id}/update` : '/admin/exams';
    router.post(url, data, {
      onError: (e) => {
        setErrors(e);
        if (e.title || e.course_id || e.duration_minutes || e.start_time || e.end_time || e.status) setStep(0);
        else if (e.question_set_id) setStep(1);
      },
      onSuccess: () => setDirty(false),
      onFinish: () => setProcessing(false),
    });
  };

  return { kind, form, set, step, setStep, mon, applyLevel, flipMon, errors, processing, dirty, submit, sets, chosen, course, done, isEdit: !!exam };
}

export type ExamFormState = ReturnType<typeof useExamForm>;

/** Page frame: header, type banner, step tabs, footer and delete dialog. */
export function ExamFormShell({
  page,
  state,
  steps,
  children,
}: {
  page: ExamFormPageProps;
  state: ExamFormState;
  steps: string[];
  children: React.ReactNode;
}) {
  const { user, teams, quota, exam } = page;
  const { kind } = state;
  const meta = KIND_META[kind];
  const dialog = useDialog();
  const remaining = quota ? Math.max(0, quota.exams_limit - quota.exams_used) : null;
  const st = EXAM_STATUS[exam?.status ?? 'DRAFT'] ?? EXAM_STATUS.DRAFT;
  const other: ExamKind = kind === 'general' ? 'programming' : 'general';

  const removeExam = async () => {
    if (!exam) return;
    const ok = await dialog.confirm({
      title: `Xóa kỳ thi “${exam.title}”?`,
      text: 'Kỳ thi bị gỡ khỏi lịch. Bài làm, bài nộp, Op-Log và vi phạm của thí sinh cũng bị xóa.',
      warn: exam.attempts_count ? `Đã có ${exam.attempts_count} lượt làm bài sẽ bị xóa theo.` : undefined,
      tone: 'danger',
      confirmLabel: 'Xóa kỳ thi',
      requireText: exam.attempts_count ? exam.code : undefined,
    });
    if (ok) router.post(`/admin/exams/${exam.id}/delete`);
  };

  const primary = exam ? (
    <FxButton variant="primary" icon={Save} disabled={state.processing} onClick={() => state.submit()}>
      Lưu thay đổi
    </FxButton>
  ) : (
    <FxButton variant="primary" icon={CalendarCheck} disabled={state.processing} onClick={() => state.submit('PUBLISHED')}>
      Lên lịch kỳ thi
    </FxButton>
  );

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="exams"
      title={exam ? 'Sửa kỳ thi' : 'Tạo kỳ thi'}
      breadcrumbs={
        exam
          ? [{ label: 'Kỳ thi', href: '/admin/exams' }, { label: exam.title, href: `/admin/exams/${exam.id}` }, { label: 'Sửa' }]
          : [{ label: 'Kỳ thi', href: '/admin/exams' }, { label: 'Tạo kỳ thi', href: '/admin/exams/new' }, { label: meta.label }]
      }
    >
      <PageHeader
        onBack={() => router.visit(exam ? `/admin/exams/${exam.id}` : '/admin/exams/new')}
        title={exam ? exam.title : `Tạo kỳ thi ${kind === 'general' ? 'phổ thông' : 'lập trình'}`}
        badges={
          <>
            <Pill tone={meta.tone}>{meta.label}</Pill>
            {exam ? <Pill tone={st.tone}>{st.label}</Pill> : <Pill>Bản nháp</Pill>}
            {state.dirty && exam && <Pill tone="warning">Chưa lưu</Pill>}
          </>
        }
        desc={
          exam ? (
            <>
              Phòng <span className="font-mono text-foreground">{exam.code}</span> · {exam.attempts_count} lượt làm bài
            </>
          ) : quota ? (
            <>
              {quota.plan_name} · còn <span className="text-foreground">{remaining?.toLocaleString('en')}</span> / {quota.exams_limit.toLocaleString('en')} kỳ thi trong
              tháng · tối đa {quota.students_limit.toLocaleString('en')} thí sinh / kỳ
            </>
          ) : undefined
        }
        actions={
          <>
            {exam ? (
              <FxButton icon={Trash2} className="text-danger-fg" onClick={removeExam}>
                Xóa
              </FxButton>
            ) : (
              <FxButton icon={Save} disabled={state.processing} onClick={() => state.submit('DRAFT')}>
                Lưu nháp
              </FxButton>
            )}
            {primary}
          </>
        }
      />
      {state.errors.message && <div className="rounded-lg bg-danger/12 px-3 py-2.5 text-[13px] text-danger-fg">{state.errors.message}</div>}

      <div className={cn('flex items-center gap-3.5 rounded-xl border border-primary/50 bg-primary/6 p-4')}>
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-[10px]', meta.chip)}>
          <meta.icon className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-[15px] font-semibold">{meta.label}</span>
          <span className="text-xs leading-[1.45] text-muted-foreground">{meta.desc}</span>
        </div>
        {!exam && (
          <button type="button" className="cursor-pointer text-[13px] text-brand-fg hover:underline" onClick={() => router.visit(`/admin/exams/new/${other}`)}>
            Chuyển sang {KIND_META[other].label.toLowerCase()}
          </button>
        )}
      </div>

      <StepTabs labels={steps} current={state.step} done={state.done} onChange={state.setStep} />
      {children}
      <StepFooter labels={steps} current={state.step} onChange={state.setStep} lastAction={primary} />

    </AdminLayout>
  );
}

/** Bước 1 — Thông tin. */
export function ExamInfoStep({ page, state }: { page: ExamFormPageProps; state: ExamFormState }) {
  const { form, set, errors } = state;
  return (
    <Panel className="flex max-w-[880px] flex-col gap-3.5">
      <Field label="Tên kỳ thi" error={errors.title}>
        <FxInput
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={state.kind === 'programming' ? 'VD: Giữa kỳ CTDL & GT — Ca 2' : 'VD: Kiểm tra Tiếng Anh B1 — Giữa kỳ'}
        />
      </Field>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Field label="Khóa học" error={errors.course_id}>
          <Combobox
            items={page.courses.map((c) => ({ value: c.id, hint: c.code, label: c.name, right: <span className="text-xs text-muted-foreground">{c.students_count ?? 0} SV</span> }))}
            value={form.course_id}
            onChange={(i) => {
              set('course_id', Number(i.value));
              set('excluded_student_ids', []);
            }}
            placeholder="Chọn khóa học"
          />
        </Field>
        <Field label="Thời lượng" error={errors.duration_minutes} hint="Từ 15 đến 300 phút">
          <FxInput type="number" min={15} max={300} suffix="phút" value={form.duration_minutes} onChange={(e) => set('duration_minutes', Number(e.target.value))} />
        </Field>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Field label="Mở phòng" error={errors.start_time} hint="Để trống = mở ngay khi lên lịch">
          <DateTimeInput value={form.start_time} onChange={(v) => set('start_time', v)} />
        </Field>
        <Field label="Đóng phòng" error={errors.end_time} hint="Để trống = không giới hạn">
          <DateTimeInput value={form.end_time} onChange={(v) => set('end_time', v)} />
        </Field>
      </div>
      {page.exam && (
        <Field label="Trạng thái" error={errors.status}>
          <Segmented
            className="max-w-[560px]"
            stretch
            value={form.status}
            onChange={(v) => set('status', v)}
            options={Object.entries(EXAM_STATUS).map(([value, s]) => ({ value, label: s.label }))}
          />
        </Field>
      )}
      <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface p-3">
        <KeyRound className="size-4" />
        <span className="flex-1 text-[13px]">{page.exam ? 'Mã phòng thi' : 'Mã phòng thi tự sinh khi lên lịch'}</span>
        <span className="font-mono text-sm font-semibold tracking-[0.05em]">{page.exam?.code ?? 'FOXY-······'}</span>
      </div>
    </Panel>
  );
}

/** Bước 2 — Chọn bộ đề / bộ bài. */
export function ExamSetStep({ page, state }: { page: ExamFormPageProps; state: ExamFormState }) {
  const { kind, form, set, sets, chosen, errors } = state;
  const isCode = kind === 'programming';
  const changedSet = page.exam && page.exam.question_set_id !== form.question_set_id && page.exam.attempts_count > 0;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Panel padded={false} className="min-w-0 flex-[2_1_460px] overflow-hidden">
        <PanelBar>
          <PanelTitle
            className="flex-1"
            title={isCode ? 'Bộ bài toán sử dụng' : 'Bộ đề sử dụng'}
            desc={isCode ? 'Thứ tự hiển thị P1, P2… trong FoxyClient' : 'Thí sinh nhận đề từ bộ đề được chọn'}
          />
          <FxButton size="sm" onClick={() => router.visit(`/admin/question-sets/new/${isCode ? 'programming' : 'classical'}`)}>
            Tạo {KIND_META[kind].setLabel}
          </FxButton>
        </PanelBar>
        {sets.length === 0 ? (
          <EmptyState
            icon={isCode ? Code : ListChecks}
            title={`Chưa có ${KIND_META[kind].setLabel}`}
            desc="Tạo bộ đề trong Ngân hàng đề rồi quay lại bước này."
          />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <Combobox
              items={sets.map((q) => ({
                value: q.id,
                hint: q.code,
                label: q.name,
                right: <span className="text-xs text-muted-foreground">{q.status === 'DRAFT' ? 'Nháp · ' : ''}{q.questions_count ?? 0} {isCode ? 'bài' : 'câu'}</span>,
              }))}
              value={form.question_set_id || null}
              onChange={(i) => set('question_set_id', Number(i.value))}
              placeholder={`Chọn ${KIND_META[kind].setLabel}…`}
              invalid={!!errors.question_set_id}
            />
            {chosen && (
              <div className="flex items-center gap-3 rounded-[10px] bg-surface p-3 text-[13px]">
                <span className="font-mono text-xs text-muted-foreground">{chosen.code}</span>
                <span className="flex-1 font-medium">{chosen.name}</span>
                {chosen.status === 'DRAFT' && <Pill size="sm">Nháp</Pill>}
                <span className="text-muted-foreground">
                  {chosen.questions_count ?? 0} {isCode ? 'bài' : 'câu'}
                  {!isCode && chosen.max_score ? ` · ${chosen.max_score} điểm` : ''}
                </span>
              </div>
            )}
          </div>
        )}
        {errors.question_set_id && <div className="px-4 py-2.5 text-xs text-danger-fg">{errors.question_set_id}</div>}
        {changedSet && (
          <div className="flex items-center gap-2 border-t border-border bg-warning/10 px-4 py-2.5 text-xs text-warning-fg">
            <TriangleAlert className="size-3.5" />
            Kỳ thi đã có lượt làm bài — đổi bộ đề chỉ áp dụng cho lượt mới.
          </div>
        )}
      </Panel>

      <Panel padded={false} className="flex min-w-0 flex-[1_1_280px] flex-col">
        <div className="p-4">
          <PanelTitle title={isCode ? 'Bài toán trong đề' : 'Bộ đề đã chọn'} desc={chosen ? `${chosen.code} · ${chosen.name}` : 'Chưa chọn'} />
        </div>
        {isCode ? (
          chosen?.problems?.length ? (
            chosen.problems.map((p, i) => {
              const d = DIFFICULTY[p.difficulty] ?? DIFFICULTY.MEDIUM;
              return (
                <div key={p.id} className="flex items-center gap-3 border-t border-border px-4 py-3">
                  <span className="w-7 font-bold">P{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {p.time_limit_ms / 1000}s · {p.memory_limit_mb}MB
                    </div>
                  </div>
                  <Pill tone={d.tone}>{d.short}</Pill>
                </div>
              );
            })
          ) : (
            <div className="border-t border-border px-4 py-4 text-[13px] text-muted-foreground">
              {chosen ? 'Bộ bài chưa có bài toán nào.' : 'Chọn một bộ bài để xem danh sách.'}
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-px overflow-hidden border-t border-border bg-border">
            {[
              ['Số câu', chosen?.questions_count ?? '—'],
              ['Điểm tối đa', chosen?.max_score ?? '—'],
              ['Môn học', chosen?.course_name ?? 'Dùng chung'],
              ['Câu mỗi trang', form.number_questions_per_page],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground">{k}</div>
                <div className="mt-0.5 truncate font-semibold">{v}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Bước Giám sát — the toggles differ per kind. */
export function ExamMonitorStep({ page, state }: { page: ExamFormPageProps; state: ExamFormState }) {
  const { kind, form, mon, applyLevel, flipMon } = state;
  const isCode = kind === 'programming';
  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3.5">
        <PanelTitle title="Mức giám sát" desc="Chọn mẫu, hoặc bật/tắt từng mục bên dưới để chuyển sang Tùy chỉnh" />
        <RadioCards<MonLevel>
          value={mon}
          onChange={applyLevel}
          options={[
            { value: 'none', label: 'Cơ bản', desc: 'Chỉ theo dõi chuyển tab / cửa sổ.' },
            { value: 'standard', label: 'Tiêu chuẩn', desc: isCode ? 'Chuyển tab, khuôn mặt, chặn dán, Op-Log.' : 'Chuyển tab, xác thực khuôn mặt.' },
            { value: 'strict', label: 'Nghiêm ngặt', desc: 'Bật tất cả tùy chọn giám sát.' },
            { value: 'custom', label: 'Tùy chỉnh', desc: 'Tự chọn các tùy chọn giám sát theo nhu cầu.' },
          ]}
        />
      </Panel>
      <div className="flex flex-wrap items-start gap-4">
        <Panel className="flex-[2_1_420px] px-5 py-1">
          <ToggleList
            items={[
              { key: 'tab', label: 'Theo dõi chuyển tab / cửa sổ', desc: 'TAB_SWITCH · WINDOW_LOST_FOCUS', checked: form.prevent_tab_switch, onChange: (v) => flipMon('prevent_tab_switch', v) },
              {
                key: 'face',
                label: 'Xác thực khuôn mặt (AI)',
                desc: page.quota && !page.quota.has_ai ? 'Gói hiện tại chưa bao gồm giám sát AI' : 'NO_FACE_DETECTED · FACE_MISMATCH · MULTIPLE_PEOPLE',
                checked: form.ai_face_check,
                onChange: (v) => flipMon('ai_face_check', v),
              },
              { key: 'paste', label: 'Chặn sao chép / dán', desc: 'Chặn copy, cut, paste, kéo thả văn bản — kể cả 1 ký tự · BULK_PASTE', checked: form.prevent_paste, onChange: (v: boolean) => flipMon('prevent_paste', v) },
              ...(isCode
                ? [
                    { key: 'ks', label: 'Ghi Op-Log từng phím', desc: 'Phát lại quá trình gõ', checked: form.track_keystroke, onChange: (v: boolean) => flipMon('track_keystroke', v) },
                  ]
                : [{ key: 'mic', label: 'Bật micro', desc: 'Phát hiện tiếng nói · bắt buộc cho phần Nói', checked: form.require_mic, onChange: (v: boolean) => flipMon('require_mic', v) }]),
              { key: 'screen', label: 'Bắt buộc chia sẻ màn hình', desc: 'Dừng chia sẻ giữa giờ thi thì bài bị che cho tới khi bật lại', checked: form.require_screen, onChange: (v: boolean) => state.set('require_screen', v) },
            ]}
          />
          <div className="flex flex-col gap-2 border-t border-border py-3.5">
            <div>
              <div className="text-[13px] font-medium">Camera mở rộng (điện thoại)</div>
              <div className="text-xs text-muted-foreground">Thí sinh quét QR để dùng điện thoại làm camera thứ hai nhìn từ góc bàn; ảnh minh chứng có thêm ảnh từ điện thoại.</div>
            </div>
            <Segmented
              className="max-w-[420px]"
              stretch
              value={form.extra_camera}
              onChange={(v) => state.set('extra_camera', v)}
              options={[
                { value: 'off', label: 'Không dùng' },
                { value: 'optional', label: 'Tùy chọn' },
                { value: 'required', label: 'Bắt buộc' },
              ]}
            />
          </div>
        </Panel>
        <Panel className="flex flex-[1_1_280px] flex-col gap-3">
          <PanelTitle title="FoxyClient" desc="Thí sinh làm bài qua ứng dụng desktop" />
          <div className="flex items-start gap-2.5 rounded-[10px] bg-surface p-3 text-[13px]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span className="text-muted-foreground">Client Guard chặn DevTools, phím tắt hệ thống và ghi nhận vi phạm theo mức giám sát đã chọn.</span>
          </div>
        </Panel>
      </div>
      {isCode && <AllowedAppsPanel state={state} />}
    </div>
  );
}

/** Phần mềm được phép dùng khi thi lập trình: mở chúng không bị tính là rời cửa sổ và bài không cần luôn-trên-cùng. */
function AllowedAppsPanel({ state }: { state: ExamFormState }) {
  const { form, set } = state;
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().replace(/\.exe$/i, '').toLowerCase();
    if (v && !form.allowed_apps.includes(v)) set('allowed_apps', [...form.allowed_apps, v]);
    setDraft('');
  };
  return (
    <Panel className="flex flex-col gap-3">
      <PanelTitle title="Phần mềm được phép" desc="Thí sinh có thể mở các phần mềm này khi thi (tên tiến trình, không cần .exe). Phần mềm khác vẫn bị ghi nhận." />
      <div className="flex items-center gap-3 rounded-[10px] bg-surface p-3">
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="font-medium">Cho phép phần mềm</div>
          <div className="text-xs text-muted-foreground">Bật thì cửa sổ thi không ép luôn-trên-cùng khi đang dùng phần mềm trong danh sách.</div>
        </div>
        <Switch checked={form.allowed_apps_enabled} onChange={(v) => set('allowed_apps_enabled', v)} label="Cho phép phần mềm" />
      </div>
      {form.allowed_apps_enabled && (
        <>
          <div className="flex flex-wrap gap-2">
            {form.allowed_apps.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-xs">
                {a}
                <button type="button" className="cursor-pointer text-muted-foreground hover:text-danger-fg" onClick={() => set('allowed_apps', form.allowed_apps.filter((x) => x !== a))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <FxInput value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="vd: devenv, code, clion64, pycharm64" />
            <FxButton onClick={add}>Thêm</FxButton>
          </div>
          <div className="text-xs text-muted-foreground">
            Mặc định: <span className="font-mono">devenv</span> (Visual Studio) và <span className="font-mono">code</span> (VS Code).
          </div>
        </>
      )}
    </Panel>
  );
}

/**Bước Thí sinh & giám thị. */
export function ExamCandidatesStep({ page, state }: { page: ExamFormPageProps; state: ExamFormState }) {
  const { course } = state;
  const q = page.quota;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Panel className="flex flex-[1_1_380px] flex-col gap-3">
        <PanelTitle title="Thí sinh" desc="Mặc định tất cả sinh viên ghi danh được thi. Bỏ chọn để cấm thi từng người." />
        <div className="flex items-center gap-3 rounded-[10px] bg-surface p-3">
          <GraduationCap className="size-4" />
          <span className="flex-1">{course ? `${course.code} — ${course.name}` : 'Chưa chọn khóa học'}</span>
          <span className="font-semibold">{course?.students_count ?? 0} SV</span>
        </div>
        {course && <StudentPicker courseId={course.id} excluded={state.form.excluded_student_ids} onChange={(ids) => state.set('excluded_student_ids', ids)} />}
        {q && (course?.students_count ?? 0) > q.students_limit && (
          <div className="text-xs text-danger-fg">
            Vượt giới hạn {q.students_limit} thí sinh / kỳ của gói {q.plan_name}.
          </div>
        )}
      </Panel>
      <ProctorPanel page={page} state={state} />
    </div>
  );
}

/** Giám thị: người phụ trách + thêm giảng viên / quản trị cùng tổ chức. */
function ProctorPanel({ page, state }: { page: ExamFormPageProps; state: ExamFormState }) {
  const [q, setQ] = useState('');
  const options = page.proctorOptions ?? [];
  const ids = state.form.proctor_ids;
  const me = page.user?.id;
  const selected = options.filter((o) => ids.includes(o.id));
  const rest = options.filter((o) => !ids.includes(o.id) && `${o.name} ${o.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: number) => state.set('proctor_ids', ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const Row = ({ o, on }: { o: ProctorOption; on: boolean }) => (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(o.name)}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{o.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {o.id === me ? 'Bạn · phụ trách' : o.role === 'TEACHER' ? 'Giảng viên' : 'Quản trị'} · {o.email}
        </div>
      </div>
      {o.id === me && on ? (
        <Users className="size-4 opacity-50" />
      ) : (
        <FxButton size="sm" icon={on ? X : Plus} onClick={() => toggle(o.id)}>
          {on ? 'Bỏ' : 'Thêm'}
        </FxButton>
      )}
    </div>
  );

  return (
    <Panel className="flex flex-[1_1_340px] flex-col gap-3">
      <PanelTitle title="Giám thị" desc="Nhận cảnh báo realtime & quyền đình chỉ. Chọn giảng viên cùng tổ chức." />
      <div className="flex flex-col gap-2.5">
        {selected.length === 0 && <div className="text-xs text-muted-foreground">Chưa có giám thị — người tạo sẽ tự được phân công.</div>}
        {selected.map((o) => (
          <Row key={o.id} o={o} on />
        ))}
      </div>
      <div className="border-t border-border pt-3">
        <FxInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm giảng viên cùng trường để thêm…" />
        <div className="mt-2 flex max-h-56 flex-col gap-2.5 overflow-y-auto">
          {rest.length === 0 ? <div className="py-2 text-xs text-muted-foreground">Không còn giảng viên phù hợp.</div> : rest.map((o) => <Row key={o.id} o={o} on={false} />)}
        </div>
      </div>
    </Panel>
  );
}

/** Small field group for "Làm bài" panels. */
export function AttemptsField({ state }: { state: ExamFormState }) {
  return (
    <Field label="Số lượt thi" error={state.errors.max_attempts} hint="Để trống = không giới hạn">
      <FxInput
        type="number"
        min={1}
        max={100}
        suffix="lượt"
        value={state.form.max_attempts ?? ''}
        onChange={(e) => state.set('max_attempts', e.target.value ? Number(e.target.value) : null)}
      />
    </Field>
  );
}
