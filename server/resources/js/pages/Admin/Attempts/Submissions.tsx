import React, { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { ClipboardPaste, FileCode, FileX } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, Panel, PageHeader, Pill, Switch } from '@/components/foxy/ui';
import { clockOffset, hhmm, hhmmss, VERDICT, violationDetail } from '@/components/foxy/domain';
import type { AttemptPayload } from './Show';
import { highlight } from '@/lib/highlight';
import { cn } from '@/lib/utils';

interface Problem {
  id: number;
  code: string;
  title: string;
  difficulty: string;
  time_limit_ms: number;
  memory_limit_mb: number;
}

interface SubmissionRow {
  id: number;
  problem_id: number;
  language: string;
  source_code: string;
  passed: number;
  total: number;
  score: number;
  status: string;
  grading_details: unknown;
  submitted_at: string | null;
}

interface Props {
  user: any;
  teams: TeamItem[];
  attempt: AttemptPayload;
  problems: Problem[];
  submissions: SubmissionRow[];
  opStats: Record<string, { keys: number; pastes: number; first_at: string | null; last_at: string | null }>;
  pasteViolations: { id: number; details: unknown; timestamp: string | null }[];
}

const LANG: Record<string, string> = { cpp: 'C++17', c: 'C', python: 'Python 3', py: 'Python 3', java: 'Java', js: 'JavaScript', javascript: 'JavaScript' };
const FILE: Record<string, string> = { cpp: 'main.cpp', c: 'main.c', python: 'solve.py', py: 'solve.py', java: 'Main.java', js: 'main.js', javascript: 'main.js' };

/** Verdict for a submission: PA when partially passing a WA run. */
function verdictOf(s: SubmissionRow) {
  if (s.status === 'WRONG_ANSWER' && s.passed > 0 && s.passed < s.total) return VERDICT.PARTIAL;
  return VERDICT[s.status] ?? { label: s.status, tone: 'neutral' as const };
}

/** grading_details may be an array of per-test results, or { tests: [...] }. */
function testsOf(details: unknown): { status: string; time?: string; mem?: string }[] {
  const arr = Array.isArray(details) ? details : details && typeof details === 'object' && Array.isArray((details as any).tests) ? (details as any).tests : [];
  return arr.map((t: any) => ({
    status: String(t.status ?? t.verdict ?? 'PENDING').toUpperCase(),
    time: t.time_ms != null ? `${t.time_ms}ms` : t.time != null ? String(t.time) : undefined,
    mem: t.memory_kb != null ? `${(t.memory_kb / 1024).toFixed(1)}MB` : t.memory != null ? String(t.memory) : undefined,
  }));
}
const SHORT: Record<string, string> = { AC: 'ACCEPTED', WA: 'WRONG_ANSWER', TLE: 'TIME_LIMIT_EXCEEDED', RE: 'RUNTIME_ERROR' };

