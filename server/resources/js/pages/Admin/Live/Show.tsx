import React, { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Activity, Ban, LayoutGrid, List, Megaphone, Radio, Search, Square, TriangleAlert } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { Dot, EmptyState, FxButton, Modal, PageHeader, Panel, Pill, Segmented, type Tone } from '@/components/foxy/ui';
import { hhmm, hhmmss, severityOf, timeAgo, violationDetail, violationLabel } from '@/components/foxy/domain';
import { cn } from '@/lib/utils';
import { useLiveRoom, type LiveRow } from '@/hooks/use-live-room';
import { useViolationFeed, type FeedRow } from '@/hooks/use-violation-feed';
import { useLiveVideo, type FeedSource } from '@/hooks/use-live-video';
import { LiveFeed } from '@/components/foxy/live-feed';
import { useDialog } from '@/components/foxy/dialogs';

interface LiveAttempt {
  id: number;
  name: string;
  username: string;
  attempt_number?: number;
  ended_reason?: string | null;
  voided?: boolean;
  status: string;
  is_flagged: boolean;
  risk_score: number;
  started_at: string | null;
  submitted_at: string | null;
  violations_count: number;
  pending_violations_count: number;
  ops_per_min: number | null;
  last_activity_at: string | null;
  progress: number[];
}

interface FeedItem {
  id: number;
  attempt_id: number;
  type: string;
  severity: string;
  details: unknown;
  student_name: string;
  timestamp: string | null;
}

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
    start_time: string | null;
    end_time: string | null;
    course: { code: string; name: string } | null;
    problems_count: number;
  };
  attempts: LiveAttempt[];
  feed: FeedItem[];
  serverTime: string;
}

type TileState = 'coding' | 'flagged' | 'away' | 'offline' | 'done';
const TILE: Record<TileState, { label: string; tone: Tone }> = {
  coding: { label: 'Đang làm', tone: 'success' },
  flagged: { label: 'Cảnh báo', tone: 'danger' },
  away: { label: 'Rời cửa sổ thi', tone: 'warning' },
  offline: { label: 'Mất kết nối', tone: 'neutral' },
  done: { label: 'Đã nộp', tone: 'info' },
};
const OFFLINE_AFTER_MS = 2 * 60 * 1000;

/**
 * Tile state. When the realtime hub is connected the status comes from what the client really reports
 * (heartbeat age, focus, fullscreen); otherwise it falls back to the polled database activity.
 */
function stateOf(a: LiveAttempt, now: number, hub: LiveRow | undefined, hubLive: boolean): TileState {
  if (a.status === 'SUBMITTED' || a.status === 'FORCE_ENDED') return 'done';
  if (hubLive) {
    if (!hub || hub.status === 'offline') return 'offline';
    if (hub.status === 'ended') return 'done';
    if (hub.status === 'away') return 'away';
    if (a.pending_violations_count > 0 || a.is_flagged) return 'flagged';
    return 'coding';
  }
  if (a.status === 'IN_PROGRESS' && a.last_activity_at && now - new Date(a.last_activity_at).getTime() > OFFLINE_AFTER_MS) return 'offline';
  if (a.pending_violations_count > 0 || a.is_flagged) return 'flagged';
  return 'coding';
}

