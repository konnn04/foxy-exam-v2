import React, { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Ban, CircleCheck, Code, ExternalLink, Monitor, RotateCcw, ShieldAlert, ShieldCheck, Undo2, Video } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FeedPlaceholder, FxButton, PageHeader, Panel, Pill } from '@/components/foxy/ui';
import {
  ATTEMPT_STATUS,
  clockOffset,
  hhmm,
  initials,
  reviewStatus,
  severityOf,
  TONE_VAR,
  violationDetail,
  violationLabel,
} from '@/components/foxy/domain';
import { useDialog } from '@/components/foxy/dialogs';
import { cn } from '@/lib/utils';

export interface AttemptPayload {
  id: number;
  attempt_number: number;
  status: string;
  score: number | null;
  risk_score: number;
  is_flagged: boolean;
  voided_at: string | null;
  void_reason: string | null;
  started_at: string | null;
  submitted_at: string | null;
  device_info: Record<string, unknown> | null;
  user: { name: string; username: string; email?: string | null };
  exam: { id: number; title: string; code: string; type: string; duration_minutes: number };
}

interface ViolationRow {
  id: number;
  type: string;
  severity: string;
  details: unknown;
  evidence_url: string | null;
  is_reviewed: boolean;
  is_false_positive: boolean;
  timestamp: string | null;
}

interface Props {
  user: any;
  teams: TeamItem[];
  attempt: AttemptPayload;
  violations: ViolationRow[];
  typing: { t: string | null; keys: number; pastes: number }[];
  submissions: { id: number; status: string; t: string | null }[];
}

const BINS = 72;

interface Group {
  key: number;
  head: ViolationRow;
  rows: ViolationRow[];
  last: ViolationRow;
}

/** Consecutive violations of one type collapse into a single entry until a different type shows up. */
function groupViolations(list: ViolationRow[]): Group[] {
  const out: Group[] = [];
  for (const v of list) {
    const g = out.at(-1);
    if (g && g.head.type === v.type) {
      g.rows.push(v);
      g.last = v;
    } else {
      out.push({ key: v.id, head: v, rows: [v], last: v });
    }
  }
  return out;
}

export function deviceLabel(d: Record<string, unknown> | null) {
  if (!d) return '';
  const app = d.client_version || d.app_version || d.version;
  const os = d.os || d.platform;
  return [app && `FoxyClient ${app}`, os && `(${os})`].filter(Boolean).join(' ');
}

