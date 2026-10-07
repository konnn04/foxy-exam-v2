import React from 'react';
import { router } from '@inertiajs/react';
import { CalendarPlus, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CourseItem } from '@/types/admin';
import { FxButton, IconButton, PageHeader } from '@/components/foxy/ui';
import { useDialog } from '@/components/foxy/dialogs';
import { FxList, NameCell } from '@/components/foxy/fx-list';

export type CourseRow = CourseItem;

interface CoursesTabProps {
  courses: CourseRow[];
  onOpenCreateModal?: () => void;
}

export function CoursesTab({ courses, onOpenCreateModal }: CoursesTabProps) {
  const dialog = useDialog();

  const remove = async (c: CourseRow) => {
    const ok = await dialog.confirm({
      title: `Xóa khóa học “${c.name}”?`,
      text: 'Khóa học bị xóa khỏi tổ chức cùng danh sách ghi danh.',
      warn: c.exams_count ? `Khóa có ${c.exams_count} kỳ thi.` : undefined,
      tone: 'danger',
    });
    if (ok) router.post(`/admin/courses/${c.id}/delete`, {}, { preserveScroll: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Khóa học"
        desc="Môn học, giảng viên phụ trách và các kỳ thi thuộc khóa."
        actions={
          <FxButton variant="primary" icon={Plus} onClick={onOpenCreateModal ?? (() => router.visit('/admin/courses/new'))}>
            Thêm khóa học
          </FxButton>
        }
      />
      <FxList
        rows={courses}
        searchText={(c) => `${c.name} ${c.code} ${c.teacher_name ?? ''}`}
        searchPlaceholder="Tìm theo tên, mã khóa, giảng viên…"
        onRowClick={(c) => router.visit(`/admin/courses/${c.id}`)}
        empty={{ icon: GraduationCap, title: 'Chưa có khóa học', desc: 'Thêm khóa học để gán bộ đề và tạo kỳ thi.' }}
        bulk={(ids) => (
          <FxButton
            size="sm"
            icon={Trash2}
            className="text-danger-fg"
            onClick={async () => {
              const ok = await dialog.confirm({ title: `Xóa ${ids.length} khóa học đã chọn?`, text: 'Các khóa học và danh sách ghi danh sẽ bị xóa.', tone: 'danger', confirmLabel: 'Xóa tất cả' });
              if (ok) ids.forEach((id) => router.post(`/admin/courses/${id}/delete`, {}, { preserveScroll: true }));
            }}
          >
            Xóa {ids.length} khóa học
          </FxButton>
        )}
        minWidth={760}
        columns={[
          { key: 'name', label: 'Khóa học', width: 'minmax(240px,2.2fr)', render: (c) => <NameCell code={c.code} name={c.name} sub={c.description || undefined} /> },
          { key: 'teacher', label: 'Giảng viên', width: 'minmax(160px,1.3fr)', render: (c) => <span className="block truncate">{c.teacher_name}</span> },
          { key: 'exams', label: 'Kỳ thi', width: '80px', render: (c) => <span className="tabular-nums">{c.exams_count ?? 0}</span> },
          { key: 'org', label: 'Tổ chức', width: 'minmax(140px,1fr)', render: (c) => <span className="block truncate text-muted-foreground">{c.organization_name}</span> },
        ]}
        actions={(c) => (
          <>
            <IconButton icon={CalendarPlus} label="Tạo kỳ thi" onClick={() => router.visit(`/admin/exams?create=1&course_id=${c.id}`)} />
            <IconButton icon={Pencil} label="Sửa" onClick={() => router.visit(`/admin/courses/${c.id}/edit`)} />
            <IconButton icon={Trash2} label="Xóa" danger onClick={() => remove(c)} />
          </>
        )}
      />
    </div>
  );
}
