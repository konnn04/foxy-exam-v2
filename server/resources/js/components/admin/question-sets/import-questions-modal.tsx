import React, { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Download, Search } from 'lucide-react';
import { FxButton, Modal, Pill } from '@/components/foxy/ui';
import { DIFFICULTY } from '@/components/foxy/domain';
import { cn } from '@/lib/utils';

export interface BankItem {
  id: number;
  title?: string;
  content?: string;
  type?: string;
  set_name?: string;
  set_code?: string;
  points?: number;
  difficulty?: string;
  test_cases_count?: number;
}

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionSetId: number;
  questionSetType: 'CLASSICAL' | 'PROGRAMMING';
  availableItems: BankItem[];
}

const Q_TYPE: Record<string, string> = {
  SINGLE_CHOICE: 'Trắc nghiệm',
  MULTIPLE_CHOICE: 'Nhiều đáp án',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
  GROUP_QUESTION: 'Câu hỏi nhóm',
};

/** Nhập câu hỏi / bài toán từ các bộ đề khác vào bộ đề hiện tại (bản sao). */
export function ImportQuestionsModal({ isOpen, onClose, questionSetId, questionSetType, availableItems }: ImportQuestionsModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCode = questionSetType === 'PROGRAMMING';

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableItems.filter((i) => !q || `${i.title ?? ''} ${i.content ?? ''} ${i.set_name ?? ''} ${i.set_code ?? ''}`.toLowerCase().includes(q));
  }, [availableItems, search]);
  const allOn = items.length > 0 && items.every((i) => selected.includes(i.id));

  const submit = () => {
    if (!selected.length) {
      setError(`Chọn ít nhất 1 ${isCode ? 'bài toán' : 'câu hỏi'}.`);
      return;
    }
    setProcessing(true);
    router.post(
      `/admin/question-sets/${questionSetId}/import-questions`,
      { selected_ids: selected },
      {
        preserveScroll: true,
        onSuccess: () => {
          setSelected([]);
          onClose();
        },
        onError: (e) => setError(Object.values(e)[0] as string),
        onFinish: () => setProcessing(false),
      },
    );
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      width={760}
      title={isCode ? 'Nhập bài toán từ ngân hàng' : 'Nhập câu hỏi từ ngân hàng'}
      desc="Các mục được sao chép sang bộ đề này — sửa bản sao không ảnh hưởng bộ đề gốc."
      footer={
        <>
          <span className="mr-auto self-center text-[13px] text-muted-foreground">Đã chọn {selected.length}</span>
          <FxButton onClick={onClose}>Hủy</FxButton>
          <FxButton variant="primary" icon={Download} disabled={processing} onClick={submit}>
            Nhập {selected.length || ''} {isCode ? 'bài' : 'câu'}
          </FxButton>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border px-2.5 focus-within:border-primary">
          <Search className="size-4 opacity-60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung, mã bộ đề…"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <FxButton size="sm" onClick={() => setSelected(allOn ? [] : items.map((i) => i.id))}>
          {allOn ? 'Bỏ chọn' : 'Chọn tất cả'}
        </FxButton>
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border">
        {items.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">Không có mục nào để nhập.</div>}
        {items.map((i) => {
          const on = selected.includes(i.id);
          const d = i.difficulty ? DIFFICULTY[i.difficulty] : undefined;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== i.id) : [...s, i.id]))}
              className={cn('flex w-full cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0', on ? 'bg-primary/8' : 'hover:bg-surface')}
            >
              <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/30')}>
                {on && <span className="text-[10px] leading-none">✓</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{i.title ?? i.content}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {i.set_code} · {i.set_name}
                </div>
              </div>
              {i.type && <Pill size="sm">{Q_TYPE[i.type] ?? i.type}</Pill>}
              {d && (
                <Pill size="sm" tone={d.tone}>
                  {d.short}
                </Pill>
              )}
              <span className="w-14 text-right text-xs text-muted-foreground">{isCode ? `${i.test_cases_count ?? 0} test` : `${Number(i.points ?? 0)}đ`}</span>
            </button>
          );
        })}
      </div>
      {error && <span className="text-xs text-danger-fg">{error}</span>}
    </Modal>
  );
}
