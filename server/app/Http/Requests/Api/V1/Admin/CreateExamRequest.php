<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Foundation\Http\FormRequest;

class CreateExamRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            /**
             * ID khóa học / môn học sở hữu kỳ thi này.
             * 
             * @var int
             * @example 1
             */
            'course_id' => ['required', 'integer', 'exists:courses,id'],

            /**
             * Tiêu đề / Tên chính thức của kỳ thi.
             * 
             * @var string
             * @example Kiểm tra thực hành Lập trình C++ Giữa kỳ
             */
            'title' => ['required', 'string', 'max:255'],

            /**
             * Mô tả chi tiết hoặc quy định, lưu ý trước khi vào thi.
             * 
             * @var string|null
             * @example Thí sinh có 90 phút hoàn thành 4 bài tập lập trình thuật toán. Không được chuyển tab hay mở devtools.
             */
            'description' => ['nullable', 'string'],

            /**
             * Hình thức tổ chức thi: PROGRAMMING (Lập trình thực hành), QUIZ (Trắc nghiệm/Cổ điển), HYBRID (Hỗn hợp).
             * 
             * @var string
             * @example PROGRAMMING
             */
            'type' => ['required', 'string', 'in:PROGRAMMING,QUIZ,HYBRID'],

            /**
             * Thời lượng làm bài thi tính bằng phút (từ 5 đến 600 phút).
             * 
             * @var int
             * @example 90
             */
            'duration_minutes' => ['required', 'integer', 'min:5', 'max:600'],

            /**
             * Giới hạn số lượt làm bài cho mỗi thí sinh (Mặc định 1 lượt).
             * 
             * @var int|null
             * @example 1
             */
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:100'],

            /**
             * Cấu hình an ninh giám sát & AI Anti-Cheat cho phòng thi.
             * 
             * @var array|null
             * @example {"prevent_tab_switch": true, "prevent_paste": true, "max_paste_chars": 50, "track_keystroke_dynamics": true, "ai_face_check": true}
             */
            'monitoring_config' => ['nullable', 'array'],
        ];
    }

    /**
     * Custom validation messages.
     */
    public function messages(): array
    {
        return [
            'course_id.required' => 'Vui lòng chọn khóa học cho kỳ thi.',
            'course_id.exists' => 'Khóa học được chọn không tồn tại.',
            'title.required' => 'Tiêu đề kỳ thi không được để trống.',
            'type.required' => 'Vui lòng chọn hình thức kỳ thi (PROGRAMMING, QUIZ, HYBRID).',
            'duration_minutes.required' => 'Vui lòng nhập thời lượng làm bài thi.',
            'duration_minutes.min' => 'Thời lượng làm bài tối thiểu là 5 phút.',
        ];
    }
}
