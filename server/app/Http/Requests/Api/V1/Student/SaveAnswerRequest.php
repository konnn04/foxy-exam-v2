<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

class SaveAnswerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** `type` is implied by which id is sent, so a client that omits it still validates. */
    protected function prepareForValidation(): void
    {
        if (!$this->filled('type')) {
            $this->merge(['type' => $this->has('problem_id') ? 'PROGRAMMING' : 'CLASSICAL']);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            /**
             * Loại câu hỏi: CLASSICAL (Trắc nghiệm/Tự luận) hoặc PROGRAMMING (Lập trình).
             * @example CLASSICAL
             */
            'type' => ['required', 'string', 'in:CLASSICAL,PROGRAMMING'],

            /**
             * ID câu hỏi cổ điển (Bắt buộc nếu type=CLASSICAL).
             * @example 1
             */
            'question_id' => ['required_if:type,CLASSICAL', 'nullable', 'integer'],

            /**
             * ID đáp án được chọn (dành cho câu hỏi SINGLE_CHOICE).
             * @example 2
             */
            'answer_id' => ['nullable', 'integer'],

            /**
             * Mảng ID đáp án được chọn (dành cho câu hỏi MULTIPLE_CHOICE).
             * @example [1, 2, 5]
             */
            'selected_answer_ids' => ['nullable', 'array'],
            'selected_answer_ids.*' => ['integer'],

            /**
             * Nội dung câu trả lời tự luận ngắn (SHORT_ANSWER) hoặc đoạn văn (ESSAY).
             * @example Sử dụng toán tử delete hoặc delete[]
             */
            'answer_content' => ['nullable', 'string'],

            /**
             * ID bài toán lập trình (Bắt buộc nếu type=PROGRAMMING).
             * @example 1
             */
            'problem_id' => ['required_if:type,PROGRAMMING', 'nullable', 'integer'],

            /**
             * Ngôn ngữ lập trình được chọn.
             * @example cpp
             */
            'language' => ['nullable', 'string'],

            /**
             * Mã nguồn bài làm (bản nháp lưu tự động).
             * @example #include <iostream>\nusing namespace std;\nint main() { return 0; }
             */
            'source_code' => ['nullable', 'string'],
        ];
    }
}
