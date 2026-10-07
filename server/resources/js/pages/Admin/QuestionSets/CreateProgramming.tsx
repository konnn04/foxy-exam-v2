import React from 'react';
import { FeatureList, QuestionSetCreateForm, type QuestionSetCreateProps } from '@/components/foxy/question-set-form';

/** Tạo bộ bài lập trình. */
export default function CreateProgrammingSet(page: QuestionSetCreateProps) {
  return (
    <QuestionSetCreateForm
      type="PROGRAMMING"
      page={page}
      aside={
        <FeatureList
          title="Mỗi bài toán gồm"
          items={[
            ['Đề bài Markdown', 'Ràng buộc, input/output, ví dụ — xem trước song song'],
            ['Giới hạn & ngôn ngữ', 'Thời gian, bộ nhớ; C++, Python, Java, C'],
            ['Mã khởi tạo', 'Khung code thí sinh nhận trong FoxyClient'],
            ['Testcase', 'Test mẫu và test ẩn, trọng số điểm từng test'],
          ]}
        />
      }
    />
  );
}
