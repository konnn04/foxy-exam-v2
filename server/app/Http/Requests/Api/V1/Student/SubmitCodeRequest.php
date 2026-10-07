<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

class SubmitCodeRequest extends FormRequest
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
             * ID bài toán lập trình cần chấm điểm.
             * 
             * @var int
             * @example 1
             */
            'programming_problem_id' => ['required', 'integer', 'exists:programming_problems,id'],

            /**
             * Định danh ngôn ngữ lập trình được nộp (cpp, python, java, c).
             * 
             * @var string
             * @example cpp
             */
            'language' => ['required', 'string', 'max:30'],

            /**
             * Toàn bộ mã nguồn bài giải lập trình của thí sinh.
             * 
             * @var string
             * @example #include <iostream>\nusing namespace std;\nint main() { int a, b; if (cin >> a >> b) cout << a + b << endl; return 0; }
             */
            'source_code' => ['required', 'string'],
        ];
    }

    /**
     * Custom validation messages.
     */
    public function messages(): array
    {
        return [
            'programming_problem_id.required' => 'Vui lòng cung cấp ID bài toán lập trình.',
            'programming_problem_id.exists' => 'Bài toán lập trình không tồn tại trong hệ thống.',
            'language.required' => 'Vui lòng chọn ngôn ngữ lập trình.',
            'source_code.required' => 'Mã nguồn nộp bài không được để trống.',
        ];
    }
}
