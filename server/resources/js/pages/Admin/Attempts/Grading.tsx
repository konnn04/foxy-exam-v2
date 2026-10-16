import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { ClipboardCheck, Save } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FxButton, PageHeader, Panel, Pill } from '@/components/foxy/ui';
import { MarkdownPreview } from '@/components/foxy/markdown';

interface Answer {
  id: number;
  type: 'ESSAY' | 'SHORT_ANSWER' | 'MULTIPLE_FILL_IN_BLANK';
  question: string;
  points: number;
  answer: string | null;
  reference: string | null;
  blanks: unknown;
  score: number | null;
  graded: boolean;
  pending: boolean;
  feedback: string | null;
}

interface Props {
  user: any;
  teams: TeamItem[];
  attempt: { id: number; status: string; score: number | null; student: string | null; username: string | null; exam: { id: number; title: string } };
  answers: Answer[];
}

const TYPE: Record<Answer['type'], string> = { ESSAY: 'Tự luận', SHORT_ANSWER: 'Trả lời ngắn', MULTIPLE_FILL_IN_BLANK: 'Điền chỗ trống' };

/** Manual grading: the answers the system left pending, with the key where there is one, a score and a comment. */
export default function Grading({ user, teams, attempt, answers }: Props) {
  const [scores, setScores] = useState<Record<number, string>>(() => Object.fromEntries(answers.map((a) => [a.id, a.score !== null && !a.pending ? String(a.score) : ''])));
  const [notes, setNotes] = useState<Record<number, string>>(() => Object.fromEntries(answers.map((a) => [a.id, a.feedback ?? ''])));
  const [busy, setBusy] = useState(false);

  const filled = answers.filter((a) => scores[a.id] !== '');
  const save = () => {
    setBusy(true);
    router.post(
      `/admin/attempts/${attempt.id}/grading`,
      { grades: filled.map((a) => ({ id: a.id, score: Number(scores[a.id]), feedback: notes[a.id] || null })) },
      { preserveScroll: true, onFinish: () => setBusy(false) },
    );
  };

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="live"
      title="Chấm bài"
      breadcrumbs={[{ label: 'Giám sát kỳ thi', href: `/admin/reports/${attempt.exam.id}` }, { label: attempt.student ?? 'Thí sinh', href: `/admin/attempts/${attempt.id}` }, { label: 'Chấm bài' }]}
    >
      <PageHeader
        onBack={() => router.visit(`/admin/attempts/${attempt.id}`)}
        title={`Chấm bài · ${attempt.student ?? ''}`}
        desc={
          <>
            {attempt.exam.title} · tổng điểm hiện tại <span className="font-mono text-foreground">{attempt.score ?? 0}</span> · {answers.filter((a) => a.pending).length} câu chờ chấm
          </>
        }
        actions={
          <FxButton variant="primary" icon={Save} disabled={busy || filled.length === 0} onClick={save}>
            Lưu điểm ({filled.length})
          </FxButton>
        }
      />
      {answers.length === 0 ? (
        <Panel>
          <EmptyState icon={ClipboardCheck} title="Không có câu nào cần chấm tay" desc="Bài này chỉ gồm câu hệ thống tự chấm." />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {answers.map((a, i) => (
            <Panel key={a.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">Câu {i + 1}</span>
                <Pill size="sm">{TYPE[a.type]}</Pill>
                <Pill size="sm" tone={a.pending ? 'warning' : 'success'}>
                  {a.pending ? 'Chờ chấm' : 'Đã chấm'}
                </Pill>
                <span className="ml-auto font-mono text-xs text-muted-foreground">tối đa {a.points} điểm</span>
              </div>
              <div className="text-sm">
                <MarkdownPreview source={a.question} />
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-1 text-xs text-muted-foreground">Bài làm</div>
                <div className="whitespace-pre-wrap break-words text-[13px]">{a.answer?.trim() ? a.answer : <span className="text-muted-foreground">(để trống)</span>}</div>
              </div>
              {(a.reference || !!a.blanks) && (
                <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                  <div className="mb-1">Đáp án tham khảo</div>
                  <div className="whitespace-pre-wrap break-words font-mono">{a.reference ?? JSON.stringify(a.blanks)}</div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={a.points}
                  step={0.25}
                  value={scores[a.id]}
                  onChange={(e) => setScores((s) => ({ ...s, [a.id]: e.target.value }))}
                  placeholder="Điểm"
                  className="h-9 w-24 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-primary"
                />
                {[0, a.points / 2, a.points].map((v) => (
                  <button key={v} type="button" onClick={() => setScores((s) => ({ ...s, [a.id]: String(v) }))} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">
                    {v}
                  </button>
                ))}
                <input
                  value={notes[a.id]}
                  maxLength={1000}
                  onChange={(e) => setNotes((s) => ({ ...s, [a.id]: e.target.value }))}
                  placeholder="Nhận xét cho sinh viên (không bắt buộc)"
                  className="h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