function useCountdown(end: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!end) return { now, left: null as string | null };
  const s = Math.max(0, Math.floor((new Date(end).getTime() - now) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return { now, left: `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` };
}

export default function LiveShow({ user, teams, exam, attempts, feed: feedHead }: Props) {
  const violationFeed = useViolationFeed(exam.id, feedHead as FeedRow[]);
  const feed = violationFeed.rows as unknown as FeedItem[];
  const [filter, setFilter] = useState<'all' | 'viol' | 'offline' | 'done'>('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { now, left } = useCountdown(exam.end_time);
  const dialog = useDialog();
  const rt = useLiveRoom(exam.id);
  const hubLive = rt.state === 'live';
  const video = useLiveVideo(exam.id, rt.state !== 'disabled');
  const [source, setSource] = useState<FeedSource>('camera');

  const warn = async (a: LiveAttempt) => {
    const msg = await dialog.prompt({ title: `Nhắc nhở ${a.name}`, label: 'Nội dung hiển thị trên máy thí sinh', initial: 'Hãy quay lại màn hình làm bài.' });
    if (!msg) return;
    const ok = await rt.sendCommand(a.id, 'WARN', msg);
    if (ok) dialog.toast.success('Đã gửi cảnh báo');
    else dialog.toast.error('Không gửi được cảnh báo');
  };
  const suspend = async (a: LiveAttempt) => {
    const ok = await dialog.confirm({
      title: `Đình chỉ ${a.name}?`,
      text: 'Phiên thi kết thúc ngay và không thể tiếp tục.',
      tone: 'danger',
      confirmLabel: 'Đình chỉ',
    });
    if (ok) router.post(`/admin/attempts/${a.id}/force-end`, {}, { preserveScroll: true });
  };

  // Realtime: refresh tiles and the event feed every 10 s.
  useEffect(() => {
    const t = setInterval(() => router.reload({ only: ['attempts', 'feed', 'serverTime'] }), 10_000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => attempts.map((a) => ({ ...a, state: stateOf(a, now, rt.rows[a.id], hubLive), hub: rt.rows[a.id] })), [attempts, now, rt.rows, hubLive]);
  const count = (s: TileState) => rows.filter((r) => r.state === s).length;
  const withViol = rows.filter((r) => r.violations_count > 0).length;
  const pending = rows.reduce((n, r) => n + r.pending_violations_count, 0);
  const live = exam.status === 'IN_PROGRESS' || rows.some((r) => r.status === 'IN_PROGRESS');

  const visible = rows.filter((r) => {
    if (filter === 'viol' && r.violations_count === 0) return false;
    if (filter === 'offline' && r.state !== 'offline') return false;
    if (filter === 'done' && r.state !== 'done') return false;
    const s = q.trim().toLowerCase();
    return !s || r.name.toLowerCase().includes(s) || r.username.toLowerCase().includes(s);
  });

  const stats: { label: string; v: number; tone: Tone }[] = [
    { label: 'Đang làm', v: count('coding') + count('flagged'), tone: 'success' },
    { label: 'Rời cửa sổ', v: count('away'), tone: 'warning' },
    { label: 'Đã nộp', v: count('done'), tone: 'info' },
    { label: 'Mất kết nối', v: count('offline'), tone: 'neutral' },
    { label: 'Có vi phạm', v: withViol, tone: 'danger' },
    { label: 'Chờ duyệt', v: pending, tone: 'warning' },
  ];

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="live"
      title={exam.title}
      breadcrumbs={[{ label: 'Giám sát kỳ thi', href: '/admin/live' }, { label: exam.title }]}
    >
      <PageHeader
        title={exam.title}
        badges={
          live ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-success/50 px-2 py-0.5 text-xs font-medium text-success-fg">
              <Dot tone="success" pulse />
              Đang diễn ra
            </span>
          ) : (
            <Pill>Đã kết thúc</Pill>
          )
        }
        desc={
          <>
            Phòng <span className="font-mono text-foreground">{exam.code}</span>
            {exam.problems_count > 0 && ` · ${exam.problems_count} bài lập trình`}
            {exam.course && ` · ${exam.course.code}`}
            {exam.start_time && ` · ${hhmm(exam.start_time)} – ${hhmm(exam.end_time)}`}
          </>
        }
        actions={
          <>
            {left && live && (
              <div className="mr-2 flex flex-col items-end">
                <span className="text-xs text-muted-foreground">Còn lại</span>
                <span className="font-mono text-2xl font-semibold tracking-[0.02em]">{left}</span>
              </div>
            )}
            {live && (
              <FxButton variant="danger" icon={Square} onClick={() => setConfirmEnd(true)}>
                Kết thúc ca
              </FxButton>
            )}
          </>
        }
      />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 bg-card px-4 py-3.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Dot tone={s.tone} />
              {s.label}
            </span>
            <span className="text-[22px] font-bold tabular-nums">{s.v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `Tất cả ${rows.length}` },
                { value: 'viol', label: `Có vi phạm ${withViol}` },
                { value: 'offline', label: `Mất kết nối ${count('offline')}` },
                { value: 'done', label: `Đã nộp ${count('done')}` },
              ]}
            />
            <div className="flex-1" />
            <div className="flex h-[34px] w-[180px] items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px] focus-within:border-primary">
              <Search className="size-3.5 opacity-60" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên / MSSV" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
            </div>
            {video.ready && (
              <Segmented
                size="sm"
                value={source}
                onChange={setSource}
                options={[
                  { value: 'camera', label: 'Camera' },
                  { value: 'screen', label: 'Màn hình' },
                ]}
              />
            )}
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: <LayoutGrid className="size-3.5" /> },
                { value: 'list', label: <List className="size-3.5" /> },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <Panel>
              <EmptyState icon={Activity} title="Không có thí sinh phù hợp" />
            </Panel>
          ) : view === 'grid' ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
              {visible.map((s) => {
                const st = TILE[s.state];
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.visit(`/admin/attempts/${s.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && router.visit(`/admin/attempts/${s.id}`)}
                    className={cn(
                      'cursor-pointer overflow-hidden rounded-xl border bg-card text-left',
                      s.violations_count ? 'border-danger/55' : 'border-border',
                      s.state === 'offline' && 'opacity-70',
                    )}
                  >
                    <LiveFeed track={video.tracks[s.id]?.[source]} label={s.state === 'offline' ? 'no signal' : video.ready ? 'chưa có hình' : 'camera feed'}>
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-[5px] rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-[4px]">
                        <Dot tone={st.tone} />
                        {st.label}
                      </span>
                      {s.violations_count > 0 && (
                        <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[11px] font-bold text-white">
                          <TriangleAlert className="size-[11px]" />
                          {s.violations_count}
                        </span>
                      )}
                    </LiveFeed>
                    <div className="flex flex-col gap-1.5 px-3 py-2.5">
                      <div className="flex justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold">
                          {s.name}
                          {(s.attempt_number ?? 1) > 1 && <span className="ml-1.5 rounded bg-muted px-1 font-mono text-[10px] font-normal text-muted-foreground">lần {s.attempt_number}</span>}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{s.username}</span>
                      </div>
                      {s.progress.length > 0 && (
                        <div className="flex gap-[3px]">
                          {s.progress.map((p, i) => (
                            <span key={i} className={cn('h-1 flex-1 rounded-[2px]', p === 2 ? 'bg-success' : p === 1 ? 'bg-warning' : 'bg-foreground/15')} />
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                        <span>{s.state === 'done' ? 'đã nộp' : s.ops_per_min != null ? `${s.ops_per_min} op/m` : '— op/m'}</span>
                        <span>
                          {hubLive && s.hub
                            ? `${s.hub.latency_ms ?? '—'} ms${s.hub.attention != null ? ` · tập trung ${s.hub.attention}%` : ''}${s.hub.faces != null && s.hub.faces !== 1 ? ` · ${s.hub.faces} mặt` : ''}${s.hub.camera === false ? ' · mất cam' : ''}${s.hub.screen === false ? ' · mất màn hình' : ''}`
                            : s.last_activity_at
                              ? `sự kiện ${timeAgo(s.last_activity_at)}`
                              : ''}
                        </span>
                      </div>
                      {hubLive && s.state !== 'done' && (
                        <div className="flex gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <FxButton size="sm" icon={Megaphone} onClick={() => warn(s)}>
                            Nhắc
                          </FxButton>
                          <FxButton size="sm" icon={Ban} className="text-danger-fg" onClick={() => suspend(s)}>
                            Đình chỉ
                          </FxButton>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Panel padded={false} className="overflow-hidden">
              {visible.map((s) => {
                const st = TILE[s.state];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => router.visit(`/admin/attempts/${s.id}`)}
                    className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-surface"
                  >
                    <Dot tone={st.tone} />
                    <span className="flex-1 truncate text-[13px] font-medium">
                      {s.name}
                      <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">lần {s.attempt_number ?? 1}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{s.username}</span>
                    <Pill tone={st.tone} size="sm">
                      {st.label}
                    </Pill>
                    {s.violations_count > 0 && (
                      <Pill tone="danger" size="sm">
                        {s.violations_count} vi phạm
                      </Pill>
                    )}
                  </button>
                );
              })}
            </Panel>
          )}
        </div>

        <Panel padded={false} className="sticky top-20 max-w-full flex-[1_1_300px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-surface/50 px-4 py-3">
            <span className="flex items-center gap-2 font-semibold">
              <Activity className="size-4" />
              Luồng sự kiện
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {hubLive ? (
                <>
                  <Radio className="size-3 text-success-fg" /> Realtime
                </>
              ) : rt.state === 'disabled' ? (
                'Tự cập nhật 10s'
              ) : (
                'Đang kết nối realtime…'
              )}
            </span>
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            {feed.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">Chưa có sự kiện vi phạm.</div>}
            {feed.map((f) => {
              const sev = severityOf(f.severity);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => router.visit(`/admin/attempts/${f.attempt_id}?violation=${f.id}`)}
                  className="flex w-full cursor-pointer gap-2.5 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-surface"
                >
                  <span className="w-[52px] shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{hhmmss(f.timestamp)}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Pill tone={sev.tone} size="sm" mono>
                      {f.type}
                    </Pill>
                    <span className="text-[13px]">
                      {violationLabel(f.type)}
                      {violationDetail(f.details) && <span className="text-muted-foreground"> · {violationDetail(f.details)}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{f.student_name}</span>
                  </div>
                </button>
              );
            })}
            {violationFeed.hasMore && (
              <div ref={violationFeed.sentinel} className="py-3 text-center text-xs text-muted-foreground">
                Đang tải thêm…
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        width={460}
        title="Kết thúc ca thi?"
        desc="Phòng thi đóng ngay. Thí sinh đang làm bài sẽ bị dừng và ghi nhận trạng thái Bị đình chỉ."
        footer={
          <>
            <FxButton onClick={() => setConfirmEnd(false)}>Hủy</FxButton>
            <FxButton
              variant="danger"
              icon={Square}
              onClick={() => router.post(`/admin/exams/${exam.id}/end`, {}, { onFinish: () => setConfirmEnd(false) })}
            >
              Kết thúc ca
            </FxButton>
          </>
        }
      >
        <div className="text-sm text-muted-foreground">
          {count('coding') + count('flagged') + count('offline')} thí sinh vẫn đang trong phòng.
        </div>
      </Modal>
    </AdminLayout>
  );
}
