import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { ScrollText, Search } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FxInput, FxSelect, PageHeader, Panel, Pill, type Tone } from '@/components/foxy/ui';
import { Pager, type Paginated } from '@/components/foxy/pager';
import { formatDateTime } from '@/lib/datetime';

interface Row {
  id: number;
  action: string;
  summary: string | null;
  user: string | null;
  target: string | null;
  ip: string | null;
  at: string;
}

const GROUPS: Record<string, { label: string; tone: Tone }> = {
  auth: { label: 'Đăng nhập', tone: 'info' },
  org: { label: 'Tổ chức', tone: 'violet' },
  user: { label: 'Tài khoản', tone: 'brand' },
  site: { label: 'Website', tone: 'neutral' },
  lead: { label: 'Khách hàng', tone: 'success' },
  face: { label: 'Khuôn mặt', tone: 'warning' },
  exam: { label: 'Kỳ thi', tone: 'danger' },
};

interface Props {
  user: any;
  teams: TeamItem[];
  rows: Paginated<Row>;
  filters: { group: string | null; q: string; from: string | null; to: string | null };
  scope: 'platform' | 'organization';
}

export default function AuditIndex({ user, teams, rows, filters, scope }: Props) {
  const [q, setQ] = useState(filters.q ?? '');

  const visit = (patch: Partial<{ group: string | null; q: string; from: string | null; to: string | null }>) => {
    const next = { group: filters.group, q, from: filters.from, to: filters.to, ...patch };
    const params = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Record<string, string>;
    router.get('/admin/audit-log', params, { preserveState: true, preserveScroll: true, replace: true });
  };

  useEffect(() => {
    if (q === (filters.q ?? '')) return;
    const id = window.setTimeout(() => visit({ q }), 350);
    return () => window.clearTimeout(id);
  }, [q]);

  return (
    <AdminLayout user={user} teams={teams} currentTab="audit" title="Nhật ký hoạt động" breadcrumbs={[{ label: scope === 'platform' ? 'Nền tảng' : 'Cấu hình' }, { label: 'Nhật ký hoạt động' }]}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Nhật ký hoạt động"
          desc={scope === 'platform' ? 'Mọi thao tác quan trọng của quản trị viên trên toàn hệ thống. Chỉ đọc.' : 'Thao tác quan trọng trong tổ chức của bạn. Chỉ đọc, không thể sửa hay xoá.'}
        />

        <div className="flex flex-wrap items-center gap-3">
          <FxSelect className="w-44" value={filters.group ?? ''} onChange={(e) => visit({ group: e.target.value || null })} aria-label="Nhóm hành động">
            <option value="">Tất cả hành động</option>
            {Object.entries(GROUPS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </FxSelect>
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <FxInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nội dung, người thực hiện, IP…" suffix={<Search className="size-3.5" />} />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Từ
            <FxInput type="date" className="w-40" value={filters.from ?? ''} onChange={(e) => visit({ from: e.target.value || null })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Đến
            <FxInput type="date" className="w-40" value={filters.to ?? ''} onChange={(e) => visit({ to: e.target.value || null })} />
          </label>
        </div>

        <Panel padded={false}>
          {rows.data.length === 0 ? (
            <EmptyState icon={ScrollText} title="Chưa có bản ghi nào" desc="Các thao tác như đăng nhập, tạo tài khoản, xoá khuôn mặt sẽ được ghi lại ở đây." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Thời gian</th>
                    <th className="px-3 py-3 font-medium">Người thực hiện</th>
                    <th className="px-3 py-3 font-medium">Hành động</th>
                    <th className="px-3 py-3 font-medium">Chi tiết</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.data.map((r) => {
                    const g = GROUPS[r.action.split('.')[0]];
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{formatDateTime(r.at)}</td>
                        <td className="px-3 py-3">{r.user ?? <span className="text-muted-foreground">Chưa đăng nhập</span>}</td>
                        <td className="px-3 py-3">
                          <Pill tone={g?.tone ?? 'neutral'} mono>
                            {r.action}
                          </Pill>
                        </td>
                        <td className="px-3 py-3">
                          {r.summary}
                          {r.target && <span className="ml-2 font-mono text-xs text-muted-foreground">{r.target}</span>}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">{r.ip}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Pager page={rows} />
      </div>
    </AdminLayout>
  );
}
