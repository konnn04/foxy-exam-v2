import React from 'react';
import { Check, CircleCheck, CircleX, Hand, Plus, Trash2 } from 'lucide-react';
import { Field, FxInput, FxTextarea, IconButton, Panel, Pill, Segmented, Switch } from './ui';
import { MediaInput } from './question-media';
import { DIFFICULTY } from './domain';
import { DIFFICULTY_ORDER, KINDS, SKILLS, TF, blankNumbers, type Draft, type Kind } from './question-draft';
import { cn } from '@/lib/utils';

type Edit = (patch: Partial<Draft>) => void;

export interface ChildRow {
  id: number;
  label: string;
  snippet: string;
  kind: Kind;
}

/** Centre column: content + the editor of the chosen kind. */
export function QuestionBody({
  draft,
  edit,
  errors,
  childRows,
  onOpenChild,
  onAddChild,
  onTooFewAnswers,
}: {
  draft: Draft;
  edit: Edit;
  errors: Record<string, string>;
  childRows: ChildRow[];
  onOpenChild: (id: number) => void;
  onAddChild: () => void;
  onTooFewAnswers: () => void;
}) {
  const k = draft.kind;
  const nums = blankNumbers(draft.content);
  const nextBlank = (nums.at(-1) ?? 0) + 1;

  return (
    <>
      <Panel padded={false} className="overflow-hidden">
        <textarea
          value={draft.content}
          onChange={(e) => edit({ content: e.target.value })}
          placeholder={
            k === 'GROUP_QUESTION'
              ? 'Hướng dẫn chung cho cả nhóm…'
              : k === 'FILL'
                ? 'VD: The first garden opened in [1] and now has more than [2] members.'
                : 'Nhập nội dung câu hỏi…'
          }
          rows={k === 'GROUP_QUESTION' ? 3 : 4}
          className="block w-full resize-y bg-transparent p-4 text-[15px] leading-[1.7] outline-none placeholder:text-muted-foreground"
        />
        {k === 'FILL' && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => edit({ content: `${draft.content}${draft.content && !/\s$/.test(draft.content) ? ' ' : ''}[${nextBlank}]` })}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-dashed border-primary/60 px-2 font-medium text-brand-fg hover:bg-primary/10"
            >
              <Plus className="size-3" /> Chèn ô trống [{nextBlank}]
            </button>
            Mỗi dấu [n] là một ô thí sinh phải điền.
          </div>
        )}
        {errors.content && <div className="px-4 pb-3 text-xs text-danger-fg">{errors.content}</div>}
      </Panel>

      {k !== 'GROUP_QUESTION' && (
        <Panel className="flex flex-col gap-2 p-4">
          <span className="text-xs font-medium text-muted-foreground">Hình minh họa (tùy chọn)</span>
          <MediaInput kind="image" value={draft.image} onChange={(image) => edit({ image })} />
        </Panel>
      )}

      {k === 'GROUP_QUESTION' && (
        <Panel className="flex flex-col gap-3.5 p-4">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-semibold">Tài liệu dùng chung</span>
            <Segmented
              size="sm"
              value={draft.group.media}
              onChange={(media) => edit({ group: { ...draft.group, media } })}
              options={[
                { value: 'text', label: 'Văn bản' },
                { value: 'audio', label: 'Âm thanh' },
                { value: 'image', label: 'Hình ảnh' },
              ]}
            />
          </div>
          {draft.group.media === 'text' && (
            <FxTextarea rows={7} value={draft.group.passage} placeholder="Dán đoạn văn đọc hiểu vào đây…" onChange={(e) => edit({ group: { ...draft.group, passage: e.target.value } })} />
          )}
          {draft.group.media === 'audio' && (
            <>
              <MediaInput kind="audio" value={draft.group.audio_url} onChange={(audio_url) => edit({ group: { ...draft.group, audio_url } })} />
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                <Field label="Số lần được nghe" hint="0 = không giới hạn">
                  <FxInput type="number" min={0} max={20} value={draft.group.listen_limit} onChange={(e) => edit({ group: { ...draft.group, listen_limit: Number(e.target.value) } })} />
                </Field>
                <Field label="Cho tua">
                  <div className="flex h-9 items-center gap-2">
                    <Switch checked={draft.group.allow_seek} onChange={(allow_seek) => edit({ group: { ...draft.group, allow_seek } })} label="Cho tua" />
                    <span className="text-[13px] text-muted-foreground">{draft.group.allow_seek ? 'Có' : 'Không'}</span>
                  </div>
                </Field>
              </div>
              <Field label="Văn bản kèm theo (tùy chọn)">
                <FxTextarea rows={3} value={draft.group.passage} placeholder="Transcript, hướng dẫn…" onChange={(e) => edit({ group: { ...draft.group, passage: e.target.value } })} />
              </Field>
            </>
          )}
          {draft.group.media === 'image' && <MediaInput kind="image" value={draft.group.image_url} onChange={(image_url) => edit({ group: { ...draft.group, image_url } })} />}
          {errors.group && <span className="text-xs text-danger-fg">{errors.group}</span>}

          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <span className="text-xs font-medium text-muted-foreground">Câu hỏi con</span>
            {childRows.map((c) => {
              const K = KINDS[c.kind];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenChild(c.id)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-surface"
                >
                  <span className="font-mono text-xs text-muted-foreground">Câu {c.label}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{c.snippet}</span>
                  <Pill size="sm">
                    <K.icon className="size-3" /> {K.label}
                  </Pill>
                </button>
              );
            })}
            {draft.id !== null ? (
              <button
                type="button"
                onClick={onAddChild}
                className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-foreground/25 text-[13px] text-muted-foreground hover:border-primary hover:text-brand-fg"
              >
                <Plus className="size-4 opacity-60" /> Thêm câu con
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Lưu nhóm trước, rồi thêm câu con.</span>
            )}
          </div>
        </Panel>
      )}

      {k === 'CHOICE' && (
        <Panel className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Đáp án</span>
            <span className="text-xs text-muted-foreground">
              {draft.answers.filter((a) => a.is_correct).length > 1 ? 'Nhiều đáp án đúng → thí sinh thấy ô checkbox' : 'Bấm ✓ để đánh dấu đáp án đúng'}
            </span>
          </div>
          {draft.answers.map((a, i) => (
            <div key={i} className={cn('flex items-center gap-3 rounded-[10px] border px-3 py-2', a.is_correct ? 'border-success/60 bg-success/8' : 'border-border')}>
              <span
                className={cn(
                  'flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                  a.is_correct ? 'border-success bg-success text-background' : 'border-foreground/30',
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <input
                value={a.content}
                onChange={(e) => edit({ answers: draft.answers.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)) })}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Đáp án đúng"
                onClick={() => edit({ answers: draft.answers.map((x, j) => (j === i ? { ...x, is_correct: !x.is_correct } : x)) })}
                className={cn(
                  'flex size-7 cursor-pointer items-center justify-center rounded-md border',
                  a.is_correct ? 'border-success bg-success text-background' : 'border-foreground/25 text-transparent hover:text-muted-foreground',
                )}
              >
                <Check className="size-3.5" />
              </button>
              <IconButton
                icon={Trash2}
                label="Xóa đáp án"
                danger
                className="size-7"
                onClick={() => (draft.answers.length <= 2 ? onTooFewAnswers() : edit({ answers: draft.answers.filter((_, j) => j !== i) }))}
              />
            </div>
          ))}
          {draft.answers.length < 8 && (
            <button
              type="button"
              onClick={() => edit({ answers: [...draft.answers, { content: `Đáp án ${String.fromCharCode(65 + draft.answers.length)}`, is_correct: false }] })}
              className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-foreground/25 text-[13px] text-muted-foreground hover:border-primary hover:text-brand-fg"
            >
              <Plus className="size-4 opacity-60" /> Thêm đáp án
            </button>
          )}
          {errors.answers && <span className="text-xs text-danger-fg">{errors.answers}</span>}
        </Panel>
      )}

      {k === 'TRUE_FALSE' && (
        <Panel className="flex flex-col gap-2.5 p-4">
          <span className="font-semibold">Đáp án đúng</span>
          <div className="grid grid-cols-2 gap-2.5">
            {TF.map((t, i) => {
              const on = draft.is_true === (i === 0);
              const Icon = i === 0 ? CircleCheck : CircleX;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => edit({ is_true: i === 0 })}
                  className={cn('flex h-14 cursor-pointer items-center justify-center gap-2 rounded-[10px] border text-[15px] font-semibold', on ? 'border-success bg-success/14' : 'border-border')}
                >
                  <Icon className="size-4" />
                  {t}
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      {k === 'FILL' && (
        <Panel className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Đáp án từng ô trống</span>
            <span className="text-xs text-muted-foreground">Nhiều cách viết đúng: ngăn cách bằng dấu |</span>
          </div>
          {nums.length === 0 && <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">Chèn [1], [2]… vào nội dung để tạo ô trống.</div>}
          {nums.map((n) => (
            <div key={n} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2.5">
              <span className="rounded-md bg-primary/16 px-2 py-[3px] text-center text-xs font-semibold text-brand-fg">Ô {n}</span>
              <FxInput
                mono
                value={draft.blanks[n - 1] ?? ''}
                placeholder={`Đáp án ô ${n} | cách viết khác`}
                onChange={(e) => {
                  const blanks = [...draft.blanks];
                  while (blanks.length < n) blanks.push('');
                  blanks[n - 1] = e.target.value;
                  edit({ blanks });
                }}
              />
            </div>
          ))}
          <span className="text-xs text-muted-foreground">So khớp không phân biệt hoa thường. Điểm chia đều theo số ô đúng.</span>
          {errors.blanks && <span className="text-xs text-danger-fg">{errors.blanks}</span>}
        </Panel>
      )}

      {k === 'SHORT_ANSWER' && (
        <Panel className="flex flex-col gap-2.5 p-4">
          <span className="font-semibold">Đáp án mẫu</span>
          <FxInput value={draft.reference} maxLength={300} suffix={`${draft.reference.length}/300`} onChange={(e) => edit({ reference: e.target.value })} placeholder="They water the plants and share tools" />
          <span className="text-xs text-muted-foreground">Có đáp án mẫu → chấm tự động (nhiều cách viết: ngăn cách bằng |). Để trống → giảng viên chấm tay.</span>
        </Panel>
      )}

      {k === 'ESSAY' && (
        <Panel className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-semibold">Hình thức trả lời</span>
            <Segmented
              size="sm"
              value={draft.essay.mode}
              onChange={(mode) => edit({ essay: { ...draft.essay, mode } })}
              options={[
                { value: 'write', label: 'Viết' },
                { value: 'audio', label: 'Ghi âm (Nói)' },
                { value: 'file', label: 'Tải tệp' },
              ]}
            />
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
            {draft.essay.mode === 'write' && (
              <>
                <Field label="Số từ tối thiểu" hint="0 = không yêu cầu">
                  <FxInput type="number" min={0} value={draft.essay.min_words} onChange={(e) => edit({ essay: { ...draft.essay, min_words: Number(e.target.value) } })} />
                </Field>
                <Field label="Số từ tối đa" hint="0 = không giới hạn">
                  <FxInput type="number" min={0} value={draft.essay.max_words} onChange={(e) => edit({ essay: { ...draft.essay, max_words: Number(e.target.value) } })} />
                </Field>
              </>
            )}
            {draft.essay.mode === 'audio' && (
              <>
                <Field label="Thời gian chuẩn bị">
                  <FxInput type="number" min={0} suffix="giây" value={draft.essay.prep_seconds} onChange={(e) => edit({ essay: { ...draft.essay, prep_seconds: Number(e.target.value) } })} />
                </Field>
                <Field label="Thời gian nói tối đa">
                  <FxInput type="number" min={10} suffix="giây" value={draft.essay.max_seconds} onChange={(e) => edit({ essay: { ...draft.essay, max_seconds: Number(e.target.value) } })} />
                </Field>
              </>
            )}
            {draft.essay.mode === 'file' && (
              <>
                <Field label="Số tệp tối đa">
                  <FxInput type="number" min={1} max={10} value={draft.essay.max_files} onChange={(e) => edit({ essay: { ...draft.essay, max_files: Number(e.target.value) } })} />
                </Field>
                <Field label="Định dạng cho phép">
                  <FxInput mono value={draft.essay.accept} onChange={(e) => edit({ essay: { ...draft.essay, accept: e.target.value } })} />
                </Field>
              </>
            )}
          </div>
          {errors.essay && <span className="text-xs text-danger-fg">{errors.essay}</span>}
          <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-xs text-warning-fg">
            <Hand className="size-4 opacity-70" />
            Câu này chấm tay — xuất hiện trong hàng chờ chấm của giảng viên.
          </div>
        </Panel>
      )}
    </>
  );
}

/** Right column: difficulty, points, skill, explanation. */
export function QuestionProps({ draft, edit, errors }: { draft: Draft; edit: Edit; errors: Record<string, string> }) {
  return (
    <Panel className="flex min-w-0 max-w-[320px] flex-[1_1_240px] flex-col gap-3.5 p-4">
      <span className="font-semibold">Thuộc tính</span>
      <Field label="Độ khó" error={errors.difficulty}>
        <div className="grid grid-cols-2 gap-1">
          {DIFFICULTY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => edit({ difficulty: d })}
              className={cn(
                'h-[30px] cursor-pointer rounded-md border text-[13px] font-medium',
                draft.difficulty === d ? 'border-transparent bg-foreground text-background' : 'border-border text-muted-foreground',
              )}
            >
              {DIFFICULTY[d].label}
            </button>
          ))}
        </div>
      </Field>
      {draft.kind !== 'GROUP_QUESTION' && (
        <Field label="Trọng số (điểm)" error={errors.points}>
          <FxInput type="number" min={0} step={0.25} value={draft.points} onChange={(e) => edit({ points: Number(e.target.value) })} />
        </Field>
      )}
      <Field label="Kỹ năng">
        <div className="flex flex-wrap gap-1">
          {SKILLS.map((s) => {
            const on = draft.skill === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => edit({ skill: on ? '' : s })}
                className={cn('cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium', on ? 'border-transparent bg-primary/16 text-brand-fg' : 'border-border text-muted-foreground hover:text-foreground')}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Giải thích / gợi ý chấm" hint="Hiện cho thí sinh khi bật “Cho xem lại bài”.">
        <FxTextarea value={draft.explanation} onChange={(e) => edit({ explanation: e.target.value })} />
      </Field>
    </Panel>
  );
}
