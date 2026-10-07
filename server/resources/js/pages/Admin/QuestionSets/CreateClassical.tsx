import React from 'react';
import { FeatureList, QuestionSetCreateForm, type QuestionSetCreateProps } from '@/components/foxy/question-set-form';

/** Tạo bộ đề phổ thông. */
export default function CreateClassicalSet(page: QuestionSetCreateProps) {
  return (
    <QuestionSetCreateForm
      type="CLASSICAL"
      page={page}
      aside={
        <FeatureList
          title="Bộ đề phổ thông gồm"
          items={[
            ['Trắc nghiệm & Đúng/Sai', '≥ 2 đáp án, một hoặc nhiều đáp án đúng — chấm tự động'],
            ['Trả lời ngắn & Tự luận', 'Vào hàng chờ chấm tay của giảng viên'],
            ['Câu hỏi nhóm', 'Đoạn văn / hướng dẫn chung kèm các câu con'],
            ['Ma trận đề', 'Theo dõi phân bố dạng câu × độ khó'],
          ]}
        />
      }
    />
  );
}
