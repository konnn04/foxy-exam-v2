import React from 'react';
import { ClipboardPaste, Keyboard } from 'lucide-react';
import { Field, FxInput, Panel, PanelTitle, ToggleList } from '@/components/foxy/ui';
import {
  AttemptsField,
  ExamCandidatesStep,
  ExamFormShell,
  ExamInfoStep,
  ExamMonitorStep,
  ExamSetStep,
  useExamForm,
  type ExamFormPageProps,
} from '@/components/foxy/exam-form';

const STEPS = ['Thông tin', 'Bài toán', 'Làm bài', 'Chấm & kết quả', 'Giám sát', 'Thí sinh & giám thị'];

/** Tạo / sửa kỳ thi lập trình — one page for both, `exam` is null on create. */
export default function ProgrammingExamForm(page: ExamFormPageProps) {
  const state = useExamForm('programming', page);
  const { form, set, step, chosen } = state;

  return (
    <ExamFormShell page={page} state={state} steps={STEPS}>
      {step === 0 && <ExamInfoStep page={page} state={state} />}
      {step === 1 && <ExamSetStep page={page} state={state} />}

      {step === 2 && (
        <div className="flex flex-wrap items-start gap-4">
          <Panel className="flex-[1_1_380px] px-5 py-1">
            <ToggleList
              items={[
                { key: 'paste', label: 'Chặn dán ngoài editor', desc: `Ghi BULK_PASTE khi dán > ${form.max_paste_chars} ký tự`, checked: form.prevent_paste, onChange: (v) => state.flipMon('prevent_paste', v) },
                { key: 'ks', label: 'Ghi Op-Log từng phím', desc: 'Cho phép phát lại quá trình gõ khi chấm', checked: form.track_keystroke, onChange: (v) => state.flipMon('track_keystroke', v) },
              ]}
            />
          </Panel>
          <Panel className="flex flex-[1_1_300px] flex-col gap-3.5 p-4">
            <AttemptsField state={state} />
            <Field label="Ngưỡng BULK_PASTE" hint="Số ký tự dán một lần để ghi vi phạm" error={state.errors.max_paste_chars}>
              <FxInput type="number" min={1} suffix="ký tự" value={form.max_paste_chars} onChange={(e) => set('max_paste_chars', Number(e.target.value))} />
            </Field>
          </Panel>
        </div>
      )}

      {step === 3 && (
        <div className="flex max-w-[960px] flex-col gap-4">
          <Panel className="flex flex-col gap-3">
            <PanelTitle title="Chấm tự động theo testcase" desc="Mỗi lần nộp được chạy với testcase của từng bài; điểm bài = tổng trọng số test đúng." />
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
              {[
                ['Số bài', chosen?.problems?.length ?? '—'],
                ['Bộ bài', chosen?.code ?? '—'],
                ['Giới hạn', chosen?.problems?.length ? `${Math.max(...chosen.problems.map((p) => p.time_limit_ms)) / 1000}s tối đa` : '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="bg-card px-4 py-3">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="mt-0.5 truncate font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </Panel>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            <Panel className="flex items-start gap-3 p-4">
              <ClipboardPaste className="mt-0.5 size-4 shrink-0" />
              <div className="text-[13px] text-muted-foreground">Đoạn code được dán sẽ được tô đỏ khi giảng viên xem bài làm, kèm bằng chứng vi phạm.</div>
            </Panel>
            <Panel className="flex items-start gap-3 p-4">
              <Keyboard className="mt-0.5 size-4 shrink-0" />
              <div className="text-[13px] text-muted-foreground">Op-Log ghi số phím gõ, số lần dán và thời gian gõ của từng bài để đối chiếu khi chấm lại.</div>
            </Panel>
          </div>
        </div>
      )}

      {step === 4 && <ExamMonitorStep page={page} state={state} />}
      {step === 5 && <ExamCandidatesStep page={page} state={state} />}
    </ExamFormShell>
  );
}
