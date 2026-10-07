import React from 'react';
import { router } from '@inertiajs/react';
import { Eye, ClipboardList } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { IconButton, PageHeader, Pill } from '@/components/foxy/ui';
import { FxList } from '@/components/foxy/fx-list';
import { hhmm } from '@/components/foxy/domain';
import { EXAM_STATUS } from '@/components/foxy/exam-form';

interface LiveExam {
  id: number;
  title: string;
  code: string;
  type: string;
  status: string;
  course: { code: string; name: string } | null;
  start_time: string | null;
  end_time: string | null;
  attempts_count: number;
  active_count: number;
  submitted_count: number;
  pending_violations_count: number;
}

/** Giám sát kỳ thi — a table of exams; a row opens that exam's dashboard + candidate sessions. */
export default function LiveIndex({ user, teams, exams }: { user: any; teams: TeamItem[]; exams: LiveExam[] }) {
  const running = exams.filter((e) => e.active_count > 0).length;
  const pending = exams.reduce((n, e) => n + e.pending_violations_count, 0);

  return (
    <AdminLayout user={user} teams={teams} currentTab="live" title="Giám sát kỳ thi">
      <PageHeader
        title="Giám sát kỳ thi"
        desc={`${running} kỳ thi đang có thí sinh trong phòng · ${pending} vi phạm chờ duyệt. Chọn một kỳ thi để xem dashboard, danh sách phiên thi và nhật ký từng thí sinh.`}
      />
      <FxList
        rows={exams}
        minWidth={860}
        searchText={(e) => `${e.title} ${e.code} ${e.course?.name ?? ''}`}
        searchPlaceholder="Tìm theo tên kỳ thi, mã phòng, khóa học…"
        filters={[
          {
            key: 'status',
            label: 'Trạng thái',
            options: Object.entries(EXAM_STATUS).map(([value, s]) => ({ value, label: s.label })),
            test: (e, v) => e.status === v,
          },
          {
            key: 'live',
            label: 'Phòng thi',
            options: [
              { value: 'live', label: 'Đang có thí sinh' },
              { value: 'violation', label: 'Có vi phạm chờ duyệt' },
            ],
            test: (e, v) => (v === 'live' ? e.active_count > 0 : e.pending_violations_count > 0),
          },
        ]}
        onRowClick={(e) => router.visit(`/admin/reports/${e.id}`)}
        empty={{ icon: ClipboardList, title: 'Chưa có kỳ thi', desc: 'Tạo kỳ thi ở mục Kỳ thi để bắt đầu giám sát.' }}
        columns={[
          {
            key: 'title',
            label: 'Kỳ thi',
            width: 'minmax(220px,2fr)',
            render: (e) => (
              <div className="min-w-0">
                <div className="truncate font-medium">{e.title}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {e.code}
                  {e.start_time && ` · ${hhmm(e.start_time)} – ${hhmm(e.end_time)}`}
                </div>
              </div>
            ),
          },
          { key: 'course', label: 'Khóa học', width: 'minmax(120px,1fr)', render: (e) => <span className="block truncate text-muted-foreground">{e.course?.name ?? '—'}</span> },
          {
            key: 'active',
            label: 'Đang làm',
            width: '84px',
            render: (e) => (e.active_count ? <Pill tone="success">{e.active_count}</Pill> : <span className="text-muted-foreground">0</span>),
          },
          { key: 'submitted', label: 'Đã nộp', width: '70px', render: (e) => <span className="tabular-nums">{e.submitted_count}</span> },
          { key: 'att', label: 'Tổng lượt', width: '80px', render: (e) => <span className="tabular-nums">{e.attempts_count}</span> },
          {
            key: 'viol',
            label: 'Vi phạm chờ',
            width: '96px',
            render: (e) => (e.pending_violations_count ? <Pill tone="danger">{e.pending_violations_count}</Pill> : <span className="text-muted-foreground">0</span>),
          },
          {
            key: 'status',
            label: 'Trạng thái',
            width: '110px',
            render: (e) => {
              const s = EXAM_STATUS[e.status] ?? { label: e.status, tone: 'neutral' as const };
              return <Pill tone={s.tone}>{s.label}</Pill>;
            },
          },
        ]}
        actions={(e) => <IconButton icon={Eye} label="Phòng thi trực tiếp" onClick={() => router.visit(`/admin/exams/${e.id}/live`)} />}
      />
    </AdminLayout>
  );
}
