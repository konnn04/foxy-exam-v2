import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Shuffle } from 'lucide-react';
import type { ClassicalQuestionItem, Difficulty } from '@/types/questions';
import { EmptyState, FxButton, IconButton, Panel, Pill, Segmented, Switch } from './ui';
import { DIFFICULTY } from './domain';
import { DIFFICULTY_ORDER, KINDS, draftOf, kindOf } from './question-draft';
import { QuestionPreview } from './question-preview';
import { cn } from '@/lib/utils';

export interface PaperRow {
  q: ClassicalQuestionItem;
  label: string;
  child: boolean;
  group: boolean;
}

const fmt = (n: number) => String(Number(n.toFixed(2)));

/**
 * "Xem trước": the whole paper the way a candidate reads it, top to bottom. With random drawing on, one paper is dealt by
 * the server with the same code an exam uses, from the limit and ratio currently on screen (saved or not).
 */
export function PaperPreview({
  questionSetId,
  rows,
  limit,
  ratio,
  maxScore,
  onEdit,
}: {
  questionSetId: number;
  rows: PaperRow[];
  limit: number;
  ratio: Record<Difficulty, number>;
  maxScore: number;
  onEdit: (id: number) => void;
}) {
  const roots = rows.filter((r) => !r.child);
  const drawing = limit > 0 && limit < roots.length;
  const [mode, setMode] = useState<'all' | 'draw'>(drawing ? 'draw' : 'all');
  const [showKey, setShowKey] = useState(false);
  const [seed, setSeed] = useState<number | null>(null);
  const [ids, setIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effective = drawing ? mode : 'all';

  const deal = useCallback(
    async (newSeed?: number) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ limit: String(limit) });
        if (newSeed !== undefined) qs.set('seed', String(newSeed));
        DIFFICULTY_ORDER.forEach((d) => qs.set(`ratio[${d}]`, String(ratio[d] || 0)));
        const res = await fetch(`/admin/question-sets/${questionSetId}/sample-paper?${qs}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Lỗi ${res.status}`);
        const body = (await res.json()) as { seed: number; ids: number[] };
        setSeed(body.seed);
        setIds(body.ids);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không bốc được đề.');
      } finally {
        setLoading(false);
      }
    },
    [questionSetId, limit, ratio],
  );

  // re-deal (same seed) whenever the rules or the questions change
  useEffect(() => {
    if (effective === 'draw') void deal(seed ?? undefined);
  }, [effective, limit, JSON.stringify(ratio), rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // the paper as the candidate reads it: groups keep their questions, numbering restarts at 1
  const paper = useMemo(() => {
    const keep = effective === 'draw' && ids ? new Set(ids) : null;
    const items: { row: PaperRow; no: string; children: { row: PaperRow; no: string }[] }[] = [];
    let n = 0;
    let g = 0;
    roots.forEach((r) => {
      if (keep && !keep.has(r.q.id)) return;
      if (r.group) {
        const kids = rows.filter((c) => c.child && c.q.parent_id === r.q.id).map((c) => ({ row: c, no: String(++n) }));
        items.push({ row: r, no: String.fromCharCode(65 + g++), children: kids });
      } else items.push({ row: r, no: String(++n), children: [] });
    });
    const questions = items.flatMap((i) => (i.row.group ? i.children.map((c) => c.row) : [i.row]));
    const points = questions.reduce((s, r) => s + Number(r.q.points || 0), 0);
    const byLevel = DIFFICULTY_ORDER.map((d) => [d, questions.filter((r) => (r.q.difficulty || 'MEDIUM') === d).length] as const).filter(([, c]) => c > 0);
    return { items, count: questions.length, points, byLevel };
  }, [rows, ids, effective]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows.length) return <EmptyState icon={AlertTriangle} title="Bộ đề chưa có câu hỏi" desc="Thêm câu hỏi ở tab Câu hỏi rồi quay lại xem trước." />;

  const pointsOff = Math.abs(paper.points - maxScore) > 0.001;

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
      <Panel className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        {drawing ? (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'draw' as const, label: 'Một đề thí sinh nhận' },
              { value: 'all' as const, label: `Toàn bộ ${roots.length} mục` },
            ]}
          />
        ) : (
          <span className="text-[13px] text-muted-foreground">Mọi thí sinh nhận đủ các câu dưới đây.</span>
        )}
        <span className="hidden flex-1 sm:block" />
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <Switch checked={showKey} onChange={setShowKey} label="Hiện đáp án" />
          Hiện đáp án
        </label>
        {effective === 'draw' && (
          <FxButton icon={loading ? Loader2 : Shuffle} disabled={loading} onClick={() => deal(Math.floor(Math.random() * 1_000_000) + 1)}>
            Bốc đề khác
          </FxButton>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[13px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{paper.count}</span> câu
        </span>
        <span className={cn(pointsOff && 'text-warning-fg')}>
          <span className={cn('font-semibold', pointsOff ? 'text-warning-fg' : 'text-foreground')}>{fmt(paper.points)}</span> / {fmt(maxScore)} điểm
        </span>
        {paper.byLevel.map(([d, c]) => (
          <span key={d}>
            {DIFFICULTY[d].label} {c}
          </span>
        ))}
        {effective === 'draw' && seed !== null && <span className="ml-auto font-mono text-xs">Đề số {seed}</span>}
      </div>
      {pointsOff && (
        <div className="flex items-start gap-2 rounded-[10px] bg-warning/10 px-3 py-2 text-[13px] text-warning-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {effective === 'draw'
            ? `Đề này cộng lại ${fmt(paper.points)} điểm, khác điểm tối đa ${fmt(maxScore)}. Các đề bốc ngẫu nhiên có thể lệch điểm nhau; nên để mọi câu cùng điểm khi bốc ngẫu nhiên.`
            : `Tổng điểm các câu là ${fmt(paper.points)}, khác điểm tối đa ${fmt(maxScore)} ở tab Thông tin.`}
        </div>
      )}
      {error && <div className="rounded-[10px] bg-danger/10 px-3 py-2 text-[13px] text-danger-fg">{error}</div>}

      <Panel padded={false} className={cn('overflow-hidden', loading && 'opacity-60')}>
        {paper.items.map(({ row, no, children }) =>
          row.group ? (
            <section key={row.q.id} className="border-b border-border last:border-b-0">
              <ItemHead no={`Phần ${no}`} meta={`Câu ${children[0]?.no ?? '?'}${children.length > 1 ? `–${children[children.length - 1].no}` : ''}`} onEdit={() => onEdit(row.q.id)} />
              <div className="px-4 pb-4 sm:px-6">
                <QuestionPreview draft={draftOf(row.q)} showKey={showKey} />
              </div>
              {children.map((c) => (
                <div key={c.row.q.id} className="ml-4 border-t border-l-2 border-t-border border-l-primary/30 sm:ml-6">
                  <Question row={c.row} no={c.no} showKey={showKey} onEdit={onEdit} />
                </div>
              ))}
            </section>
          ) : (
            <div key={row.q.id} className="border-b border-border last:border-b-0">
              <Question row={row} no={no} showKey={showKey} onEdit={onEdit} />
            </div>
          ),
        )}
      </Panel>
      <p className="px-1 text-xs text-muted-foreground">Nếu kỳ thi bật xáo trộn, thứ tự câu và phương án của mỗi thí sinh sẽ khác bản này.</p>
    </div>
  );
}

