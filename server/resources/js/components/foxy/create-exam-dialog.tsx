import React from 'react';
import { router } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { FxButton, Modal, Pill, Tip } from './ui';
import { KIND_META, type ExamKind } from './exam-form';
import { cn } from '@/lib/utils';

/** Each line may carry a plain-language explanation of its technical term, shown behind a "?". */
const FEATURES: Record<ExamKind, { text: string; tip?: string }[]> = {
  general: [
    { text: 'Trắc nghiệm, đúng/sai, điền khuyết, tự luận' },
    { text: 'Câu hỏi theo nhóm (đoạn văn, bài nghe)', tip: 'Nhiều câu hỏi cùng dựa trên một đoạn văn hoặc một file âm thanh.' },
    { text: 'Tự đảo thứ tự câu hỏi và đáp án', tip: 'Mỗi thí sinh nhận một thứ tự khác nhau để hạn chế trao đổi bài.' },
    { text: 'Tự chấm điểm; phần tự luận chuyển cho giảng viên chấm' },
  ],
  programming: [
    { text: 'Bài làm là mã nguồn, chạy thử với bộ dữ liệu kiểm tra', tip: 'Hệ thống chạy chương trình của thí sinh với các bộ dữ liệu (testcase) do giảng viên chuẩn bị rồi so kết quả.' },
    { text: 'Tự động chấm đúng/sai và báo lỗi', tip: 'Kết quả hiển thị theo ký hiệu quen thuộc: AC (đúng), WA (sai kết quả), TLE (chạy quá thời gian).' },
    { text: 'Ghi lại quá trình gõ code để xem lại', tip: 'Hệ thống lưu từng thao tác gõ, xóa, dán của thí sinh để giảng viên xem lại khi cần.' },
    { text: 'Cảnh báo khi dán một đoạn code dài', tip: 'Hệ thống đánh dấu (BULK_PASTE) khi thí sinh dán cùng lúc nhiều dòng code từ nơi khác.' },
  ],
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
    <Modal open={open} onClose={onClose} width={720} title="Tạo kỳ thi mới" desc="Chọn hình thức thi. Mỗi hình thức có cách ra đề, chấm bài và theo dõi thí sinh riêng." footer={<FxButton onClick={onClose}>Hủy</FxButton>}>
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
                  <li key={f.text} className="flex items-start gap-2">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      {f.text}
                      {f.tip && <Tip>{f.tip}</Tip>}
                    </span>
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
