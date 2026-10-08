import { formatDate } from '@/lib/datetime';
import React from 'react';
import { router } from '@inertiajs/react';
import { Code, Library, ListChecks, Pencil, Trash2 } from 'lucide-react';
import type { QuestionSetItem } from '@/types/admin';
import { FxButton, IconButton, PageHeader, Pill } from '@/components/foxy/ui';
import { useDialog } from '@/components/foxy/dialogs';
import { FxList, NameCell } from '@/components/foxy/fx-list';

export type QuestionSetRow = QuestionSetItem;

interface QuestionSetsTabProps {
  questionSets: QuestionSetRow[];
  courses: Array<{ id: number; name: string; code: string }>;
}

const SET_STATUS = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' as const },
  PUBLISHED: { label: 'Đã xuất bản', tone: 'success' as const },
  ARCHIVED: { label: 'Lưu trữ', tone: 'outline' as const },
};

export function QuestionSetsTab({ questionSets = [] }: QuestionSetsTabProps) {
  const dialog = useDialog();
  const open = (q: QuestionSetRow) => router.visit(`/admin/question-sets/${q.id}`);

  const remove = async (q: QuestionSetRow) => {
    const ok = await dialog.confirm({
      title: `Xóa bộ đề “${q.name}”?`,
      text: `Toàn bộ ${q.questions_count ?? 0} ${q.type === 'PROGRAMMING' ? 'bài toán và testcase' : 'câu hỏi và đáp án'} trong bộ đề sẽ bị xóa.`,
      tone: 'danger',
      requireText: q.code,
    });
    if (ok) router.post(`/admin/question-sets/${q.id}/delete`, {}, { preserveScroll: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ngân hàng đề"
        desc="Bộ đề phổ thông (trắc nghiệm, tự luận, câu nhóm) và bộ bài lập trình (testcase, chấm tự động)."
        actions={
          <>
            <FxButton icon={ListChecks} onClick={() => router.visit('/admin/question-sets/new/classical')}>
              Bộ đề phổ thông
            </FxButton>
            <FxButton variant="primary" icon={Code} onClick={() => router.visit('/admin/question-sets/new/programming')}>
              Bộ bài lập trình
            </FxButton>
          </>
        }
      />

      <FxList
        rows={questionSets}
        searchText={(q) => `${q.name} ${q.code} ${q.course_name ?? ''}`}
        searchPlaceholder="Tìm theo tên, mã bộ đề, môn học…"
        filters={[
          {
            key: 'type',
            label: 'Loại',
            options: [
              { value: 'CLASSICAL', label: 'Phổ thông' },
              { value: 'PROGRAMMING', label: 'Lập trình' },
            ],
            test: (q, v) => q.type === v,
          },
          {
            key: 'status',
            label: 'Trạng thái',
            options: Object.entries(SET_STATUS).map(([value, s]) => ({ value, label: s.label })),
            test: (q, v) => q.status === v,
          },
        ]}
        onRowClick={open}
        empty={{ icon: Library, title: 'Ngân hàng đề trống', desc: 'Tạo bộ đề phổ thông hoặc bộ bài lập trình.' }}
        bulk={(ids) => (
          <FxButton
            size="sm"
            icon={Trash2}
            className="text-danger-fg"
            onClick={async () => {
              const ok = await dialog.confirm({ title: `Xóa ${ids.length} bộ đề đã chọn?`, text: 'Toàn bộ câu hỏi / bài toán bên trong sẽ bị xóa.', tone: 'danger', confirmLabel: 'Xóa tất cả' });
              if (ok) ids.forEach((id) => router.post(`/admin/question-sets/${id}/delete`, {}, { preserveScroll: true }));
            }}
          >
            Xóa {ids.length} bộ đề
          </FxButton>
        )}
        columns={[
          { key: 'name', label: 'Bộ đề', width: 'minmax(200px,2fr)', render: (q) => <NameCell name={q.name} sub={q.code} /> },
          {
            key: 'type',
            label: 'Loại',
            width: '96px',
            render: (q) => <Pill tone={q.type === 'PROGRAMMING' ? 'brand' : 'info'}>{q.type === 'PROGRAMMING' ? 'Lập trình' : 'Phổ thông'}</Pill>,
          },
          { key: 'course', label: 'Môn học', width: 'minmax(120px,1fr)', render: (q) => <span className="block truncate text-muted-foreground">{q.course_name}</span> },
          {
            key: 'n',
            label: 'Nội dung',
            width: '76px',
            render: (q) => (
              <span className="tabular-nums">
                {q.questions_count} {q.type === 'PROGRAMMING' ? 'bài' : 'câu'}
              </span>
            ),
          },
          { key: 'score', label: 'Điểm', width: '56px', render: (q) => <span className="tabular-nums">{Number(q.max_score)}</span> },
          {
            key: 'status',
            label: 'Trạng thái',
            width: '110px',
            render: (q) => {
              const s = SET_STATUS[q.status as keyof typeof SET_STATUS] ?? { label: q.status, tone: 'neutral' as const };
              return <Pill tone={s.tone}>{s.label}</Pill>;
            },
          },
          { key: 'created', label: 'Ngày tạo', width: '92px', render: (q) => <span className="font-mono text-xs text-muted-foreground">{formatDate(q.created_at)}</span> },
        ]}
        actionsWidth="72px"
        actions={(q) => (
          <>
            <IconButton icon={Pencil} label="Soạn" onClick={() => open(q)} />
            <IconButton icon={Trash2} label="Xóa" danger onClick={() => remove(q)} />
          </>
        )}
      />

    </div>
  );
}
