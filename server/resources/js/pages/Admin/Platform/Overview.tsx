import React from 'react';
import { Link } from '@inertiajs/react';
import { Activity, Building2, ClipboardList, Inbox, ShieldAlert, Users, Wallet, Gauge } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, PageHeader, Panel, PanelTitle, Pill, StatTile } from '@/components/foxy/ui';
import { formatDateTime } from '@/lib/datetime';

interface Props {
  user: any;
  teams: TeamItem[];
  stats: {
    organizations: number;
    users: number;
    exams: number;
    attemptsMonth: number;
    inProgress: number;
    violationsPending: number;
    leadsNew: number;
    subscriptions: number;
  };
  series: { date: string; count: number }[];
  topUsage: { org: string | null; code: string | null; attempts: number; exams: number }[];
  recentLeads: { id: number; name: string; organization: string | null; status: string; at: string }[];
}

const LEAD_TONE: Record<string, 'info' | 'warning' | 'success' | 'neutral' | 'danger'> = { NEW: 'info', CONTACTED: 'warning', QUALIFIED: 'success', CLOSED: 'neutral', SPAM: 'danger' };
const LEAD_LABEL: Record<string, string> = { NEW: 'Mới', CONTACTED: 'Đã liên hệ', QUALIFIED: 'Tiềm năng', CLOSED: 'Đã đóng', SPAM: 'Spam' };

/** Platform home: how many schools, how busy the exams are, what needs attention. */
export default function PlatformOverview({ user, teams, stats, series, topUsage, recentLeads }: Props) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const total14 = series.reduce((n, s) => n + s.count, 0);

  return (
    <AdminLayout user={user} teams={teams} currentTab="platform" title="Tổng quan nền tảng" breadcrumbs={[{ label: 'Nền tảng' }, { label: 'Tổng quan' }]}>
      <div className="flex flex-col gap-5">
        <PageHeader title="Tổng quan nền tảng" desc="Số liệu toàn hệ thống và những việc cần xử lý." />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Tổ chức khách hàng" value={stats.organizations} icon={Building2} />
          <StatTile label="Gói đang hoạt động" value={stats.subscriptions} icon={Wallet} tone="success" />
          <StatTile label="Tài khoản" value={stats.users.toLocaleString('vi-VN')} icon={Users} tone="info" />
          <StatTile label="Kỳ thi" value={stats.exams.toLocaleString('vi-VN')} icon={ClipboardList} tone="violet" />
          <StatTile label="Lượt thi tháng này" value={stats.attemptsMonth.toLocaleString('vi-VN')} icon={Gauge} />
          <StatTile label="Đang thi lúc này" value={stats.inProgress} icon={Activity} tone="success" />
          <StatTile label="Vi phạm chờ duyệt" value={stats.violationsPending} icon={ShieldAlert} tone={stats.violationsPending > 0 ? 'warning' : 'neutral'} />
          <StatTile label="Khách tiềm năng mới" value={stats.leadsNew} icon={Inbox} tone={stats.leadsNew > 0 ? 'info' : 'neutral'} />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Panel className="flex flex-col gap-4">
            <PanelTitle title="Lượt thi 14 ngày qua" desc={`${total14.toLocaleString('vi-VN')} lượt bắt đầu`} />
            <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Biểu đồ số lượt thi theo ngày">
              {series.map((s) => (
                <div key={s.date} className="group flex h-full flex-1 flex-col justify-end" title={`${s.date}: ${s.count}`}>
                  <div className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (s.count / max) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{series[0]?.date.slice(5).replace('-', '/')}</span>
              <span>{series[series.length - 1]?.date.slice(5).replace('-', '/')}</span>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <PanelTitle title="Dùng nhiều nhất tháng này" desc="Theo số lượt thi" />
            {topUsage.length === 0 ? (
              <EmptyState icon={Gauge} title="Chưa có dữ liệu" desc="Số liệu xuất hiện khi các tổ chức bắt đầu tổ chức kỳ thi." />
            ) : (
              <ul className="divide-y divide-border">
                {topUsage.map((u, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.org ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{u.exams} kỳ thi</div>
                    </div>
                    <span className="font-semibold tabular-nums">{u.attempts.toLocaleString('vi-VN')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel className="flex flex-col gap-3">
          <PanelTitle
            title="Yêu cầu thí điểm gần đây"
            actions={
              <Link href="/admin/leads" className="text-[13px] font-medium text-brand-fg hover:underline">
                Xem tất cả
              </Link>
            }
          />
          {recentLeads.length === 0 ? (
            <EmptyState icon={Inbox} title="Chưa có yêu cầu nào" desc="Phiếu đăng ký từ trang chủ sẽ hiện ở đây." />
          ) : (
            <ul className="divide-y divide-border">
              {recentLeads.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{l.organization || 'Chưa ghi đơn vị'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatDateTime(l.at)}</span>
                    <Pill tone={LEAD_TONE[l.status] ?? 'neutral'}>{LEAD_LABEL[l.status] ?? l.status}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminLayout>
  );
}
