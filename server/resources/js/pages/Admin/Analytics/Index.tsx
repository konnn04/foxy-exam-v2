import React from 'react';
import { router } from '@inertiajs/react';
import { BarChart3, Download, ShieldAlert, Users, ClipboardList, OctagonX } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FxButton, FxSelect, PageHeader, Panel, PanelTitle, StatTile } from '@/components/foxy/ui';

interface Group {
  name: string;
  exams: number;
  attempts: number;
  avg_score: number | null;
  violations: number;
  violations_per_attempt: number;
  force_ended: number;
  flagged_rate: number;
}
interface Props {
  user: any;
  teams: TeamItem[];
  filters: { semester: string; department: string };
  options: { semesters: string[]; departments: string[] };
  totals: { exams: number; attempts: number; violations: number; force_ended: number; false_positives: number; violations_per_attempt: number };
  byDepartment: Group[];
  bySemester: Group[];
  byType: { type: string; n: number }[];
  topExams: { id: number; title: string; course: string | null; department: string; semester: string; attempts: number; violations: number }[];
}

const TYPE_LABEL: Record<string, string> = {
  BULK_PASTE: 'Dán số lượng lớn',
  SYNTHETIC_INPUT: 'Nhập liệu giả lập',
  TAB_SWITCH: 'Chuyển tab',
  WINDOW_LOST_FOCUS: 'Rời cửa sổ thi',
  DEVTOOLS_OPENED: 'Mở công cụ nhà phát triển',
  MULTIPLE_KEYBOARDS: 'Nhiều bàn phím',
  FACE_MISMATCH: 'Sai khuôn mặt',
  MULTIPLE_PEOPLE: 'Nhiều người trong khung hình',
  NO_FACE_DETECTED: 'Không thấy khuôn mặt',
  PROHIBITED_DEVICE: 'Vật dụng cấm',
};

function GroupTable({ title, desc, rows }: { title: string; desc: string; rows: Group[] }) {
  const max = Math.max(1, ...rows.map((r) => r.attempts));
  return (
    <Panel padded={false}>
      <div className="px-5 pt-5">
        <PanelTitle title={title} desc={desc} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="Chưa có dữ liệu" />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Nhóm</th>
                <th className="px-3 py-2.5 font-medium">Kỳ thi</th>
                <th className="px-3 py-2.5 font-medium">Lượt thi</th>
                <th className="px-3 py-2.5 font-medium">Điểm TB</th>
                <th className="px-3 py-2.5 font-medium">Vi phạm / lượt</th>
                <th className="px-3 py-2.5 font-medium">Đình chỉ</th>
                <th className="px-5 py-2.5 font-medium">Gắn cờ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.attempts / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{r.exams}</td>
                  <td className="px-3 py-3 tabular-nums">{r.attempts.toLocaleString('vi-VN')}</td>
                  <td className="px-3 py-3 tabular-nums">{r.avg_score ?? '—'}</td>
                  <td className="px-3 py-3 tabular-nums">{r.violations_per_attempt}</td>
                  <td className="px-3 py-3 tabular-nums">{r.force_ended}</td>
                  <td className="px-5 py-3 tabular-nums">{r.flagged_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function AnalyticsIndex({ user, teams, filters, options, totals, byDepartment, bySemester, byType, topExams }: Props) {
  const visit = (patch: Partial<Props['filters']>) => {
    const next = { ...filters, ...patch };
    router.get('/admin/analytics', Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { preserveState: true, preserveScroll: true, replace: true });
  };
  const exportUrl = '/admin/analytics/export?' + new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const maxType = Math.max(1, ...byType.map((t) => t.n));

  return (
    <AdminLayout user={user} teams={teams} currentTab="analytics" title="Báo cáo theo khoa & học kỳ" breadcrumbs={[{ label: 'Cấu hình' }, { label: 'Báo cáo' }]}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Báo cáo theo khoa & học kỳ"
          desc="Học kỳ được suy ra từ ngày thi (HK1: tháng 9–1, HK2: tháng 2–6, hè: tháng 7–8). Khoa lấy từ trường “Khoa / Bộ môn” của khóa học."
          actions={
            <a href={exportUrl}>
              <FxButton icon={Download}>Xuất CSV</FxButton>
            </a>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <FxSelect className="w-52" value={filters.semester} onChange={(e) => visit({ semester: e.target.value })} aria-label="Học kỳ">
            <option value="">Mọi học kỳ</option>
            {options.semesters.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </FxSelect>
          <FxSelect className="w-52" value={filters.department} onChange={(e) => visit({ department: e.target.value })} aria-label="Khoa">
            <option value="">Mọi khoa / bộ môn</option>
            {options.departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </FxSelect>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Kỳ thi" value={totals.exams} icon={ClipboardList} />
          <StatTile label="Lượt thi" value={totals.attempts.toLocaleString('vi-VN')} icon={Users} tone="info" />
          <StatTile label="Vi phạm xác nhận" value={totals.violations.toLocaleString('vi-VN')} delta={`${totals.violations_per_attempt} / lượt`} icon={ShieldAlert} tone="warning" />
          <StatTile label="Bị đình chỉ" value={totals.force_ended} delta={`${totals.false_positives} báo nhầm`} icon={OctagonX} tone="danger" />
        </div>

        <GroupTable title="Theo khoa / bộ môn" desc="Sắp theo số lượt thi" rows={byDepartment} />
        <GroupTable title="Theo học kỳ" desc="Xu hướng qua các học kỳ" rows={bySemester} />

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Panel className="flex flex-col gap-3">
            <PanelTitle title="Loại vi phạm phổ biến" />
            {byType.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="Chưa có vi phạm" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {byType.map((t) => (
                  <li key={t.type} className="flex items-center gap-3 text-sm">
                    <span className="w-44 shrink-0 truncate">{TYPE_LABEL[t.type] ?? t.type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-warning" style={{ width: `${(t.n / maxType) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums">{t.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="flex flex-col gap-3">
            <PanelTitle title="Kỳ thi nhiều vi phạm nhất" />
            {topExams.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Chưa có kỳ thi" />
            ) : (
              <ul className="divide-y divide-border">
                {topExams.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <a href={`/admin/exams/${e.id}`} className="block truncate font-medium hover:underline">
                        {e.title}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {e.department} · {e.semester}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {e.violations} vi phạm / {e.attempts} lượt
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}
