import React from 'react';
import { router } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { FxButton, Modal, Pill } from './ui';
import { KIND_META, type ExamKind } from './exam-form';
import { cn } from '@/lib/utils';

const FEATURES: Record<ExamKind, string[]> = {
  general: ['Trắc nghiệm, đúng/sai, điền khuyết, tự luận', 'Câu hỏi nhóm (bài đọc, bài nghe)', 'Trộn câu & đáp án', 'Chấm tự động + hàng chờ chấm tay'],
  programming: ['Bài code chạy testcase', 'Chấm tự động AC / WA / TLE', 'Op-Log & phát lại quá trình gõ', 'Phát hiện dán code (BULK_PASTE)'],
};

/** "Tạo kỳ thi" — pick the kind of exam; each kind has its own create page. */
export function CreateExamDialog({
  open,
  onClose,
  courseId,
  setCounts,
}: {
  open: boolean;
  onClose: () => void;
  courseId?: number | null;
  setCounts?: { CLASSICAL: number; PROGRAMMING: number };
}) {
  const go = (k: ExamKind) => {
    onClose();
    router.visit(`/admin/exams/new/${k}${courseId ? `?course_id=${courseId}` : ''}`);
  };
  return (
    <Modal open={open} onClose={onClose} width={720} title="Tạo kỳ thi" desc="Chọn loại kỳ thi — mỗi loại có quy trình soạn, chấm và giám sát riêng." footer={<FxButton onClick={onClose}>Hủy</FxButton>}>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        {(['general', 'programming'] as ExamKind[]).map((k) => {
          const m = KIND_META[k];
          const n = setCounts ? (k === 'general' ? setCounts.CLASSICAL : setCounts.PROGRAMMING) : null;
          return (
            <button
              key={k}
              type="button"
              onClick={() => go(k)}
              className="group flex cursor-pointer flex-col gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex items-start gap-3">
                <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-[10px]', m.chip)}>
                  <m.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold">{m.label}</div>
                  <div className="mt-0.5 text-xs leading-[1.45] text-muted-foreground">{m.desc}</div>
                </div>
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                {FEATURES[k].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-border pt-3">
                {n !== null ? <Pill tone={n ? m.tone : 'warning'}>{n ? `${n} ${m.setLabel}` : `Chưa có ${m.setLabel}`}</Pill> : <span />}
                <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-fg">
                  Tiếp tục
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