export default function AttemptShow({ user, teams, attempt, violations, typing, submissions }: Props) {
  const initialId = useMemo(() => {
    const q = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('violation')) : 0;
    return violations.some((v) => v.id === q) ? q : violations.find((v) => !v.is_reviewed)?.id ?? violations[0]?.id ?? 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dialog = useDialog();
  const groups = useMemo(() => groupViolations(violations), [violations]);
  const [selId, setSelId] = useState(initialId);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const selGroup = groups.find((g) => g.rows.some((v) => v.id === selId)) ?? groups[0];
  const sel = selGroup?.head;
  const voided = attempt.voided_at !== null;

  const start = attempt.started_at ? new Date(attempt.started_at).getTime() : null;
  const endIso =
    attempt.submitted_at ??
    [typing.at(-1)?.t, violations.at(-1)?.timestamp, submissions.at(-1)?.t].filter(Boolean).sort().at(-1) ??
    new Date().toISOString();
  const end = new Date(endIso as string).getTime();
  const span = start ? Math.max(60_000, end - start) : 1;
  const pos = (iso: string | null) => (start && iso ? Math.min(100, Math.max(0, ((new Date(iso).getTime() - start) / span) * 100)) : 0);

  const bins = useMemo(() => {
    const b = Array.from({ length: BINS }, () => ({ keys: 0, pastes: 0 }));
    if (!start) return b;
    typing.forEach((l) => {
      if (!l.t) return;
      const i = Math.min(BINS - 1, Math.max(0, Math.floor(((new Date(l.t).getTime() - start) / span) * BINS)));
      b[i].keys += l.keys;
      b[i].pastes += l.pastes;
    });
    return b;
  }, [typing, start, span]);
  const maxKeys = Math.max(1, ...bins.map((b) => b.keys));

  const ticks = start ? Array.from({ length: 5 }, (_, i) => hhmm(new Date(start + (span * i) / 4).toISOString())) : [];
  const counts = { high: 0, medium: 0, low: 0 };
  violations.forEach((v) => {
    const s = severityOf(v.severity).tone;
    if (s === 'danger') counts.high++;
    else if (s === 'warning') counts.medium++;
    else counts.low++;
  });
  const pendingCount = violations.filter((v) => reviewStatus(v).key === 'pending').length;

  const decide = (decision: 'confirmed' | 'false_positive' | 'pending') => {
    if (!sel) return;
    setBusy(true);
    const idx = groups.indexOf(selGroup);
    review(
      selGroup.rows.map((v) => v.id),
      decision,
      () => decision !== 'pending' && groups[idx + 1] && setSelId(groups[idx + 1].head.id),
    );
  };

  const review = (ids: number[], decision: 'confirmed' | 'false_positive' | 'pending', after?: () => void) => {
    setBusy(true);
    router.post('/admin/violations/bulk-review', { ids, decision }, {
      preserveScroll: true,
      only: ['violations'],
      onSuccess: () => {
        setChecked(new Set());
        after?.();
      },
      onFinish: () => setBusy(false),
    });
  };

  const toggle = (g: Group) =>
    setChecked((prev) => {
      const next = new Set(prev);
      const all = g.rows.every((v) => next.has(v.id));
      g.rows.forEach((v) => (all ? next.delete(v.id) : next.add(v.id)));
      return next;
    });
  const allChecked = violations.length > 0 && checked.size === violations.length;

  const toggleVoid = async () => {
    const ok = await dialog.confirm({
      title: voided ? 'Khôi phục phiên thi?' : 'Hủy phiên thi này?',
      text: voided
        ? 'Phiên thi được tính lại vào điểm trung bình và số vi phạm.'
        : 'Phiên thi được giữ lại nhưng không tính vào điểm trung bình và bộ đếm vi phạm. Đang làm bài sẽ bị dừng.',
      tone: voided ? 'default' : 'danger',
      confirmLabel: voided ? 'Khôi phục' : 'Hủy phiên thi',
    });
    if (ok) router.post(`/admin/attempts/${attempt.id}/void`, { void: !voided }, { preserveScroll: true });
  };

  const st = ATTEMPT_STATUS[attempt.status] ?? { label: attempt.status, tone: 'neutral' as const };
  const isCode = attempt.exam.type !== 'QUIZ';
  const details = sel && sel.details && typeof sel.details === 'object' ? (sel.details as Record<string, unknown>) : null;
  const snippet = details ? String(details.content ?? details.snippet ?? details.pasted_text ?? '') : '';

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="live"
      title={attempt.user.name}
      breadcrumbs={[
        { label: 'Giám sát kỳ thi', href: `/admin/reports/${attempt.exam.id}` },
        { label: 'Phiên thi & vi phạm' },
      ]}
    >
      <PageHeader
        onBack={() => router.visit(`/admin/reports/${attempt.exam.id}`)}
        leading={<div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">{initials(attempt.user.name)}</div>}
        title={attempt.user.name}
        badges={
          <>
            <Pill tone={st.tone}>
              {attempt.status === 'SUBMITTED' && <CircleCheck className="size-3" />}
              {st.label}
            </Pill>
            {voided && <Pill tone="danger">Đã hủy</Pill>}
          </>
        }
        desc={
          <>
            <span className="font-mono">{attempt.user.username}</span> · {attempt.exam.title} · {hhmm(attempt.started_at)} →{' '}
            {attempt.submitted_at ? hhmm(attempt.submitted_at) : 'đang làm'}
            {deviceLabel(attempt.device_info) && ` · ${deviceLabel(attempt.device_info)}`}
          </>
        }
        actions={
          <>
            <FxButton variant={voided ? undefined : 'danger'} icon={voided ? Undo2 : Ban} onClick={toggleVoid}>
              {voided ? 'Khôi phục phiên' : 'Hủy phiên thi'}
            </FxButton>
            {isCode && (
              <FxButton variant="primary" icon={Code} onClick={() => router.visit(`/admin/attempts/${attempt.id}/submissions`)}>
                Xem bài làm
              </FxButton>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {[
              { label: 'Camera', icon: Video, text: 'clip camera' },
              { label: 'Màn hình', icon: Monitor, text: 'clip màn hình' },
            ].map((c) => (
              <div key={c.label} className="overflow-hidden rounded-[10px] border border-border">
                <FeedPlaceholder label={`${c.text} @ ${sel ? clockOffset(attempt.started_at, sel.timestamp) : '--:--:--'}`}>
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-2 py-[3px] text-xs font-semibold text-white">
                    <c.icon className="size-3" />
                    {c.label}
                  </span>
                  {sel?.evidence_url && (
                    <a
                      href={sel.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-[3px] text-xs text-white hover:underline"
                    >
                      Mở bằng chứng <ExternalLink className="size-3" />
                    </a>
                  )}
                </FeedPlaceholder>
              </div>
            ))}
          </div>

          <Panel className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[13px]">
                {sel ? clockOffset(attempt.started_at, sel.timestamp) : '--:--:--'}{' '}
                <span className="text-muted-foreground">/ {clockOffset(attempt.started_at, endIso as string)}</span>
              </span>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">Nhấn vào mốc để nhảy tới vi phạm</span>
            </div>
            <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              <span>Gõ phím</span>
              <div className="flex h-[22px] items-end gap-px">
                {bins.map((b, i) => (
                  <span
                    key={i}
                    title={`${b.keys} phím${b.pastes ? ` · ${b.pastes} lần dán` : ''}`}
                    className={cn('flex-1 rounded-[1px]', b.pastes ? 'bg-danger' : 'bg-primary/55')}
                    style={{ height: `${Math.max(b.keys ? 8 : 4, (b.keys / maxKeys) * 100)}%`, opacity: b.keys || b.pastes ? 1 : 0.35 }}
                  />
                ))}
              </div>
              <span>Vi phạm</span>
              <div className="relative h-[22px] rounded bg-surface">
                {groups.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    title={`${violationLabel(g.head.type)}${g.rows.length > 1 ? ` ×${g.rows.length}` : ''}`}
                    onClick={() => setSelId(g.head.id)}
                    className={cn('absolute top-[3px] h-4 w-2.5 cursor-pointer rounded-[3px] p-0', g.key === selGroup?.key && 'ring-2 ring-foreground')}
                    style={{ left: `calc(${pos(g.head.timestamp)}% - 5px)`, background: TONE_VAR[severityOf(g.head.severity).tone] }}
                  />
                ))}
                {sel && <span className="absolute -bottom-1 -top-1 w-0.5 rounded bg-foreground" style={{ left: `${pos(sel.timestamp)}%` }} />}
              </div>
              <span>Nộp bài</span>
              <div className="relative h-3.5">
                {submissions.map((s) => (
                  <span
                    key={s.id}
                    title={s.status}
                    className={cn('absolute top-0.5 size-2.5 rotate-45', s.status === 'ACCEPTED' ? 'bg-success' : 'bg-warning')}
                    style={{ left: `calc(${pos(s.t)}% - 5px)` }}
                  />
                ))}
              </div>
            </div>
            {ticks.length > 0 && (
              <div className="flex justify-between pl-[84px] font-mono text-[11px] text-muted-foreground/70">
                {ticks.map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>
            )}
          </Panel>

          {sel ? (
            <Panel padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
                <Pill tone={severityOf(sel.severity).tone} size="sm" className="font-semibold">
                  {severityOf(sel.severity).label}
                </Pill>
                <span className="flex-1 text-[15px] font-semibold">
                  {violationLabel(sel.type)}
                  {selGroup.rows.length > 1 && (
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                      ×{selGroup.rows.length} · {clockOffset(attempt.started_at, sel.timestamp)} → {clockOffset(attempt.started_at, selGroup.last.timestamp)}
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{sel.type}</span>
              </div>
              <div className="flex flex-col gap-3.5 p-4">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
                  {[
                    ['Thời điểm', clockOffset(attempt.started_at, sel.timestamp)],
                    ['Mức độ', severityOf(sel.severity).long],
                    ...Object.entries(details ?? {})
                      .filter(([k, v]) => !['content', 'snippet', 'pasted_text'].includes(k) && (typeof v !== 'object' || v === null))
                      .slice(0, 4)
                      .map(([k, v]) => [k, String(v)]),
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="truncate font-mono text-sm font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                {!details && violationDetail(sel.details) && <div className="text-sm text-muted-foreground">{violationDetail(sel.details)}</div>}
                {snippet && (
                  <div>
                    <div className="mb-1.5 text-xs text-muted-foreground">Nội dung được dán</div>
                    <pre className="m-0 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/8 p-3 font-mono text-xs leading-relaxed">{String(snippet)}</pre>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={reviewStatus(sel).tone}>{reviewStatus(sel).label}</Pill>
                  <div className="flex-1" />
                  {reviewStatus(sel).key !== 'pending' && (
                    <FxButton icon={RotateCcw} disabled={busy} onClick={() => decide('pending')}>
                      Đặt lại
                    </FxButton>
                  )}
                  <FxButton icon={ShieldCheck} disabled={busy} onClick={() => decide('false_positive')}>
                    Đánh dấu nhầm
                  </FxButton>
                  <FxButton variant="danger" icon={ShieldAlert} disabled={busy} onClick={() => decide('confirmed')}>
                    Xác nhận vi phạm
                  </FxButton>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel>
              <EmptyState icon={ShieldCheck} title="Phiên thi sạch" desc="Không ghi nhận vi phạm nào trong lượt làm bài này." />
            </Panel>
          )}
        </div>

        <Panel padded={false} className="sticky top-20 flex max-h-[calc(100vh-6rem)] min-w-0 flex-[1_1_320px] flex-col overflow-hidden">
          <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Vi phạm ({violations.length}
                {groups.length !== violations.length ? ` · ${groups.length} nhóm` : ''})
              </span>
              <span className="text-xs text-muted-foreground">{pendingCount} chờ duyệt</span>
            </div>
            <div className="flex gap-1.5">
              {[
                { n: counts.high, label: 'Cao', cls: 'bg-danger/12 text-danger-fg' },
                { n: counts.medium, label: 'Trung bình', cls: 'bg-warning/12 text-warning-fg' },
                { n: counts.low, label: 'Thấp', cls: 'bg-info/12 text-info-fg' },
              ].map((c) => (
                <span key={c.label} className={cn('flex-1 rounded-lg p-2 text-center', c.cls)}>
                  <div className="text-lg font-bold">{c.n}</div>
                  <div className="text-[11px] text-muted-foreground">{c.label}</div>
                </span>
              ))}
            </div>
            {violations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(violations.map((v) => v.id)))}
                    className="size-3.5 accent-[var(--primary)]"
                  />
                  {checked.size > 0 ? `Đã chọn ${checked.size}` : 'Chọn tất cả'}
                </label>
                <div className="flex-1" />
                <FxButton icon={ShieldCheck} disabled={busy || checked.size === 0} onClick={() => review([...checked], 'false_positive')}>
                  Nhầm
                </FxButton>
                <FxButton variant="danger" icon={ShieldAlert} disabled={busy || checked.size === 0} onClick={() => review([...checked], 'confirmed')}>
                  Xác nhận
                </FxButton>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {groups.map((g) => {
              const v = g.head;
              const sev = severityOf(v.severity);
              const reviewed = g.rows.every((x) => x.is_reviewed);
              const rs = reviewStatus({ ...v, is_reviewed: reviewed, is_false_positive: reviewed && g.rows.every((x) => x.is_false_positive) });
              const on = g.key === selGroup?.key;
              const all = g.rows.every((x) => checked.has(x.id));
              return (
                <div key={g.key} className={cn('flex border-b border-border last:border-b-0', on ? 'bg-muted/60 shadow-[inset_2px_0_0_var(--primary)]' : 'hover:bg-surface')}>
                  <label className="flex shrink-0 cursor-pointer items-start py-3.5 pl-4">
                    <input type="checkbox" checked={all} onChange={() => toggle(g)} className="size-3.5 accent-[var(--primary)]" />
                  </label>
                  <button type="button" onClick={() => setSelId(v.id)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 px-3 py-3 text-left">
                    <div className="flex items-center gap-2">
                      <Pill tone={sev.tone} size="sm" className="font-semibold">
                        {sev.label}
                      </Pill>
                      <span className="flex-1 truncate text-[13px] font-medium">
                        {violationLabel(v.type)}
                        {g.rows.length > 1 && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">×{g.rows.length}</span>}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {clockOffset(attempt.started_at, v.timestamp)}
                        {g.rows.length > 1 && `–${clockOffset(attempt.started_at, g.last.timestamp).slice(3)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-0.5">
                      <span className="flex-1 truncate text-xs text-muted-foreground">{violationDetail(v.details) || v.type}</span>
                      <Pill tone={rs.tone} size="sm">
                        {rs.label}
                      </Pill>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </AdminLayout>
  );
}
