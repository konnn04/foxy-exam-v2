import React, { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Code, Copy, Download, Ellipsis, ListChecks, MonitorSmartphone, Pencil, Plus, Send, Trash2, Info, Pencil as Edit } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import type { BankItem } from '@/components/admin/question-sets/import-questions-modal';
import { ImportQuestionsModal } from '@/components/admin/question-sets';
import type { ClassicalQuestionItem, CourseOption, Difficulty, ProgrammingProblemItem, QuestionSetDetail, QuestionSetOtherSet } from '@/types/questions';
import { EmptyState, Field, FxButton, FxInput, FxSelect, FxTextarea, IconButton, Modal, PageHeader, Panel, PanelBar, PanelTitle, Pill, Segmented, StepTabs } from '@/components/foxy/ui';
import { DIFFICULTY } from '@/components/foxy/domain';
import { useDialog } from '@/components/foxy/dialogs';
import { DIFFICULTY_ORDER, KINDS, draftOf, kindOf, newDraft, payloadOf, validateDraft, type Draft, type Kind } from '@/components/foxy/question-draft';
import { QuestionBody, QuestionProps } from '@/components/foxy/question-editor';
import { QuestionPreview } from '@/components/foxy/question-preview';
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

  const labels = isClassical ? ['Thông tin bộ đề', `Câu hỏi (${questionCount})`, 'Ma trận đề', 'Xem trước'] : ['Thông tin bộ đề', `Bài toán (${programmingProblems.length})`];
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
  const [addKind, setAddKind] = useState<Kind>('CHOICE');
  const [addPos, setAddPos] = useState<'end' | 'group'>('end');

  // after a server round-trip the list is fresh: re-sync the editor with the saved row
  useEffect(() => {
    if (dirty || !selId) return;
    const r = rows.find((x) => x.q.id === selId);
    if (r) setDraft(draftOf(r.q));
  }, [classicalQuestions]); // eslint-disable-line react-hooks/exhaustive-deps

  // leaving the page with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
  const ratioSum = DIFFICULTY_ORDER.reduce((s, d) => s + (ratio[d] || 0), 0);

  const saveInfo = (override?: Partial<typeof info>) => {
    const data = { ...info, ...override, course_id: (override?.course_id ?? info.course_id) || null, ratio_per_difficulty: ratioSum > 0 ? ratio : null };
    router.post(`/admin/question-sets/${questionSet.id}/update`, data, {
      preserveScroll: true,
      onError: setInfoErrors,
      onSuccess: () => {
        setInfoErrors({});
        if (override) setInfo((i) => ({ ...i, ...override }));
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
              <Pill tone={isClassical ? 'info' : 'brand'}>{isClassical ? 'Phổ thông' : 'Lập trình'}</Pill>
              {statusPill}
            </>
          }
          desc={
            <>
              <span className="font-mono">{questionSet.code}</span> · Môn: {questionSet.course_name || 'Dùng chung'} ·{' '}
              {isClassical
                ? `${questionCount} câu · ${Number(totalPoints.toFixed(2))} / ${questionSet.max_score} điểm${questionSet.limit_questions ? ` · bốc ${questionSet.limit_questions} câu / lượt thi` : ''}`
                : `${programmingProblems.length} bài`}
            </>
          }
          actions={
            <>
              <FxButton icon={Download} onClick={() => setImportOpen(true)}>
                Nhập từ ngân hàng
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
          <Panel className="flex max-w-[880px] flex-col gap-3.5">
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <Field label="Mã bộ đề" error={infoErrors.code}>
                <FxInput mono value={info.code} onChange={(e) => setInfo({ ...info, code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Tên bộ đề" error={infoErrors.name}>
                <FxInput value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
              </Field>
              <Field label="Môn học" error={infoErrors.course_id}>
                <FxSelect value={info.course_id} onChange={(e) => setInfo({ ...info, course_id: e.target.value ? Number(e.target.value) : '' })}>
                  <option value="">Dùng chung</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </FxSelect>
              </Field>
            </div>
            <Field label="Mô tả" error={infoErrors.description}>
              <FxTextarea rows={3} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
            </Field>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
              <Field label="Điểm tối đa" error={infoErrors.max_score}>
                <FxInput type="number" min={0} step={0.5} value={info.max_score} onChange={(e) => setInfo({ ...info, max_score: Number(e.target.value) })} />
              </Field>
              {isClassical && (
                <Field label="Số câu bốc khi thi" hint="0 = dùng tất cả câu của bộ đề" error={infoErrors.limit_questions}>
                  <FxInput type="number" min={0} suffix="câu" value={info.limit_questions} onChange={(e) => setInfo({ ...info, limit_questions: Number(e.target.value) })} />
                </Field>
              )}
              <Field label="Trạng thái" error={infoErrors.status}>
                <FxSelect value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value })}>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="PUBLISHED">Đã xuất bản</option>
                  <option value="ARCHIVED">Lưu trữ</option>
                </FxSelect>
              </Field>
            </div>
            <div className="flex justify-end">
              <FxButton variant="primary" onClick={() => saveInfo()}>
                Lưu thông tin
              </FxButton>
            </div>
          </Panel>
        )}

        {isClassical && tab === 1 && (
          <div className="flex flex-wrap items-start gap-4">
            {/* Question list */}
            <Panel padded={false} className="min-w-0 max-w-[300px] flex-[1_1_240px]">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <span className="font-semibold">Câu hỏi</span>
                <FxButton
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    setAddPos('end');
                    setAddOpen(true);
                  }}
                >
                  Thêm
                </FxButton>
              </div>
              <div className="flex flex-col p-1.5">
                {rows.length === 0 && !draft && <div className="px-2 py-6 text-center text-[13px] text-muted-foreground">Chưa có câu hỏi.</div>}
                {draft?.id === null && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-muted p-2 shadow-[inset_2px_0_0_var(--primary)]" style={{ paddingLeft: draft.parent_id ? 24 : 8 }}>
                    <span className="flex h-[22px] min-w-6 items-center justify-center rounded-md border border-dashed border-primary font-mono text-[11px] font-bold">+</span>
                    <div className="min-w-0 flex-1 text-[13px] text-brand-fg">{KINDS[draft.kind].label} mới · chưa lưu</div>
                  </div>
                )}
                {rows.map((r) => {
                  const on = r.q.id === selId;
                  const k = kindOf(r.q);
                  return (
                    <div key={r.q.id} className="relative">
                      <div
                        onClick={() => select(r.q.id)}
                        className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg p-2', on ? 'bg-muted shadow-[inset_2px_0_0_var(--primary)]' : 'hover:bg-surface')}
                        style={{ paddingLeft: r.child ? 24 : 8 }}
                      >
                        <span className={cn('flex h-[22px] min-w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold', r.group ? 'bg-violet/20 text-violet-fg' : 'border border-foreground/20 bg-surface')}>
                          {r.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px]">{r.q.content}</div>
                          <div className="mt-[3px] flex gap-1.5 text-[11px] text-muted-foreground">
                            <span>{KINDS[k].label}</span>
                            {!r.group && (
                              <>
                                <span>·</span>
                                <span>{Number(r.q.points)}đ</span>
                              </>
                            )}
                            {r.q.skill && (
                              <>
                                <span>·</span>
                                <span>{r.q.skill}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Tác vụ"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenu(menu === r.q.id ? null : r.q.id);
                          }}
                          className={cn('flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md', menu === r.q.id ? 'bg-foreground/15' : on ? 'opacity-90' : 'opacity-35 hover:opacity-90')}
                        >
                          <Ellipsis className="size-3.5" />
                        </button>
                      </div>
                      {menu === r.q.id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-1 top-10 z-40 flex w-[190px] flex-col rounded-lg border border-border bg-popover p-1 shadow-[0_12px_32px_rgb(0_0_0/0.5)]">
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
            <div className="flex min-w-0 flex-[3_1_440px] flex-col gap-4">
              {!draft ? (
                <Panel>
                  <EmptyState
                    icon={ListChecks}
                    title="Bộ đề chưa có câu hỏi"
                    desc="Thêm câu hỏi mới hoặc nhập từ ngân hàng đề."
                    action={
                      <FxButton variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                        Thêm câu hỏi
                      </FxButton>
                    }
                  />
                </Panel>
              ) : (
                <>
                  <Panel padded={false} className="flex flex-col gap-2 p-3">
                    <span className="text-xs font-medium text-muted-foreground">Dạng câu hỏi</span>
                    <div className="flex flex-wrap gap-1.5">
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
                              disabled={locked}
                              title={locked ? 'Không đổi giữa câu nhóm và câu đơn sau khi tạo' : undefined}
                              onClick={() => edit({ kind: k, answers: k === 'CHOICE' && !draft.answers.length ? newDraft('CHOICE', null).answers : draft.answers })}
                              className={cn(
                                'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40',
                                on ? 'border-primary bg-primary/12' : 'border-border hover:border-foreground/25',
                              )}
                            >
                              <K.icon className="size-3.5 opacity-85" />
                              {K.label}
                            </button>
                          );
                        })}
                    </div>
                  </Panel>

                  <Panel padded={false} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {draft.id === null ? `${KINDS[draft.kind].label} mới` : `${selRow?.group ? 'Nhóm' : 'Câu'} ${selRow?.label} · ${KINDS[draft.kind].label}`}
                    </span>
                    <Pill tone={draft.id === null || dirty ? 'brand' : 'neutral'} size="sm">
                      {draft.id === null ? 'Mới · chưa lưu' : dirty ? 'Chưa lưu' : 'Đã lưu'}
                    </Pill>
                    {selRow && draft.id !== null && (
                      <>
                        <IconButton icon={Copy} label="Nhân bản" onClick={() => duplicate(selRow.q)} />
                        <IconButton icon={Trash2} label="Xóa" danger onClick={() => remove(selRow)} />
                      </>
                    )}
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
                    onTooFewAnswers={() => dialog.toast.info('Trắc nghiệm cần ít nhất 2 đáp án')}
                  />

                  {(errors.message || errors.type || errors.settings) && <span className="text-xs text-danger-fg">{errors.message || errors.type || errors.settings}</span>}

                  <div className="flex justify-end gap-2">
                    {dirty && (
                      <FxButton
                        onClick={() => {
                          const keep = selRow ?? rows[0];
                          setDraft(keep ? draftOf(keep.q) : null);
                          setSelId(keep?.q.id ?? null);
                          setDirty(false);
                          setErrors({});
                        }}
                      >
                        Hủy thay đổi
                      </FxButton>
                    )}
                    <FxButton variant="primary" disabled={saving || (!dirty && draft.id !== null)} onClick={save}>
                      {draft.id === null ? 'Thêm vào bộ đề' : 'Lưu câu hỏi'}
                    </FxButton>
                  </div>
                </>
              )}
            </div>

            {draft && <QuestionProps draft={draft} edit={edit} errors={errors} />}
          </div>
        )}

        {isClassical && tab === 2 && (
          <Matrix
            rows={rows}
            ratio={ratio}
            onRatio={setRatio}
            ratioSum={ratioSum}
            limit={info.limit_questions}
            error={infoErrors.ratio_per_difficulty}
            onSave={() => (ratioSum !== 0 && ratioSum !== 100 ? dialog.alert({ title: 'Tổng tỉ lệ chưa đủ 100%', text: `Đang là ${ratioSum}%. Chỉnh lại cho đủ 100% hoặc để tất cả bằng 0 để bốc ngẫu nhiên.`, tone: 'warning' }) : saveInfo())}
          />
        )}

        {isClassical && tab === 3 && (
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <MonitorSmartphone className="size-4 opacity-60" />
              Xem như thí sinh trên FoxyClient · {selRow ? `${selRow.group ? 'Nhóm' : 'Câu'} ${selRow.label}` : '—'}
            </div>
            <Panel className="p-6">{draft ? <QuestionPreview draft={draft} /> : <EmptyState icon={Info} title="Chọn một câu hỏi để xem trước" />}</Panel>
          </div>
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
        desc="Chọn dạng câu và vị trí chèn — có thể đổi dạng sau khi tạo."
        footer={
          <>
            <FxButton onClick={() => setAddOpen(false)}>Hủy</FxButton>
            <FxButton variant="primary" icon={Plus} onClick={confirmAdd}>
              Thêm &amp; soạn
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
            Không lồng nhóm trong nhóm — câu hỏi nhóm sẽ được thêm ở cuối bộ đề.
          </div>
        )}
      </Modal>

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

/** Ma trận đề: số câu theo dạng × độ khó, và tỉ lệ bốc theo độ khó. */
function Matrix({
  rows,
  ratio,
  onRatio,
  ratioSum,
  limit,
  error,
  onSave,
}: {
  rows: Row[];
  ratio: Record<Difficulty, number>;
  onRatio: (r: Record<Difficulty, number>) => void;
  ratioSum: number;
  limit: number;
  error?: string;
  onSave: () => void;
}) {
  const qs = rows.filter((r) => !r.group);
  const kinds = (Object.keys(KINDS) as Kind[]).filter((k) => k !== 'GROUP_QUESTION');
  const cell = (k: Kind, d: string) => qs.filter((r) => kindOf(r.q) === k && (r.q.difficulty || 'MEDIUM') === d).length;
  const avail = (d: string) => qs.filter((r) => !r.child && (r.q.difficulty || 'MEDIUM') === d).length;
  const grid = 'grid grid-cols-[minmax(140px,1.4fr)_repeat(4,minmax(64px,1fr))_64px] items-center px-4';

  return (
    <div className="flex flex-wrap items-start gap-4">
      <Panel padded={false} className="min-w-0 flex-[2_1_480px] overflow-auto">
        <div className="min-w-[600px]">
          <div className={cn(grid, 'border-b border-border py-2.5 text-xs font-medium text-muted-foreground')}>
            <span>Dạng \ Độ khó</span>
            {DIFFICULTY_ORDER.map((d) => (
              <span key={d}>{DIFFICULTY[d].label}</span>
            ))}
            <span className="text-right">Tổng</span>
          </div>
          {kinds.map((k) => {
            const cells = DIFFICULTY_ORDER.map((d) => cell(k, d));
            return (
              <div key={k} className={cn(grid, 'border-b border-border py-2.5 text-sm last:border-b-0')}>
                <span>{KINDS[k].label}</span>
                {cells.map((v, i) => (
                  <span
                    key={i}
                    className={cn('flex h-7 w-9 items-center justify-center rounded-md font-semibold tabular-nums', v ? 'text-brand-fg' : 'text-muted-foreground/50')}
                    style={v ? { background: `color-mix(in oklch, var(--primary) ${12 + Math.min(v, 6) * 10}%, transparent)` } : undefined}
                  >
                    {v}
                  </span>
                ))}
                <span className="text-right font-semibold">{cells.reduce((a, b) => a + b, 0)}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 p-4">
        <PanelTitle title="Tỉ lệ bốc theo độ khó" desc={limit ? `Khi thi bốc ${limit} câu` : 'Đặt “Số câu bốc khi thi” ở tab Thông tin để áp dụng'} />
        {DIFFICULTY_ORDER.map((d) => (
          <div key={d} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span>
                {DIFFICULTY[d].label} <span className="text-xs text-muted-foreground">· có {avail(d)} câu</span>
              </span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={ratio[d] || 0}
                  onChange={(e) => onRatio({ ...ratio, [d]: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  className="h-7 w-14 rounded-md border border-border bg-card px-1.5 text-right font-mono text-xs outline-none focus:border-primary"
                />
                <span className="font-mono text-xs">%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${ratio[d] || 0}%` }} />
            </div>
          </div>
        ))}
        <div className={cn('text-xs', ratioSum === 0 || ratioSum === 100 ? 'text-muted-foreground' : 'text-danger-fg')}>
          {ratioSum === 0 ? 'Để trống tất cả = bốc ngẫu nhiên không phân theo độ khó.' : `Tổng phải bằng 100%. Đang: ${ratioSum}%.`}
        </div>
        {error && <span className="text-xs text-danger-fg">{error}</span>}
        <FxButton variant="primary" onClick={onSave}>
          Lưu quy tắc bốc câu
        </FxButton>
      </Panel>
    </div>
  );
}
