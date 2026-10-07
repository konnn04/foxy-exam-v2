import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { ClipboardList, Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ExamItem } from '@/types/admin';
import { FxButton, IconButton, PageHeader, Pill } from '@/components/foxy/ui';
import { useDialog } from '@/components/foxy/dialogs';
import { CreateExamDialog } from '@/components/foxy/create-exam-dialog';
import { FxList } from '@/components/foxy/fx-list';
import { EXAM_STATUS } from '@/components/foxy/exam-form';

export type ExamRow = ExamItem;

interface ExamsTabProps {
  exams: ExamRow[];
  setCounts?: { CLASSICAL: number; PROGRAMMING: number };
}

const isCode = (e: ExamRow) => e.type !== 'QUIZ';

export function ExamsTab({ exams, setCounts }: ExamsTabProps) {
  const dialog = useDialog();
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [courseId, setCourseId] = useState<number | null>(null);

  // /admin/exams?create=1&course_id=... opens the "Tạo kỳ thi" chooser straight away
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('create')) {
      setCourseId(q.get('course_id') ? Number(q.get('course_id')) : null);
      setCreating(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const remove = async (e: ExamRow) => {
    const ok = await dialog.confirm({
      title: `Xóa kỳ thi “${e.title}”?`,
      text: 'Bài làm, bài nộp, Op-Log và vi phạm của thí sinh trong kỳ thi cũng bị xóa.',
      warn: e.attempts_count ? `Đã có ${e.attempts_count} lượt làm bài.` : undefined,
      tone: 'danger',
      requireText: e.attempts_count ? e.code : undefined,
      confirmLabel: 'Xóa kỳ thi',
    });
    if (ok) router.post(`/admin/exams/${e.id}/delete`, {}, { preserveScroll: true });
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Kỳ thi"
        desc="Lịch thi, mã phòng và trạng thái của các kỳ thi phổ thông và lập trình."
        actions={
          <FxButton
            variant="primary"
            icon={Plus}
            onClick={() => {
              setCourseId(null);
              setCreating(true);
            }}
          >
            Tạo kỳ thi
          </FxButton>
        }
      />

      <FxList
        rows={exams}
        minWidth={900}
        searchText={(e) => `${e.title} ${e.code} ${e.course_name ?? ''}`}
        searchPlaceholder="Tìm theo tên kỳ thi, mã phòng, khóa học…"
        filters={[
          {
            key: 'type',
            label: 'Loại',
            options: [
              { value: 'general', label: 'Thi phổ thông' },
              { value: 'programming', label: 'Thi lập trình' },
            ],
            test: (e, v) => (v === 'programming') === isCode(e),
          },
          {
            key: 'status',
            label: 'Trạng thái',
            options: Object.entries(EXAM_STATUS).map(([value, s]) => ({ value, label: s.label })),
            test: (e, v) => e.status === v,
          },
        ]}
        onRowClick={(e) => router.visit(`/admin/exams/${e.id}`)}
        empty={{
          icon: ClipboardList,
          title: 'Chưa có kỳ thi',
          desc: 'Tạo kỳ thi phổ thông hoặc lập trình để bắt đầu.',
          action: (
            <FxButton variant="primary" onClick={() => setCreating(true)}>
              Tạo kỳ thi
            </FxButton>
          ),
        }}
        bulk={(ids) => (
          <FxButton
            size="sm"
            icon={Trash2}
            className="text-danger-fg"
            onClick={async () => {
              const ok = await dialog.confirm({
                title: `Xóa ${ids.length} kỳ thi đã chọn?`,
                text: 'Toàn bộ bài làm và dữ liệu giám sát của các kỳ thi này sẽ bị xóa.',
                tone: 'danger',
                confirmLabel: 'Xóa tất cả',
              });
              if (ok) ids.forEach((id) => router.post(`/admin/exams/${id}/delete`, {}, { preserveScroll: true }));
            }}
          >
            Xóa {ids.length} kỳ thi
          </FxButton>
        )}
        columns={[
          {
            key: 'title',
            label: 'Kỳ thi',
            width: 'minmax(220px,2fr)',
            render: (e) => (
              <div className="min-w-0">
                <div className="truncate font-medium">{e.title}</div>
                <button
                  type="button"
                  title="Sao chép mã phòng"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    copy(e.code);
                  }}
                  className="flex cursor-pointer items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-brand-fg"
                >
                  {copied === e.code ? 'Đã chép mã phòng' : e.code}
                  <Copy className="size-3 opacity-60" />
                </button>
              </div>
            ),
          },
          {
            key: 'kind',
            label: 'Loại',
            width: '100px',
            render: (e) => <Pill tone={isCode(e) ? 'brand' : 'info'}>{isCode(e) ? 'Lập trình' : 'Phổ thông'}</Pill>,
          },
          { key: 'course', label: 'Khóa học', width: 'minmax(130px,1fr)', render: (e) => <span className="block truncate text-muted-foreground">{e.course_name}</span> },
          { key: 'dur', label: 'Thời lượng', width: '80px', render: (e) => <span className="tabular-nums">{e.duration_minutes}′</span> },
          { key: 'att', label: 'Lượt thi', width: '64px', render: (e) => <span className="tabular-nums">{e.attempts_count ?? 0}</span> },
          {
            key: 'viol',
            label: 'Vi phạm',
            width: '64px',
            render: (e) => (e.violations_count ? <Pill tone="danger">{e.violations_count}</Pill> : <span className="text-muted-foreground">0</span>),
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
        actions={(e) => (
          <>
            <IconButton icon={Eye} label="Giám sát" onClick={() => router.visit(`/admin/exams/${e.id}/live`)} />
            <IconButton icon={Pencil} label="Sửa" onClick={() => router.visit(`/admin/exams/${e.id}/edit`)} />
            <IconButton icon={Trash2} label="Xóa" danger onClick={() => remove(e)} />
          </>
        )}
      />

      <CreateExamDialog open={creating} onClose={() => setCreating(false)} courseId={courseId} setCounts={setCounts} />
    </div>
  );
}
