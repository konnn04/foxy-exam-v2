<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

class RecordOpLogRequest extends FormRequest
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
             * ID bài toán lập trình đang thao tác biên tập (tùy chọn).
             * 
             * @var int|null
             * @example 1
             */
            'programming_problem_id' => ['nullable', 'integer'],

            /**
             * Số thứ tự gói dữ liệu thao tác (batch sequence, tăng dần từ 1).
             * 
             * @var int
             * @example 5
             */
            'batch_seq' => ['required', 'integer', 'min:1'],

            /**
             * Tổng số lượt nhấn phím (keystrokes) ghi nhận trong khoảng thời gian của batch.
             * 
             * @var int
             * @example 38
             */
            'keystroke_count' => ['required', 'integer', 'min:0'],

            /**
             * Số lần phát sinh sự kiện dán văn bản (Paste).
             * 
             * @var int
             * @example 0
             */
            'paste_event_count' => ['required', 'integer', 'min:0'],

            /**
             * Cờ phát hiện vi phạm hành vi tự động từ Client (Bulk paste, mã AI bất thường...).
             * 
             * @var array|null
             * @example {"bulk_insert": false, "chars_count": 0}
             */
            'synthetic_flags' => ['nullable', 'array'],

            /**
             * Dữ liệu thô chứa chi tiết luồng ký tự hoặc thao tác delta (tùy chọn phục vụ Replay).
             * 
             * @var string|null
             * @example [{"op":"insert","pos":10,"text":"count"}]
             */
            'raw_ops_payload' => ['nullable', 'string'],
        ];
    }
}