function ItemHead({ no, meta, onEdit, children }: { no: string; meta?: React.ReactNode; onEdit: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2 sm:px-6">
      <span className="text-sm font-semibold">{no}</span>
      {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      {children}
      <span className="flex-1" />
      <IconButton icon={Pencil} label="Sửa câu này" onClick={onEdit} />
    </div>
  );
}

function Question({ row, no, showKey, onEdit }: { row: PaperRow; no: string; showKey: boolean; onEdit: (id: number) => void }) {
  const d = DIFFICULTY[row.q.difficulty || 'MEDIUM'];
  return (
    <>
      <ItemHead no={`Câu ${no}`} meta={`${fmt(Number(row.q.points || 0))} điểm`} onEdit={() => onEdit(row.q.id)}>
        {showKey && (
          <>
            <Pill tone={d?.tone ?? 'neutral'}>{d?.short ?? row.q.difficulty}</Pill>
            <span className="text-xs text-muted-foreground">{KINDS[kindOf(row.q)].label}</span>
            {row.q.skill && <span className="text-xs text-muted-foreground">· {row.q.skill}</span>}
          </>
        )}
      </ItemHead>
      <div className="px-4 pb-5 sm:px-6">
        <QuestionPreview draft={draftOf(row.q)} showKey={showKey} />
      </div>
    </>
  );
}
