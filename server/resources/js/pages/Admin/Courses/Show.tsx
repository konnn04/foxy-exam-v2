import React from 'react';
import { router } from '@inertiajs/react';
import { CalendarPlus, ClipboardList, Code, ListChecks, Pencil, Trash2 } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FxButton, IconButton, PageHeader, Panel, PanelBar, PanelTitle, Pill } from '@/components/foxy/ui';
import { EXAM_STATUS } from '@/components/foxy/exam-form';
import { useDialog } from '@/components/foxy/dialogs';

interface Props {
  user: any;
  teams: TeamItem[];
  course: {
    id: number;
    name: string;
    code: string;
    description?: string;
    teacher_name?: string;
    organization_name?: string;
    exams: { id: number; title: string; code: string; type?: string; duration_minutes: number; status: string; attempts_count: number }[];
  };
}

export default function ShowCourse({ user, teams, course }: Props) {
  const dialog = useDialog();
  const remove = async () => {
    const ok = await dialog.confirm({
      title: `Xóa khóa học “${course.name}”?`,
      text: 'Khóa học bị xóa cùng danh sách ghi danh.',
      warn: course.exams.length ? `Khóa có ${course.exams.length} kỳ thi.` : undefined,
      tone: 'danger',
    });
    if (ok) router.post(`/admin/courses/${course.id}/delete`);
  };
  const attempts = course.exams.reduce((n, e) => n + e.attempts_count, 0);
  return (
    <AdminLayout user={user} teams={teams} currentTab="courses" title={course.name} breadcrumbs={[{ label: 'Khóa học', href: '/admin/courses' }, { label: course.name }]}>
      <PageHeader
        onBack={() => router.visit('/admin/courses')}
        leading={<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-[11px] font-bold">{course.code.slice(0, 5)}</div>}
        title={course.name}
        badges={<Pill tone="brand">{course.code}</Pill>}
        desc={`GV: ${course.teacher_name ?? 'Chưa gán'}${course.organization_name ? ` · ${course.organization_name}` : ''}`}
        actions={
          <>
            <FxButton icon={Trash2} className="text-danger-fg" onClick={remove}>
              Xóa
            </FxButton>
            <FxButton icon={Pencil} onClick={() => router.visit(`/admin/courses/${course.id}/edit`)}>
              Sửa
            </FxButton>
            <FxButton variant="primary" icon={CalendarPlus} onClick={() => router.visit(`/admin/exams?create=1&course_id=${course.id}`)}>
              Tạo kỳ thi
            </FxButton>
          </>
        }
      />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        {[
          ['Kỳ thi', course.exams.length],
          ['Đang diễn ra', course.exams.filter((e) => e.status === 'IN_PROGRESS').length],
          ['Lượt làm bài', attempts],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex flex-col gap-1 bg-card px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="text-[22px] font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Panel padded={false} className="min-w-0 flex-[2_1_520px] overflow-hidden">
          <PanelBar>
            <PanelTitle className="flex-1" title="Kỳ thi của khóa" />
            <FxButton size="sm" icon={ListChecks} onClick={() => router.visit(`/admin/exams/new/general?course_id=${course.id}`)}>
              Phổ thông
            </FxButton>
            <FxButton size="sm" icon={Code} onClick={() => router.visit(`/admin/exams/new/programming?course_id=${course.id}`)}>
              Lập trình
            </FxButton>
          </PanelBar>
          {course.exams.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Khóa học chưa có kỳ thi" />
          ) : (
            course.exams.map((e) => {
              const s = EXAM_STATUS[e.status] ?? { label: e.status, tone: 'neutral' as const };
              const code = e.type !== 'QUIZ';
              return (
                <div
                  key={e.id}
                  onClick={() => router.visit(`/admin/exams/${e.id}`)}
                  className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {e.code} · {e.duration_minutes}′ · {e.attempts_count} lượt
                    </div>
                  </div>
                  <Pill tone={code ? 'brand' : 'info'}>{code ? 'Lập trình' : 'Phổ thông'}</Pill>
                  <Pill tone={s.tone}>{s.label}</Pill>
                  <IconButton
                    icon={Pencil}
                    label="Sửa"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      router.visit(`/admin/exams/${e.id}/edit`);
                    }}
                  />
                </div>
              );
            })
          )}
        </Panel>
        <Panel className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
          <PanelTitle title="Mô tả" />
          <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{course.description || 'Chưa có mô tả.'}</p>
        </Panel>
      </div>

    </AdminLayout>
  );
}
