import React from 'react';
import { router } from '@inertiajs/react';
import { Eye, Settings2, ShieldAlert, Users } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { FxButton, IconButton, PageHeader, Panel, Pill, type Tone } from '@/components/foxy/ui';
import { useLiveRoom } from '@/hooks/use-live-room';
import { FxList } from '@/components/foxy/fx-list';
import { ATTEMPT_STATUS, initials, reviewStatus, severityOf, violationDetail, violationLabel } from '@/components/foxy/domain';
import { EXAM_STATUS } from '@/components/foxy/exam-form';

interface Props {
  user: any;
  teams: TeamItem[];
  exam: {
    id: number;
    title: string;
    code: string;
    type: string;
    status: string;
    duration_minutes: number;
    course_name?: string;
    course_code?: string;
    organization_name?: string;
    attempts_count?: number;
    violations_count?: number;
  };
  attempts: {
    id: number;
    user_id: number;
    user_name: string;
    user_username: string;
    avatar?: string;
    attempt_number?: number;
    ended_reason?: string | null;
    voided?: boolean;
    status: string;
    score?: number;
    started_at?: string;
    submitted_at?: string;
    violations_count: number;
  }[];
  violations: {
    id: number;
    attempt_id: number;
    student_name: string;
    student_username: string;
    type: string;
    severity: string;
    details?: unknown;
    timestamp: string;
    is_reviewed: boolean;
    is_false_positive?: boolean;
  }[];
}

/** Báo cáo kỳ thi: điểm, lượt làm bài và vi phạm của toàn phòng. */
const HUB_STATUS: Record<string, { label: string; tone: Tone }> = {
  online: { label: 'Đang làm', tone: 'success' },
  away: { label: 'Rời cửa sổ', tone: 'warning' },
  offline: { label: 'Mất kết nối', tone: 'neutral' },
  paused: { label: 'Tạm dừng', tone: 'info' },
  ended: { label: 'Đã kết thúc', tone: 'info' },
};

