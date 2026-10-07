import * as React from 'react';
import { router, usePage } from '@inertiajs/react';
import {
  Building2,
  ClipboardList,
  Eye,
  FileCheck2,
  Gauge,
  GraduationCap,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { EmptyState, FxButton, Panel, PanelTitle, Pill, StatTile, TONE_DOT, type Tone } from './ui';
import { severityOf, timeAgo, TONE_VAR, VIOLATION_GROUP, violationLabel } from './domain';
import { cn } from '@/lib/utils';

export interface OverviewData {
  activity: { date: string; label: string; submissions: number; violations: number }[];
  violationTypes: Record<string, number>;
  liveExams: {
    id: number;
    title: string;
    code: string;
    course_code?: string | null;
    attempts_count: number;
    active_count: number;
    pending_violations_count: number;
    end_time?: string | null;
  }[];
  pendingViolations: {
    id: number;
    attempt_id: number;
    type: string;
    severity: string;
    student_name: string;
    student_username: string;
    timestamp?: string | null;
  }[];
  activeStudents: number;
  submissions7d: number;
  submissionsPrev7d: number;
  teachers: number;
  students: number;
  examsThisMonth: number;
}

const fmt = (n: number) => n.toLocaleString('en');

function pctDelta(cur: number, prev: number) {
  if (!prev) return cur ? '+100%' : '0%';
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
}

function remaining(end?: string | null) {
  if (!end) return '';
  const s = Math.floor((new Date(end).getTime() - Date.now()) / 1000);
  if (s <= 0) return 'hết giờ';
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `còn ${h ? `${h}:` : ''}${m}:${sec}`;
}

export function DashboardOverview({
  overview,
  quota,
  orgName,
  userName,
}: {
  overview: OverviewData;
  quota?: { plan_name: string; exams_used: number; exams_limit: number };
  orgName: string;
  userName: string;
}) {
  const { props } = usePage<{ navCounts?: { pendingViolations?: number } | null }>();
  const pending = props.navCounts?.pendingViolations ?? overview.pendingViolations.length;
  const highPending = overview.pendingViolations.filter((v) => ['HIGH', 'CRITICAL'].includes(v.severity)).length;

  const tiles = [
    { label: 'Giảng viên', value: fmt(overview.teachers), icon: UserCheck, tone: 'info' as Tone },
    { label: 'Sinh viên', value: fmt(overview.students), icon: GraduationCap, tone: 'success' as Tone },
    { label: 'Ca thi tháng này', value: fmt(overview.examsThisMonth), delta: `${overview.liveExams.length} đang diễn ra`, icon: ClipboardList, tone: 'brand' as Tone },
    quota && quota.exams_limit > 0
      ? { label: 'Quota kỳ thi', value: `${Math.round((quota.exams_used / quota.exams_limit) * 100)}%`, delta: `${fmt(quota.exams_used)} / ${fmt(quota.exams_limit)}`, icon: Gauge, tone: 'violet' as Tone, bar: (quota.exams_used / quota.exams_limit) * 100 }
      : { label: 'Vi phạm chờ duyệt', value: fmt(pending), delta: `${highPending} mức cao`, deltaTone: 'down' as const, icon: ShieldAlert, tone: 'danger' as Tone },
  ];

  const desc = `${orgName}${quota ? ` · gói ${quota.plan_name}` : ''} — xin chào ${userName}, ${overview.liveExams.length} ca thi đang diễn ra, ${pending} vi phạm cần duyệt.`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-xl font-semibold">Tổng quan</h1>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
        <ActivityBars activity={overview.activity} />
        <ViolationDonut types={overview.violationTypes} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
        <Panel className="flex flex-col gap-3">
          <PanelTitle
            title="Ca thi đang diễn ra"
            actions={
              <button type="button" className="cursor-pointer text-[13px] text-brand-fg hover:underline" onClick={() => router.visit('/admin/live')}>
                Xem tất cả
              </button>
            }
          />
          {overview.liveExams.length === 0 ? (
            <EmptyState icon={Eye} title="Không có ca thi nào đang mở" desc="Ca thi xuất hiện ở đây khi có thí sinh đang làm bài." />
          ) : (
            overview.liveExams.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-[10px] border border-border p-3">
                <span className="size-2 shrink-0 rounded-full bg-success" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {e.course_code || e.code} · {e.active_count}/{e.attempts_count} thí sinh
                  </div>
                </div>
                {e.end_time && <div className="text-right font-mono text-xs text-muted-foreground">{remaining(e.end_time)}</div>}
                {e.pending_violations_count > 0 && <Pill tone="danger">{e.pending_violations_count} vi phạm</Pill>}
                <FxButton variant="primary" size="sm" icon={Eye} onClick={() => router.visit(`/admin/exams/${e.id}/live`)}>
                  Giám sát
                </FxButton>
              </div>
            ))
          )}
        </Panel>

        <Panel className="flex flex-col gap-1">
          <PanelTitle
            className="mb-2"
            title="Vi phạm chờ duyệt"
            actions={
              <button type="button" className="cursor-pointer text-[13px] text-brand-fg hover:underline" onClick={() => router.visit('/admin/live')}>
                Duyệt ngay
              </button>
            }
          />
          {overview.pendingViolations.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="Không có vi phạm chờ duyệt" />
          ) : (
            overview.pendingViolations.map((v) => {
              const sev = severityOf(v.severity);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => router.visit(`/admin/attempts/${v.attempt_id}?violation=${v.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface"
                >
                  <Pill tone={sev.tone} size="sm" className="font-semibold">
                    {sev.label}
                  </Pill>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{violationLabel(v.type)}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.student_name}
                      {v.student_username && ` · ${v.student_username}`}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{timeAgo(v.timestamp)}</span>
                </button>
              );
            })
          )}
        </Panel>
      </div>
    </div>
  );
}

function ActivityBars({ activity }: { activity: OverviewData['activity'] }) {
  const max = Math.max(1, ...activity.map((a) => a.submissions + a.violations));
  return (
    <Panel className="flex flex-col gap-4">
      <PanelTitle
        title="Lượt nộp bài & vi phạm"
        desc="14 ngày gần nhất"
        actions={
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 whitespace-nowrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-primary" />
              Nộp bài
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-danger" />
              Vi phạm
            </span>
          </div>
        }
      />
      <div
        className="flex h-[220px] items-end gap-2 border-b border-border"
        style={{ backgroundImage: 'repeating-linear-gradient(to top, color-mix(in oklch, var(--border) 60%, transparent) 0 1px, transparent 1px 55px)' }}
      >
        {activity.map((a, i) => (
          <div
            key={a.date}
            title={`${a.date}: ${a.submissions} lượt nộp · ${a.violations} vi phạm`}
            className="flex h-full flex-1 flex-col justify-end gap-0.5"
          >
            <div
              className={cn('rounded-t', i === activity.length - 1 ? 'bg-primary' : 'bg-primary/45')}
              style={{ height: `${(a.submissions / max) * 85}%` }}
            />
            <div className="rounded-[2px] bg-danger" style={{ height: `${(a.violations / max) * 85}%` }} />
          </div>
        ))}
      </div>
      <div className="-mt-2 flex gap-2 font-mono text-[11px] text-muted-foreground">
        {activity.map((a) => (
          <span key={a.date} className="flex-1 text-center">
            {a.label}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function ViolationDonut({ types }: { types: Record<string, number> }) {
  const groups = new Map<string, { label: string; tone: Tone; n: number }>();
  let other = 0;
  for (const [type, n] of Object.entries(types)) {
    const g = VIOLATION_GROUP[type];
    if (!g) {
      other += n;
      continue;
    }
    const cur = groups.get(g.label) ?? { ...g, n: 0 };
    cur.n += n;
    groups.set(g.label, cur);
  }
  const rows = [...groups.values()].sort((a, b) => b.n - a.n);
  if (other) rows.push({ label: 'Khác', tone: 'neutral', n: other });
  const total = rows.reduce((s, r) => s + r.n, 0);

  let acc = 0;
  const stops = rows
    .map((r) => {
      const from = (acc / total) * 100;
      acc += r.n;
      return `${TONE_VAR[r.tone]} ${from}% ${(acc / total) * 100}%`;
    })
    .join(',');
  const top = rows[0];

  return (
    <Panel className="flex flex-col gap-4">
      <PanelTitle title="Vi phạm theo loại" desc={`${total} sự kiện · 7 ngày`} />
      {total === 0 ? (
        <EmptyState icon={ShieldAlert} title="Chưa có vi phạm trong 7 ngày" />
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <div
            className="flex size-[132px] shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${stops})` }}
          >
            <div className="flex size-[88px] flex-col items-center justify-center rounded-full bg-card">
              <span className="text-[22px] font-bold">{Math.round((top.n / total) * 100)}%</span>
              <span className="max-w-[72px] truncate text-[11px] text-muted-foreground">{top.label.split(' (')[0].toLowerCase()}</span>
            </div>
          </div>
          <div className="flex flex-[1_1_160px] flex-col gap-2.5 text-[13px]">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-[2px]', TONE_DOT[r.tone])} />
                <span className="flex-1 text-foreground/85">{r.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{r.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
