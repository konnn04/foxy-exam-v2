<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

class StartExamRequest extends FormRequest
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
             * Thông tin thiết bị và môi trường làm bài thi của thí sinh (HĐH, trình duyệt, độ phân giải màn hình).
             * 
             * @var array|null
             * @example {"os": "windows", "browser": "Chrome 128", "screen": "1920x1080"}
             */
            'device_info' => ['nullable', 'array'],
        ];
    }
}