export default function ExamReportShow({ user, teams, exam, attempts = [], violations = [] }: Props) {
  // the session list shows what the clients really report, not the stored status (falls back when realtime is off)
  const rt = useLiveRoom(exam.id, exam.status === 'IN_PROGRESS' || attempts.some((a) => a.status === 'IN_PROGRESS'));
  const isCode = exam.type !== 'QUIZ';
  const st = EXAM_STATUS[exam.status] ?? { label: exam.status, tone: 'neutral' as const };
  const submitted = attempts.filter((a) => !a.voided && a.status === 'SUBMITTED' || a.status === 'FORCE_ENDED');
  const scores = submitted.map((a) => Number(a.score ?? 0));
  const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  const pending = violations.filter((v) => reviewStatus(v).key === 'pending').length;

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="live"
      title={`Báo cáo · ${exam.title}`}
      breadcrumbs={[{ label: 'Giám sát kỳ thi', href: '/admin/live' }, { label: exam.title }]}
    >
      <PageHeader
        onBack={() => router.visit('/admin/live')}
        title={exam.title}
        badges={
          <>
            <Pill tone={isCode ? 'brand' : 'info'}>{isCode ? 'Lập trình' : 'Phổ thông'}</Pill>
            <Pill tone={st.tone}>{st.label}</Pill>
          </>
        }
        desc={
          <>
            Phòng <span className="font-mono text-foreground">{exam.code}</span>
            {exam.course_code && ` · ${exam.course_code}`}
            {exam.organization_name && ` · ${exam.organization_name}`} · {exam.duration_minutes} phút
          </>
        }
        actions={
          <>
            <FxButton icon={Settings2} onClick={() => router.visit(`/admin/exams/${exam.id}`)}>
              Chi tiết kỳ thi
            </FxButton>
            <FxButton variant="primary" icon={Eye} onClick={() => router.visit(`/admin/exams/${exam.id}/live`)}>
              Giám sát trực tiếp
            </FxButton>
          </>
        }
      />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        {[
          ['Lượt làm bài', attempts.length],
          ['Đã nộp', submitted.length],
          ['Điểm trung bình', avg.toFixed(2)],
          ['Điểm cao nhất', scores.length ? Math.max(...scores) : '—'],
          ['Vi phạm', violations.length],
          ['Chờ duyệt', pending],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex flex-col gap-1 bg-card px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="text-[22px] font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      <FxList
        rows={attempts}
        searchText={(a) => `${a.user_name} ${a.user_username}`}
        searchPlaceholder="Tìm thí sinh / MSSV…"
        filters={[
          {
            key: 'st',
            label: 'Trạng thái',
            options: Object.entries(ATTEMPT_STATUS).map(([value, s]) => ({ value, label: s.label })),
            test: (a, v) => a.status === v,
          },
        ]}
        onRowClick={(a) => router.visit(`/admin/attempts/${a.id}`)}
        empty={{ icon: Users, title: 'Chưa có thí sinh làm bài' }}
        columns={[
          {
            key: 'name',
            label: 'Thí sinh',
            width: 'minmax(220px,2fr)',
            render: (a) => (
              <div className="flex min-w-0 items-center gap-2.5">
                {a.avatar ? (
                  <img src={a.avatar} alt="" className="size-8 rounded-full bg-muted object-cover" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(a.user_name)}</span>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.user_name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{a.user_username}</div>
                </div>
              </div>
            ),
          },
          { key: 'no', label: 'Lần', width: '56px', render: (a) => <span className="font-mono text-xs">#{a.attempt_number ?? 1}</span> },
          { key: 'start', label: 'Bắt đầu', width: '150px', render: (a) => <span className="font-mono text-xs text-muted-foreground">{a.started_at ?? '—'}</span> },
          { key: 'sub', label: 'Nộp bài', width: '150px', render: (a) => <span className="font-mono text-xs text-muted-foreground">{a.submitted_at ?? '—'}</span> },
          {
            key: 'st',
            label: 'Trạng thái',
            width: '120px',
            render: (a) => {
              if (a.status === 'IN_PROGRESS' && rt.state === 'live') {
                const h = rt.rows[a.id];
                const hs = HUB_STATUS[h?.status ?? 'offline'];
                return <Pill tone={hs.tone}>{hs.label}</Pill>;
              }
              if (a.voided) return <Pill tone="danger">Đã hủy</Pill>;
              if (a.status === 'SUBMITTED' && a.ended_reason === 'ABSENT') return <Pill tone="warning">Vắng thi</Pill>;
              const s = ATTEMPT_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const };
              return <Pill tone={s.tone}>{s.label}</Pill>;
            },
          },
          {
            key: 'viol',
            label: 'Vi phạm',
            width: '80px',
            render: (a) => (a.violations_count ? <Pill tone="danger">{a.violations_count}</Pill> : <span className="text-muted-foreground">0</span>),
          },
          { key: 'score', label: 'Điểm', width: '70px', align: 'right', render: (a) => <span className="font-semibold tabular-nums">{a.score ?? '—'}</span> },
        ]}
        actions={(a) => (
          <>
            <IconButton icon={ShieldAlert} label="Phiên thi & vi phạm" onClick={() => router.visit(`/admin/attempts/${a.id}`)} />
            {isCode && <IconButton icon={Eye} label="Xem bài làm" onClick={() => router.visit(`/admin/attempts/${a.id}/submissions`)} />}
          </>
        )}
      />

      <Panel padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-semibold">Vi phạm trong kỳ thi</span>
          <span className="text-xs text-muted-foreground">{pending} chờ duyệt</span>
        </div>
        {violations.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">Chưa ghi nhận vi phạm nào.</div>}
        {violations.map((v) => {
          const sev = severityOf(v.severity);
          const rs = reviewStatus(v);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => router.visit(`/admin/attempts/${v.attempt_id}?violation=${v.id}`)}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-surface"
            >
              <span className="w-[68px] shrink-0 font-mono text-[11px] text-muted-foreground">{new Date(v.timestamp).toLocaleTimeString('vi-VN')}</span>
              <Pill tone={sev.tone} size="sm">
                {sev.label}
              </Pill>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{violationLabel(v.type)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {v.student_name}
                  {violationDetail(v.details) && ` · ${violationDetail(v.details)}`}
                </div>
              </div>
              <Pill tone={rs.tone}>{rs.label}</Pill>
            </button>
          );
        })}
      </Panel>
    </AdminLayout>
  );
}