const dur = (a: string | null, b: string | null) => {
  if (!a || !b) return '—';
  const s = Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

export default function AttemptSubmissions({ user, teams, attempt, problems, submissions, opStats, pasteViolations }: Props) {
  const best = useMemo(() => {
    const m = new Map<number, SubmissionRow>();
    submissions.forEach((s) => {
      const cur = m.get(s.problem_id);
      if (!cur || s.score > cur.score) m.set(s.problem_id, s);
    });
    return m;
  }, [submissions]);

  const [probId, setProbId] = useState<number>(() => problems.find((p) => best.has(p.id))?.id ?? problems[0]?.id ?? 0);
  const history = submissions.filter((s) => s.problem_id === probId);
  const [subId, setSubId] = useState<number | null>(null);
  const sub = history.find((s) => s.id === subId) ?? history[0];
  const [hl, setHl] = useState(true);

  const total = attempt.score ?? [...best.values()].reduce((n, s) => n + s.score, 0);
  const last = submissions[0]?.submitted_at ?? attempt.submitted_at;
  const lines = (sub?.source_code ?? '').split('\n');
  const op = opStats[String(probId)];
  const tests = sub ? testsOf(sub.grading_details) : [];
  const prob = problems.find((p) => p.id === probId);
  const pastes = pasteViolations.filter((v) => {
    const d = v.details as Record<string, unknown> | null;
    return !d?.problem_id || Number(d.problem_id) === probId;
  });

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="live"
      title="Bài làm & chấm điểm"
      breadcrumbs={[
        { label: 'Phiên thi & vi phạm', href: `/admin/attempts/${attempt.id}` },
        { label: 'Bài làm' },
      ]}
    >
      <PageHeader
        onBack={() => router.visit(`/admin/attempts/${attempt.id}`)}
        title={`Bài làm · ${attempt.user.name}`}
        desc={`${attempt.exam.title}${last ? ` · nộp lần cuối ${hhmm(last)}` : ''}`}
        actions={
          <div className="mr-2 flex items-baseline gap-1">
            <span className="text-[28px] font-bold">{Number(total.toFixed(2))}</span>
            <span className="text-muted-foreground">điểm</span>
          </div>
        }
      />

      {problems.length === 0 ? (
        <Panel>
          <EmptyState icon={FileX} title="Kỳ thi không có bài lập trình" desc="Màn này dành cho kỳ thi lập trình có bộ bài toán." />
        </Panel>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-4">
            <Panel padded={false} className="flex flex-col gap-0.5 p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Bài trong đề</div>
              {problems.map((p) => {
                const b = best.get(p.id);
                const v = b ? verdictOf(b) : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProbId(p.id);
                      setSubId(null);
                    }}
                    className={cn('flex cursor-pointer items-center gap-2 rounded-lg p-2 text-left', p.id === probId ? 'bg-muted' : 'hover:bg-surface')}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                    <span className="flex-1 truncate text-[13px] font-medium">{p.title}</span>
                    {v ? (
                      <Pill tone={v.tone} mono>
                        {Number(b!.score.toFixed(2))}
                      </Pill>
                    ) : (
                      <Pill tone="outline">—</Pill>
                    )}
                  </button>
                );
              })}
            </Panel>
            <Panel padded={false} className="flex flex-col gap-0.5 p-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Lịch sử nộp · {prob?.code}</div>
              {history.length === 0 && <div className="px-2 py-3 text-[13px] text-muted-foreground">Chưa nộp bài này.</div>}
              {history.map((s, i) => {
                const v = verdictOf(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubId(s.id)}
                    className={cn('flex cursor-pointer items-center gap-2 rounded-lg p-2 text-left', s.id === sub?.id ? 'bg-muted' : 'hover:bg-surface')}
                  >
                    <span className="font-mono text-xs text-muted-foreground">#{history.length - i}</span>
                    <span className="flex-1 font-mono text-xs">{hhmmss(s.submitted_at)}</span>
                    <Pill tone={v.tone} mono>
                      {v.label}
                    </Pill>
                    <span className="w-9 text-right text-xs text-muted-foreground">{Number(s.score.toFixed(2))}</span>
                  </button>
                );
              })}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-[3_1_460px] flex-col gap-4">
            <Panel padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border px-3 py-2">
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-mono text-[13px]">
                  <FileCode className="size-3.5 opacity-70" />
                  {FILE[sub?.language ?? ''] ?? 'source'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {LANG[sub?.language ?? ''] ?? sub?.language ?? '—'} · {sub ? lines.length : 0} dòng
                </span>
                <div className="flex-1" />
                <span className="text-[13px] text-foreground/85">Cảnh báo dán</span>
                <Switch checked={hl} onChange={setHl} label="Cảnh báo dán" />
              </div>
              {sub ? (
                <div className="flex max-h-[520px] overflow-auto bg-code py-2.5 font-mono text-[13px] leading-[1.7]">
                  <div className="select-none pr-3 text-right text-muted-foreground/60" style={{ minWidth: '2.75rem' }}>
                    {lines.map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <pre className="m-0 min-w-0 flex-1 whitespace-pre pl-2.5 text-foreground/90" dangerouslySetInnerHTML={{ __html: highlight(sub.source_code, sub.language) }} />
                </div>
              ) : (
                <EmptyState icon={FileCode} title="Chưa có mã nguồn" desc="Thí sinh chưa nộp bài này." />
              )}
              {hl && pastes.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-border bg-danger/8 px-3 py-2.5 text-xs text-danger-fg">
                  {pastes.map((v) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <ClipboardPaste className="size-3.5 opacity-80" />
                      <span>
                        BULK_PASTE · {violationDetail(v.details) || 'dán nội dung'} · {clockOffset(attempt.started_at, v.timestamp)} —{' '}
                        <button
                          type="button"
                          className="cursor-pointer text-brand-fg hover:underline"
                          onClick={() => router.visit(`/admin/attempts/${attempt.id}?violation=${v.id}`)}
                        >
                          xem bằng chứng
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="flex flex-col gap-3.5 p-4">
              <span className="font-semibold">Op-Log · {prob?.code}</span>
              <div className="grid gap-px overflow-hidden rounded-lg bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
                {[
                  { k: 'Phím gõ', v: (op?.keys ?? 0).toLocaleString('en'), warn: false },
                  { k: 'Lần dán', v: String(op?.pastes ?? 0), warn: (op?.pastes ?? 0) > 0 },
                  { k: 'Bắt đầu', v: op?.first_at ? clockOffset(attempt.started_at, op.first_at) : '—', warn: false },
                  { k: 'Thời gian gõ', v: dur(op?.first_at ?? null, op?.last_at ?? null), warn: false },
                ].map((o) => (
                  <div key={o.k} className="bg-card px-3 py-2.5">
                    <div className="text-xs text-muted-foreground">{o.k}</div>
                    <div className={cn('mt-0.5 text-lg font-bold', o.warn && 'text-danger-fg')}>{o.v}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
            <Panel padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-semibold">Kết quả testcase</span>
                <span className="text-[13px] text-muted-foreground">
                  {sub ? `${sub.passed} / ${sub.total} · ${Number(sub.score.toFixed(2))}đ` : '—'}
                </span>
              </div>
              {tests.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                  {sub?.status === 'PENDING' ? 'Đang chờ chấm…' : 'Chưa có chi tiết từng test.'}
                </div>
              ) : (
                tests.map((t, i) => {
                  const v = VERDICT[SHORT[t.status] ?? t.status] ?? { label: t.status, tone: 'neutral' as const };
                  return (
                    <div key={i} className="flex items-center gap-2.5 border-b border-border px-4 py-2 text-[13px] last:border-b-0">
                      <span className="w-7 font-mono text-muted-foreground">#{i + 1}</span>
                      <Pill tone={v.tone} mono>
                        {v.label}
                      </Pill>
                      <span className="flex-1" />
                      <span className="font-mono text-xs text-muted-foreground">{t.time ?? ''}</span>
                      <span className="w-[52px] text-right font-mono text-xs text-muted-foreground">{t.mem ?? ''}</span>
                    </div>
                  );
                })
              )}
            </Panel>
            {prob && (
              <Panel className="flex flex-col gap-1.5 border-dashed p-4 text-[13px]">
                <span className="font-medium">
                  {prob.code} · {prob.title}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {prob.time_limit_ms / 1000}s · {prob.memory_limit_mb}MB
                </span>
              </Panel>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
