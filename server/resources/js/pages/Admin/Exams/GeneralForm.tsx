import React from 'react';
import { FxInput, Field, Panel, PanelTitle, ToggleList } from '@/components/foxy/ui';
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

const STEPS = ['Thông tin', 'Bộ đề', 'Làm bài', 'Chấm & kết quả', 'Giám sát', 'Thí sinh & giám thị'];

/** Tạo / sửa kỳ thi phổ thông — one page for both, `exam` is null on create. */
export default function GeneralExamForm(page: ExamFormPageProps) {
  const state = useExamForm('general', page);
  const { form, set, step } = state;

  return (
    <ExamFormShell page={page} state={state} steps={STEPS}>
      {step === 0 && <ExamInfoStep page={page} state={state} />}
      {step === 1 && <ExamSetStep page={page} state={state} />}

      {step === 2 && (
        <div className="flex flex-wrap items-start gap-4">
          <Panel className="flex-[1_1_380px] px-5 py-1">
            <ToggleList
              items={[
                { key: 'sq', label: 'Trộn câu hỏi', desc: 'Mỗi thí sinh nhận thứ tự câu khác nhau', checked: form.is_shuffle_questions, onChange: (v) => set('is_shuffle_questions', v) },
                { key: 'sa', label: 'Trộn đáp án', desc: 'Đảo thứ tự A/B/C/D trong câu trắc nghiệm', checked: form.is_shuffle_answers, onChange: (v) => set('is_shuffle_answers', v) },
              ]}
            />
          </Panel>
          <Panel className="flex flex-[1_1_300px] flex-col gap-3.5 p-4">
            <AttemptsField state={state} />
            <Field label="Số câu mỗi trang" error={state.errors.number_questions_per_page}>
              <FxInput type="number" min={1} suffix="câu" value={form.number_questions_per_page} onChange={(e) => set('number_questions_per_page', Number(e.target.value))} />
            </Field>
          </Panel>
        </div>
      )}

      {step === 3 && (
        <div className="flex max-w-[960px] flex-col gap-4">
          <Panel className="px-5 py-1">
            <ToggleList
              items={[
                { key: 'hide', label: 'Ẩn điểm sau khi thi', desc: 'Thí sinh chỉ thấy điểm khi giảng viên công bố', checked: form.is_hide_score, onChange: (v) => set('is_hide_score', v) },
                { key: 'review', label: 'Cho xem lại bài', desc: 'Hiện bài làm & giải thích sau khi kỳ thi đóng', checked: form.is_allow_review, onChange: (v) => set('is_allow_review', v) },
              ]}
            />
          </Panel>
          <Panel className="flex flex-col gap-1.5 p-4">
            <PanelTitle title="Cách tính điểm" desc="Câu trắc nghiệm, đúng/sai chấm tự động. Câu tự luận và trả lời ngắn vào hàng chờ chấm tay." />
          </Panel>
        </div>
      )}

      {step === 4 && <ExamMonitorStep page={page} state={state} />}
      {step === 5 && <ExamCandidatesStep page={page} state={state} />}
    </ExamFormShell>
  );
}
