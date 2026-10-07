<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

class RecordViolationRequest extends FormRequest
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
             * Mã định danh loại vi phạm an ninh phòng thi (TAB_SWITCH, BULK_PASTE, DEVTOOLS_OPENED, MULTIPLE_PEOPLE, NO_FACE_DETECTED...).
             * 
             * @var string
             * @example TAB_SWITCH
             */
            'violation_type' => ['required', 'string', 'max:50'],

            /**
             * Mức độ nghiêm trọng của hành vi vi phạm.
             * 
             * @var string
             * @example MEDIUM
             */
            'severity' => ['required', 'string', 'in:LOW,MEDIUM,HIGH,CRITICAL'],

            /**
             * Chi tiết ngữ cảnh phát hiện vi phạm (thời lượng rời màn hình, thông tin thiết bị phụ...).
             * 
             * @var array|null
             * @example {"reason": "Rời khỏi màn hình bài thi sang ứng dụng khác", "duration_ms": 2500}
             */
            'details' => ['nullable', 'array'],

            /**
             * Đường dẫn URL ảnh chụp chứng cứ vi phạm từ webcam hoặc ảnh chụp màn hình.
             * 
             * @var string|null
             * @example https://storage.foxyexam.com/evidence/violation_snap_01.jpg
             */
            'evidence_url' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Custom validation messages.
     */
    public function messages(): array
    {
        return [
            'violation_type.required' => 'Vui lòng cung cấp mã loại vi phạm an ninh.',
            'severity.required' => 'Vui lòng chọn mức độ nghiêm trọng vi phạm.',
            'severity.in' => 'Mức độ nghiêm trọng phải thuộc một trong các giá trị: LOW, MEDIUM, HIGH, CRITICAL.',
        ];
    }
}
