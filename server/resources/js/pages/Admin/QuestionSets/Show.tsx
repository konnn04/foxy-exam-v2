import { useUnsavedGuard } from '@/components/foxy/save-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Code, Copy, Download, Ellipsis, ListChecks, Pencil, Plus, Send, Sparkles, Trash2, Info, Pencil as Edit, Undo2, Save, Loader2 } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import type { BankItem } from '@/components/admin/question-sets/import-questions-modal';
import { ImportQuestionsModal } from '@/components/admin/question-sets';
import type { ClassicalQuestionItem, CourseOption, Difficulty, ProgrammingProblemItem, QuestionSetDetail, QuestionSetOtherSet } from '@/types/questions';
import { EmptyState, Field, FormSection, FxButton, FxInput, FxSelect, FxTextarea, IconButton, Modal, PageHeader, Panel, PanelBar, PanelTitle, Pill, RadioCards, Segmented, StepTabs } from '@/components/foxy/ui';
import { AiGenerateModal } from '@/components/foxy/ai-generate-modal';
import { SaveBar, useDirty } from '@/components/foxy/save-bar';
import { DIFFICULTY } from '@/components/foxy/domain';
import { useDialog } from '@/components/foxy/dialogs';
import { DIFFICULTY_ORDER, KINDS, draftOf, kindOf, newDraft, payloadOf, validateDraft, type Draft, type Kind } from '@/components/foxy/question-draft';
import { QuestionBody, QuestionProps } from '@/components/foxy/question-editor';
import { PaperPreview } from '@/components/foxy/question-paper';
import { cn } from '@/lib/utils';

interface Props {
  user: any;
  teams: TeamItem[];
  questionSet: QuestionSetDetail;
  courses: CourseOption[];
  classicalQuestions: ClassicalQuestionItem[];
  programmingProblems: ProgrammingProblemItem[];
  otherSets?: QuestionSetOtherSet[];
  availableBankItems?: BankItem[];
}

interface Row {
  q: ClassicalQuestionItem;
  label: string;
  child: boolean;
  group: boolean;
}

export default function ShowQuestionSet({ user, teams, questionSet, courses, classicalQuestions = [], programmingProblems = [], availableBankItems = [] }: Props) {
  const dialog = useDialog();
  const isClassical = questionSet.type === 'CLASSICAL';

  // Flatten: groups lettered A, B…; questions numbered 1, 2… in reading order.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let g = 0;
    let n = 0;
    classicalQuestions.forEach((q) => {
      const group = q.type === 'GROUP_QUESTION';
      out.push({ q, group, child: false, label: group ? String.fromCharCode(65 + g++) : String(++n) });
      (q.children ?? []).forEach((c) => out.push({ q: c, group: false, child: true, label: String(++n) }));
    });
    return out;
  }, [classicalQuestions]);
  const questionCount = rows.filter((r) => !r.group).length;
  const totalPoints = rows.reduce((s, r) => s + Number(r.q.points || 0), 0);

  const labels = isClassical ? ['Thông tin', `Câu hỏi (${questionCount})`, 'Ma trận đề', 'Xem trước'] : ['Thông tin', `Bài toán (${programmingProblems.length})`];
  const topics = useMemo(() => [...new Set(rows.map((r) => r.q.skill).filter((x): x is string => !!x))].sort(), [rows]);
  const [tab, setTab] = useState(1);

  const [selId, setSelId] = useState<number | null>(() => rows.find((r) => !r.group)?.q.id ?? rows[0]?.q.id ?? null);
  const selRow = rows.find((r) => r.q.id === selId) ?? null;
  const [draft, setDraft] = useState<Draft | null>(selRow ? draftOf(selRow.q) : null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [addKind, setAddKind] = useState<Kind>('CHOICE');
  const [addPos, setAddPos] = useState<'end' | 'group'>('end');

  // after a server round-trip the list is fresh: re-sync the editor with the saved row
  useEffect(() => {
    if (dirty || !selId) return;
    const r = rows.find((x) => x.q.id === selId);
    if (r) setDraft(draftOf(r.q));
  }, [classicalQuestions]); // eslint-disable-line react-hooks/exhaustive-deps

  // leaving the page with unsaved changes (reload, close tab, any navigation)
  useUnsavedGuard(dirty);

  const discardOk = async () =>
    !dirty ||
    (await dialog.confirm({ title: 'Bỏ thay đổi chưa lưu?', text: 'Câu hiện tại có thay đổi chưa lưu. Chuyển sang câu khác sẽ mất chúng.', confirmLabel: 'Bỏ thay đổi', tone: 'warning' }));

  const select = async (id: number) => {
    if (!(await discardOk())) return;
    const r = rows.find((x) => x.q.id === id);
    if (!r) return;
    setSelId(id);
    setDraft(draftOf(r.q));
    setDirty(false);
    setErrors({});
    setMenu(null);
    setTab(1);
  };
  const edit = (p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
    setErrors({});
  };

  const groupForAdd = selRow ? (selRow.group ? selRow.q.id : selRow.child ? selRow.q.parent_id ?? null : null) : null;
  const groupLabel = groupForAdd ? rows.find((r) => r.q.id === groupForAdd)?.label : null;

  const confirmAdd = async () => {
    if (!(await discardOk())) return;
    const intoGroup = addPos === 'group' && groupForAdd && addKind !== 'GROUP_QUESTION';
    setDraft(newDraft(addKind, intoGroup ? groupForAdd : null));
    setSelId(null);
    setDirty(true);
    setAddOpen(false);
    setErrors({});
    setTab(1);
  };

  const save = () => {
    if (!draft) return;
    const errs = validateDraft(draft);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    const isNew = draft.id === null;
    const parent = draft.parent_id;
    router.post(`/admin/question-sets/${questionSet.id}/classical-questions`, payloadOf(draft), {
      preserveScroll: true,
      onError: (e) => setErrors(e),
      onSuccess: (page) => {
        setDirty(false);
        setErrors({});
        dialog.toast.success(isNew ? `Đã thêm ${KINDS[draft.kind].label.toLowerCase()}` : 'Đã lưu câu hỏi');
        if (isNew) {
          const fresh = (page.props as any).classicalQuestions as ClassicalQuestionItem[];
          const pool = parent ? fresh.find((q) => q.id === parent)?.children ?? [] : fresh;
          const created = pool[pool.length - 1];
          if (created) {
            setSelId(created.id);
            setDraft(draftOf(created));
          }
        }
      },
      onFinish: () => setSaving(false),
    });
  };

  const duplicate = (q: ClassicalQuestionItem) => {
    setMenu(null);
    const d = draftOf(q);
    router.post(
      `/admin/question-sets/${questionSet.id}/classical-questions`,
      {
        ...payloadOf({ ...d, id: null, parent_id: null, content: `${d.content} (bản sao)` }),
        children: (q.children ?? []).map((c) => ({ ...payloadOf(draftOf(c)), id: null, parent_id: null })),
      },
      { preserveScroll: true, onSuccess: () => dialog.toast.success('Đã nhân bản') },
    );
  };

  const remove = async (r: Row) => {
    setMenu(null);
    const title = `${r.group ? 'Nhóm' : 'Câu'} ${r.label}`;
    const snip = r.q.content.length > 90 ? `${r.q.content.slice(0, 90)}…` : r.q.content;
    const kids = r.q.children?.length ?? 0;
    const ok = await dialog.confirm({
      title: `Xóa ${title}?`,
      text: `“${snip}” — câu hỏi và đáp án bị xóa khỏi bộ đề.`,
      warn: kids ? `Nhóm này có ${kids} câu con — sẽ bị xóa cùng.` : undefined,
      tone: 'danger',
    });
    if (!ok) return;
    const idx = rows.findIndex((x) => x.q.id === r.q.id);
    router.post(`/admin/classical-questions/${r.q.id}/delete`, {}, {
      preserveScroll: true,
      onSuccess: () => {
        dialog.toast.success(`Đã xóa ${title}`);
        const next = rows.filter((x) => x.q.id !== r.q.id && x.q.parent_id !== r.q.id)[Math.max(0, idx - 1)];
        setSelId(next?.q.id ?? null);
        setDraft(next ? draftOf(next.q) : null);
        setDirty(false);
      },
    });
  };

  // ---- Thông tin bộ đề + quy tắc bốc câu ----
  const [info, setInfo] = useState({
    name: questionSet.name,
    code: questionSet.code,
    course_id: questionSet.course_id ?? ('' as number | ''),
    description: questionSet.description ?? '',
    max_score: questionSet.max_score,
    status: questionSet.status || 'DRAFT',
    limit_questions: questionSet.limit_questions ?? 0,
  });
  const [ratio, setRatio] = useState<Record<Difficulty, number>>({ EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0, ...(questionSet.ratio_per_difficulty ?? {}) });
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
  const [infoSaving, setInfoSaving] = useState(false);
  const infoState = useDirty(info);
  const ratioSum = DIFFICULTY_ORDER.reduce((s, d) => s + (ratio[d] || 0), 0);

  const saveInfo = (override?: Partial<typeof info>) => {
    const data = { ...info, ...override, course_id: (override?.course_id ?? info.course_id) || null, ratio_per_difficulty: ratioSum > 0 ? ratio : null };
    setInfoSaving(true);
    router.post(`/admin/question-sets/${questionSet.id}/update`, data, {
      preserveScroll: true,
      onError: setInfoErrors,
      onFinish: () => setInfoSaving(false),
      onSuccess: () => {
        setInfoErrors({});
        if (override) setInfo((i) => ({ ...i, ...override }));
        else infoState.markSaved();
        dialog.toast.success(override?.status === 'PUBLISHED' ? 'Đã xuất bản bộ đề' : 'Đã lưu bộ đề');
      },
    });
  };

  const statusPill =
    questionSet.status === 'PUBLISHED' ? <Pill tone="success">Đã xuất bản</Pill> : questionSet.status === 'ARCHIVED' ? <Pill tone="outline">Lưu trữ</Pill> : <Pill>Bản nháp</Pill>;

  const removeProblem = async (p: ProgrammingProblemItem) => {
    const ok = await dialog.confirm({ title: `Xóa bài “${p.title}”?`, text: 'Bài toán và toàn bộ testcase bị xóa khỏi bộ đề.', tone: 'danger', confirmLabel: 'Xóa bài' });
    if (ok) router.post(`/admin/programming-problems/${p.id}/delete`, {}, { preserveScroll: true, onSuccess: () => dialog.toast.success('Đã xóa bài toán') });
  };

  const childRows = (selRow?.q.children ?? []).map((c) => ({
    id: c.id,
    label: rows.find((x) => x.q.id === c.id)?.label ?? '',
    snippet: c.content,
    kind: kindOf(c),
  }));

  return (
    <AdminLayout user={user} teams={teams} currentTab="problem-banks" title={questionSet.name} breadcrumbs={[{ label: 'Ngân hàng đề', href: '/admin/problem-banks' }, { label: questionSet.name }]}>
      <div className="flex flex-col gap-4" onClick={() => menu !== null && setMenu(null)}>
        <PageHeader
          onBack={async () => (await discardOk()) && router.visit('/admin/problem-banks')}
          title={questionSet.name}
          badges={
            <>
              <Pill tone={isClassical ? 'info' : 'brand'}>{isClassical ? 'Trắc nghiệm & tự luận' : 'Lập trình'}</Pill>
              {statusPill}
            </>
          }
          desc={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Mã <span className="font-mono text-foreground">{questionSet.code}</span>
              </span>
              <span>Môn {questionSet.course_name || 'dùng chung'}</span>
              {isClassical ? (
                <>
                  <span>
                    {questionCount} câu, tổng {Number(totalPoints.toFixed(2))}/{questionSet.max_score} điểm
                  </span>
                  {questionSet.limit_questions ? <span>Mỗi đề bốc {questionSet.limit_questions} câu</span> : null}
                </>
              ) : (
                <span>{programmingProblems.length} bài</span>
              )}
            </span>
          }
          actions={
            <>
              {isClassical && (
                <FxButton icon={Sparkles} onClick={() => setAiOpen(true)}>
                  Tạo bằng AI
                </FxButton>
              )}
              <FxButton icon={Download} onClick={() => setImportOpen(true)}>
                Lấy từ bộ đề khác
              </FxButton>
              {questionSet.status !== 'PUBLISHED' && (
                <FxButton variant="primary" icon={Send} onClick={() => saveInfo({ status: 'PUBLISHED' })}>
                  Xuất bản
                </FxButton>
              )}
            </>
          }
        />

        <StepTabs labels={labels} current={tab} done={[0]} onChange={setTab} />

        {tab === 0 && (
          <Panel className="p-5 sm:p-6">
            <FormSection title="Thông tin chung" desc="Tên và mã giúp giảng viên tìm đúng bộ đề khi tạo kỳ thi.">
              <Field label="Tên bộ đề" required error={infoErrors.name}>
                <FxInput value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} placeholder="Kiểm tra giữa kỳ – Cấu trúc dữ liệu" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mã bộ đề" required hint="Viết hoa, không dấu, không khoảng trắng." error={infoErrors.code}>
                  <FxInput mono value={info.code} onChange={(e) => setInfo({ ...info, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
                </Field>
                <Field label="Môn học" error={infoErrors.course_id}>
                  <FxSelect value={info.course_id} onChange={(e) => setInfo({ ...info, course_id: e.target.value ? Number(e.target.value) : '' })}>
                    <option value="">Dùng chung cho mọi môn</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </FxSelect>
                </Field>
              </div>
              <Field label="Mô tả" optional error={infoErrors.description}>
                <FxTextarea rows={3} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} placeholder="Phạm vi kiến thức, chương áp dụng, ghi chú cho người soạn…" />
              </Field>
            </FormSection>

            <FormSection title="Điểm và cách bốc câu" desc={isClassical ? 'Mỗi lượt thi có thể dùng toàn bộ câu hỏi hoặc bốc ngẫu nhiên một phần.' : 'Thang điểm của bộ đề lập trình.'}>
              <Field label="Điểm tối đa" hint={isClassical ? `Tổng điểm các câu hiện có: ${Number(totalPoints.toFixed(2))}.` : undefined} error={infoErrors.max_score} className="sm:max-w-[220px]">
                <FxInput type="number" min={0} step={0.5} value={info.max_score} suffix="điểm" onChange={(e) => setInfo({ ...info, max_score: Number(e.target.value) })} />
              </Field>
              {isClassical && (
                <>
                  <RadioCards
                    minWidth={220}
                    value={info.limit_questions > 0 ? 'some' : 'all'}
                    onChange={(v) => setInfo({ ...info, limit_questions: v === 'all' ? 0 : Math.min(questionCount || 10, info.limit_questions || Math.min(10, questionCount || 10)) })}
                    options={[
                      { value: 'all', label: 'Dùng tất cả câu hỏi', desc: `Mỗi thí sinh làm đủ ${questionCount} câu.` },
                      { value: 'some', label: 'Bốc ngẫu nhiên', desc: 'Mỗi thí sinh nhận một số câu khác nhau từ bộ đề.' },
                    ]}
                  />
                  {info.limit_questions > 0 && (
                    <Field label="Số câu mỗi đề" hint={`Bộ đề hiện có ${questionCount} câu. Tỉ lệ theo độ khó đặt ở tab Ma trận đề.`} error={infoErrors.limit_questions} className="sm:max-w-[220px]">
                      <FxInput type="number" min={1} max={questionCount || undefined} suffix="câu" value={info.limit_questions} onChange={(e) => setInfo({ ...info, limit_questions: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>
                  )}
                </>
              )}
            </FormSection>

            <FormSection title="Trạng thái" desc="Đánh dấu tiến độ soạn để cả nhóm biết bộ đề nào đã dùng được.">
              <RadioCards
                minWidth={180}
                value={info.status}
                onChange={(status) => setInfo({ ...info, status })}
                options={[
                  { value: 'DRAFT', label: 'Bản nháp', desc: 'Đang soạn, chưa hoàn thiện.' },
                  { value: 'PUBLISHED', label: 'Đã xuất bản', desc: 'Đã duyệt, sẵn sàng cho kỳ thi.' },
                  { value: 'ARCHIVED', label: 'Lưu trữ', desc: 'Không còn dùng, giữ lại để tra cứu.' },
                ]}
              />
              {infoErrors.status && <span className="text-xs text-danger-fg">{infoErrors.status}</span>}
            </FormSection>
          </Panel>
        )}

        {isClassical && tab === 1 && (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
            {/* Question list: a short scroller on phones, a sticky column on large screens */}
            <Panel padded={false} className="min-w-0 lg:sticky lg:top-20">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <span className="font-semibold">
                  Câu hỏi <span className="font-normal text-muted-foreground">({questionCount})</span>
                </span>
                <FxButton
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setAddPos('end');
                    setAddOpen(true);
                  }}
                >
                  Thêm câu
                </FxButton>
              </div>
              <div className="flex max-h-[38dvh] flex-col overflow-y-auto p-1.5 lg:max-h-[calc(100dvh-220px)]">
                {rows.length === 0 && !draft && (
                  <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-[13px] text-muted-foreground">
                    Chưa có câu hỏi.
                    <button type="button" className="cursor-pointer font-medium text-brand-fg hover:underline" onClick={() => setAiOpen(true)}>
                      Tạo nhanh từ tài liệu bằng AI
                    </button>
                  </div>
                )}
                {draft?.id === null && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-muted p-2 shadow-[inset_2px_0_0_var(--primary)]" style={{ paddingLeft: draft.parent_id ? 24 : 8 }}>
                    <span className="flex h-[22px] min-w-6 items-center justify-center rounded-md border border-dashed border-primary font-mono text-[11px] font-bold">+</span>
                    <div className="min-w-0 flex-1 text-[13px] text-brand-fg">{KINDS[draft.kind].label} mới, chưa lưu</div>
                  </div>
                )}
                {rows.map((r) => {
                  const on = r.q.id === selId;
                  const k = kindOf(r.q);
                  return (
                    <div key={r.q.id} className="relative">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-current={on || undefined}
                        onClick={() => select(r.q.id)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(r.q.id))}
                        className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40', on ? 'bg-muted shadow-[inset_2px_0_0_var(--primary)]' : 'hover:bg-surface')}
                        style={{ paddingLeft: r.child ? 24 : 8 }}
                      >
                        <span className={cn('flex h-[22px] min-w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold', r.group ? 'bg-violet/20 text-violet-fg' : 'border border-foreground/20 bg-surface')}>
                          {r.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[13px] leading-snug">{r.q.content || <span className="text-muted-foreground">(chưa có nội dung)</span>}</div>
                          <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                            <span>{KINDS[k].label}</span>
                            {!r.group && <span>{Number(r.q.points)} điểm</span>}
                            {r.q.skill && <span className="truncate">{r.q.skill}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Tác vụ cho ${r.group ? 'nhóm' : 'câu'} ${r.label}`}
                          aria-expanded={menu === r.q.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenu(menu === r.q.id ? null : r.q.id);
                          }}
                          className={cn('flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md', menu === r.q.id ? 'bg-foreground/15' : on ? 'opacity-90' : 'opacity-50 hover:opacity-90')}
                        >
                          <Ellipsis className="size-4" />
                        </button>
                      </div>
                      {menu === r.q.id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-1 top-10 z-40 flex w-[190px] flex-col rounded-lg border border-border bg-popover p-1 shadow-[0_12px_32px_rgb(0_0_0/0.35)]">
                          <MenuItem icon={Edit} label="Sửa" onClick={() => select(r.q.id)} />
                          <MenuItem icon={Copy} label="Nhân bản" onClick={() => duplicate(r.q)} />
                          {r.group && (
                            <MenuItem
                              icon={Plus}
                              label="Thêm câu con"
                              onClick={async () => {
                                await select(r.q.id);
                                setAddPos('group');
                                setAddKind('CHOICE');
                                setAddOpen(true);
                              }}
                            />
                          )}
                          <MenuItem icon={Trash2} label="Xóa" danger onClick={() => remove(r)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Editor */}
            <div className="flex min-w-0 flex-col gap-4">
              {!draft ? (
                <Panel>
                  <EmptyState
                    icon={ListChecks}
                    title="Bộ đề chưa có câu hỏi"
                    desc="Soạn từng câu, lấy câu từ bộ đề khác, hoặc để AI soạn nháp từ giáo trình."
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <FxButton icon={Sparkles} onClick={() => setAiOpen(true)}>
                          Tạo bằng AI
                        </FxButton>
                        <FxButton variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                          Thêm câu hỏi
                        </FxButton>
                      </div>
                    }
                  />
                </Panel>
              ) : (
                <>
                  <Panel padded={false} className="flex flex-col">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {draft.id === null ? `${KINDS[draft.kind].label} mới` : `${selRow?.group ? 'Nhóm' : 'Câu'} ${selRow?.label}`}
                      </span>
                      <Pill tone={draft.id === null || dirty ? 'brand' : 'success'} size="sm">
                        {draft.id === null ? 'Chưa lưu' : dirty ? 'Có thay đổi' : 'Đã lưu'}
                      </Pill>
                      {selRow && draft.id !== null && (
                        <>
                          <IconButton icon={Copy} label="Nhân bản" onClick={() => duplicate(selRow.q)} />
                          <IconButton icon={Trash2} label="Xóa" danger onClick={() => remove(selRow)} />
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 px-4 py-3">
                      <span id="kind-label" className="text-xs text-muted-foreground">
                        Dạng câu hỏi
                      </span>
                      <div role="radiogroup" aria-labelledby="kind-label" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                        {(Object.keys(KINDS) as Kind[])
                          .filter((k) => !(k === 'GROUP_QUESTION' && draft.parent_id))
                          .map((k) => {
                            const K = KINDS[k];
                            const on = draft.kind === k;
                            // a saved group cannot become a single question (and vice versa): its children would be orphaned
                            const locked = draft.id !== null && (k === 'GROUP_QUESTION') !== (draft.kind === 'GROUP_QUESTION');
                            return (
                              <button
                                key={k}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                disabled={locked}
                                title={locked ? 'Không đổi giữa câu nhóm và câu đơn sau khi đã lưu' : K.desc}
                                onClick={() => edit({ kind: k, answers: k === 'CHOICE' && !draft.answers.length ? newDraft('CHOICE', null).answers : draft.answers })}
                                className={cn(
                                  'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                  on ? 'border-primary bg-primary/12' : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                                )}
                              >
                                <K.icon className="size-3.5 opacity-85" />
                                {K.label}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </Panel>

                  <QuestionBody
                    draft={draft}
                    edit={edit}
                    errors={errors}
                    childRows={childRows}
                    onOpenChild={select}
                    onAddChild={() => {
                      setAddPos('group');
                      setAddKind('CHOICE');
                      setAddOpen(true);
                    }}
                    onTooFewAnswers={() => dialog.toast.info('Trắc nghiệm cần ít nhất 2 phương án')}
                  />

                  <QuestionProps draft={draft} edit={edit} errors={errors} topics={topics} />

                  {(errors.message || errors.type || errors.settings) && <span className="text-xs text-danger-fg">{errors.message || errors.type || errors.settings}</span>}

                  {/* always reachable, however long the question is */}
                  <div className="sticky bottom-3 z-10 flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2.5 shadow-lg backdrop-blur-md">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                      {draft.id === null ? 'Câu mới chưa được thêm vào bộ đề' : dirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu'}
                    </span>
                    {dirty && (
                      <FxButton
                        icon={Undo2}
                        onClick={() => {
                          const keep = selRow ?? rows[0];
                          setDraft(keep ? draftOf(keep.q) : null);
                          setSelId(keep?.q.id ?? null);
                          setDirty(false);
                          setErrors({});
                        }}
                      >
                        <span className="max-sm:sr-only">Huỷ thay đổi</span>
                      </FxButton>
                    )}
                    <FxButton variant="primary" icon={saving ? Loader2 : Save} disabled={saving || (!dirty && draft.id !== null)} onClick={save}>
                      {draft.id === null ? 'Thêm vào bộ đề' : 'Lưu câu hỏi'}
                    </FxButton>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {isClassical && tab === 2 && (
          <Matrix
            rows={rows}
            ratio={ratio}
            savedRatio={questionSet.ratio_per_difficulty ?? null}
            onRatio={setRatio}
            ratioSum={ratioSum}
            limit={info.limit_questions}
            saving={infoSaving}
            error={infoErrors.ratio_per_difficulty}
            onGoInfo={() => setTab(0)}
            onPreview={() => setTab(3)}
            onSave={() => (ratioSum !== 0 && ratioSum !== 100 ? dialog.alert({ title: 'Tổng tỉ lệ chưa đủ 100%', text: `Đang là ${ratioSum}%. Chỉnh lại cho đủ 100%, hoặc chọn "Không chia" để bốc ngẫu nhiên không theo độ khó.`, tone: 'warning' }) : saveInfo())}
          />
        )}

        {isClassical && tab === 3 && (
          <PaperPreview questionSetId={questionSet.id} rows={rows} limit={info.limit_questions} ratio={ratio} maxScore={Number(info.max_score) || 0} onEdit={(id) => void select(id)} />
        )}

        {!isClassical && tab === 1 && (
          <Panel padded={false} className="overflow-hidden">
            <PanelBar>
              <PanelTitle className="flex-1" title="Bài toán trong bộ đề" desc="Thứ tự hiển thị P1, P2… trong FoxyClient" />
              <FxButton variant="primary" size="sm" icon={Plus} onClick={() => router.visit(`/admin/question-sets/${questionSet.id}/problems/new`)}>
                Thêm bài toán
              </FxButton>
            </PanelBar>
            {programmingProblems.length === 0 ? (
              <EmptyState icon={Code} title="Bộ đề chưa có bài toán" desc="Tạo bài mới hoặc nhập từ ngân hàng đề." />
            ) : (
              programmingProblems.map((p, i) => {
                const d = DIFFICULTY[p.difficulty] ?? DIFFICULTY.MEDIUM;
                const tests = p.test_cases ?? [];
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                    <span className="w-7 font-bold">P{i + 1}</span>
                    <button type="button" onClick={() => router.visit(`/admin/question-sets/${questionSet.id}/problems/${p.id}`)} className="min-w-0 flex-[1_1_200px] cursor-pointer text-left">
                      <div className="font-medium hover:underline">{p.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        P-{p.id} · {p.time_limit_ms / 1000}s · {p.memory_limit_mb}MB · {tests.length} test ({tests.filter((t) => t.is_sample).length} mẫu)
                      </div>
                    </button>
                    <Pill tone={d.tone}>{d.short}</Pill>
                    <span className="font-mono text-xs text-muted-foreground">{(p.allowed_languages ?? []).join(' · ')}</span>
                    <IconButton icon={Pencil} label="Sửa" onClick={() => router.visit(`/admin/question-sets/${questionSet.id}/problems/${p.id}`)} />
                    <IconButton icon={Trash2} label="Xóa" danger onClick={() => removeProblem(p)} />
                  </div>
                );
              })
            )}
          </Panel>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        width={680}
        title="Thêm câu hỏi"
        desc="Chọn dạng câu và nơi thêm. Có thể đổi dạng câu trước khi lưu."
        footer={
          <>
            <FxButton onClick={() => setAddOpen(false)}>Hủy</FxButton>
            <FxButton variant="primary" icon={Plus} onClick={confirmAdd}>
              Thêm và soạn
            </FxButton>
          </>
        }
      >
        <Field label="Vị trí">
          <Segmented value={addPos} onChange={setAddPos} options={[{ value: 'end' as const, label: 'Cuối bộ đề' }, ...(groupForAdd ? [{ value: 'group' as const, label: `Vào Nhóm ${groupLabel}` }] : [])]} />
        </Field>
        <Field label="Dạng câu hỏi">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
            {(Object.keys(KINDS) as Kind[]).map((k) => {
              const K = KINDS[k];
              const on = addKind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAddKind(k)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-[10px] border p-3 text-left', on ? 'border-primary bg-primary/8' : 'border-border hover:border-foreground/20')}
                >
                  <span className={cn('flex size-[34px] shrink-0 items-center justify-center rounded-lg', on ? 'bg-primary/30' : 'bg-muted')}>
                    <K.icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{K.label}</span>
                    <span className="text-xs text-muted-foreground">{K.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
        {addKind === 'GROUP_QUESTION' && addPos === 'group' && (
          <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-xs text-warning-fg">
            <Info className="size-3.5 opacity-70" />
            Không thể đặt nhóm trong nhóm, nên câu hỏi nhóm sẽ được thêm ở cuối bộ đề.
          </div>
        )}
      </Modal>

      {isClassical && <AiGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} questionSetId={questionSet.id} />}
      {tab === 0 && <SaveBar visible={infoState.dirty} processing={infoSaving} onSave={() => saveInfo()} onCancel={() => setInfo({ name: questionSet.name, code: questionSet.code, course_id: questionSet.course_id ?? '', description: questionSet.description ?? '', max_score: questionSet.max_score, status: questionSet.status || 'DRAFT', limit_questions: questionSet.limit_questions ?? 0 })} saveLabel="Lưu thông tin" />}
      <ImportQuestionsModal isOpen={importOpen} onClose={() => setImportOpen(false)} questionSetId={questionSet.id} questionSetType={questionSet.type} availableItems={availableBankItems} />
    </AdminLayout>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] hover:bg-muted', danger && 'text-danger-fg')}>
      <Icon className="size-3.5 opacity-85" />
      {label}
    </button>
  );
}

/**
 * Ma trận đề: số câu theo (dạng câu hoặc chủ đề) × độ khó, và tỉ lệ bốc theo độ khó.
 * The plan mirrors QuestionSettings::draw: groups are drawn whole, a level that runs short is topped up from the others.
 */
function Matrix({
  rows,
  ratio,
  savedRatio,
  onRatio,
  ratioSum,
  limit,
  saving,
  error,
  onGoInfo,
  onPreview,
  onSave,
}: {
  rows: Row[];
  ratio: Record<Difficulty, number>;
  savedRatio: Partial<Record<Difficulty, number>> | null;
  onRatio: (r: Record<Difficulty, number>) => void;
  ratioSum: number;
  limit: number;
  saving: boolean;
  error?: string;
  onGoInfo: () => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  const [by, setBy] = useState<'kind' | 'topic'>('kind');
  const level = (q: ClassicalQuestionItem) => (q.difficulty || 'MEDIUM') as Difficulty;
  const qs = rows.filter((r) => !r.group);
  const roots = rows.filter((r) => !r.child);
  const NO_TOPIC = 'Chưa gắn chủ đề';

  const lines = useMemo(() => {
    const keyOf = (r: Row) => (by === 'kind' ? KINDS[kindOf(r.q)].label : r.q.skill || NO_TOPIC);
    const map = new Map<string, Row[]>();
    qs.forEach((r) => map.set(keyOf(r), [...(map.get(keyOf(r)) ?? []), r]));
    const order =
      by === 'kind'
        ? (Object.keys(KINDS) as Kind[]).map((k) => KINDS[k].label)
        : [...map.keys()].sort((x, y) => (x === NO_TOPIC ? 1 : y === NO_TOPIC ? -1 : x.localeCompare(y, 'vi')));
    return order.filter((k) => map.has(k)).map((k) => ({ key: k, rows: map.get(k)! }));
  }, [rows, by]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = (list: Row[], d: Difficulty) => list.filter((r) => level(r.q) === d).length;
  const points = (list: Row[]) => Number(list.reduce((s, r) => s + Number(r.q.points || 0), 0).toFixed(2));
  const maxCell = Math.max(1, ...lines.flatMap((l) => DIFFICULTY_ORDER.map((d) => count(l.rows, d))));
  const heat = (v: number) => (v ? { background: `color-mix(in oklch, var(--primary) ${10 + Math.round((v / maxCell) * 30)}%, transparent)` } : undefined);

  // what one paper gets per level (same arithmetic as the server)
  const drawing = limit > 0 && limit < roots.length;
  const plan = useMemo(() => {
    const active = DIFFICULTY_ORDER.filter((d) => (ratio[d] || 0) > 0);
    const sum = active.reduce((s, d) => s + ratio[d], 0);
    let remaining = limit;
    const out: Partial<Record<Difficulty, { want: number; have: number }>> = {};
    active.forEach((d, i) => {
      const want = Math.min(i === active.length - 1 ? remaining : Math.round((limit * ratio[d]) / sum), remaining);
      const have = roots.filter((r) => level(r.q) === d).length;
      out[d] = { want, have };
      remaining -= Math.min(want, have);
    });
    return out;
  }, [ratio, limit, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = DIFFICULTY_ORDER.some((d) => (ratio[d] || 0) !== (savedRatio?.[d] || 0));
  const presets: { label: string; r: Record<Difficulty, number> }[] = [
    { label: 'Không chia', r: { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 } },
    { label: '40 · 40 · 20', r: { EASY: 40, MEDIUM: 40, HARD: 20, EXPERT: 0 } },
    { label: '30 · 40 · 20 · 10', r: { EASY: 30, MEDIUM: 40, HARD: 20, EXPERT: 10 } },
  ];

  if (!qs.length) return <EmptyState icon={ListChecks} title="Chưa có câu hỏi để lập ma trận" desc="Thêm câu hỏi ở tab Câu hỏi, ma trận sẽ tự cập nhật." />;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel padded={false} className="min-w-0 overflow-hidden">
        <PanelBar>
          <PanelTitle className="flex-1" title="Phân bố câu hỏi" desc={`${qs.length} câu, ${points(qs)} điểm. Câu trong nhóm tính theo dạng của từng câu.`} />
          <Segmented
            value={by}
            onChange={setBy}
            options={[
              { value: 'kind' as const, label: 'Theo dạng câu' },
              { value: 'topic' as const, label: 'Theo chủ đề' },
            ]}
          />
        </PanelBar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">{by === 'kind' ? 'Dạng câu' : 'Chủ đề'}</th>
                {DIFFICULTY_ORDER.map((d) => (
                  <th key={d} className="w-[76px] px-1 py-2.5 text-center font-medium">
                    {DIFFICULTY[d].label}
                  </th>
                ))}
                <th className="w-[64px] px-2 py-2.5 text-center font-medium">Số câu</th>
                <th className="w-[72px] px-4 py-2.5 text-right font-medium">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b border-border">
                  <td className="max-w-[240px] truncate px-4 py-2" title={l.key}>
                    {l.key}
                  </td>
                  {DIFFICULTY_ORDER.map((d) => {
                    const v = count(l.rows, d);
                    return (
                      <td key={d} className="px-1 py-1.5 text-center">
                        <span className={cn('inline-flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 tabular-nums', v ? 'font-semibold' : 'text-muted-foreground/40')} style={heat(v)}>
                          {v || '–'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold tabular-nums">{l.rows.length}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{points(l.rows)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface font-semibold">
                <td className="px-4 pt-2.5 pb-1">Tổng</td>
                {DIFFICULTY_ORDER.map((d) => (
                  <td key={d} className="px-1 pt-2.5 pb-1 text-center tabular-nums">
                    {count(qs, d) || <span className="font-normal text-muted-foreground/40">–</span>}
                  </td>
                ))}
                <td className="px-2 pt-2.5 pb-1 text-center tabular-nums">{qs.length}</td>
                <td className="px-4 pt-2.5 pb-1 text-right tabular-nums">{points(qs)}</td>
              </tr>
              <tr className="bg-surface text-xs text-muted-foreground">
                <td className="px-4 pb-2.5">Tỉ lệ</td>
                {DIFFICULTY_ORDER.map((d) => (
                  <td key={d} className="px-1 pb-2.5 text-center tabular-nums">
                    {count(qs, d) ? `${Math.round((count(qs, d) / qs.length) * 100)}%` : ''}
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel className="flex min-w-0 flex-col gap-4 p-4">
        <PanelTitle title="Bốc đề theo độ khó" desc={drawing ? `Mỗi thí sinh nhận ${limit} trong ${roots.length} mục (một nhóm tính là một mục).` : undefined} />
        {!drawing ? (
          <div className="flex flex-col gap-3 rounded-[10px] bg-surface p-3 text-[13px] leading-relaxed">
            <span>
              {limit > 0
                ? `Số câu mỗi đề (${limit}) không nhỏ hơn số mục trong bộ đề (${roots.length}), nên ai cũng nhận đủ đề.`
                : 'Bộ đề đang dùng tất cả câu hỏi: mọi thí sinh nhận cùng một đề.'}{' '}
              Tỉ lệ độ khó chỉ có tác dụng khi bốc ngẫu nhiên.
            </span>
            <FxButton className="self-start" onClick={onGoInfo}>
              Bật bốc ngẫu nhiên
            </FxButton>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const on = DIFFICULTY_ORDER.every((d) => (ratio[d] || 0) === p.r[d]);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onRatio(p.r)}
                    className={cn('cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors', on ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground hover:bg-muted')}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3.5">
              {DIFFICULTY_ORDER.map((d) => {
                const p = plan[d];
                const have = roots.filter((r) => level(r.q) === d).length;
                const short = !!p && p.want > p.have;
                return (
                  <div key={d} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{DIFFICULTY[d].label}</div>
                        <div className={cn('text-xs', short ? 'text-warning-fg' : 'text-muted-foreground')}>
                          {p
                            ? short
                              ? `Cần ${p.want}, chỉ có ${p.have}: thiếu ${p.want - p.have}, bù bằng mức khác`
                              : `${p.want} mục mỗi đề, có sẵn ${have}`
                            : `Có sẵn ${have} mục`}
                        </div>
                      </div>
                      <div className="w-[96px] shrink-0">
                        <FxInput
                          type="number"
                          min={0}
                          max={100}
                          suffix="%"
                          aria-label={`Tỉ lệ ${DIFFICULTY[d].label}`}
                          value={ratio[d] || 0}
                          onChange={(e) => onRatio({ ...ratio, [d]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        />
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full rounded-full transition-[width]', short ? 'bg-warning' : 'bg-primary')} style={{ width: `${ratio[d] || 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={cn('rounded-lg px-3 py-2 text-xs', ratioSum === 0 || ratioSum === 100 ? 'bg-surface text-muted-foreground' : 'bg-danger/10 text-danger-fg')} role="status">
              {ratioSum === 0 ? 'Không chia theo độ khó: mỗi đề bốc ngẫu nhiên từ toàn bộ.' : ratioSum === 100 ? 'Tổng 100%.' : `Tổng phải đủ 100%, hiện là ${ratioSum}%.`}
            </div>
            {error && <span className="text-xs text-danger-fg">{error}</span>}
            <div className="flex flex-wrap gap-2">
              <FxButton onClick={onPreview}>Xem một đề mẫu</FxButton>
              <FxButton variant="primary" icon={saving ? Loader2 : Save} disabled={saving || !changed} onClick={onSave} className="flex-1">
                {changed ? 'Lưu tỉ lệ' : 'Đã lưu'}
              </FxButton>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
