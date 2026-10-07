<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;

class StudentExamLoginRequest extends FormRequest
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
             * Mã định danh tổ chức / trường học (ví dụ: HCMUS, BKDN).
             * 
             * @var string|null
             * @example HCMUS
             */
            'org_code' => ['nullable', 'string', 'max:50'],

            /**
             * Mã phòng thi / kỳ thi sinh viên cần tham gia (Tùy chọn. Nếu bỏ trống sẽ đăng nhập cổng Portal sinh viên).
             * 
             * @var string|null
             * @example FOXY-ABC123
             */
            'exam_code' => ['nullable', 'string', 'max:50'],

            /**
             * Tên đăng nhập hoặc mã số sinh viên (MSSV).
             * 
             * @var string
             * @example student01
             */
            'username' => ['nullable', 'string', 'max:100'],

            /**
             * Trường đăng nhập thay thế (MSSV hoặc email).
             * 
             * @var string|null
             * @example student01
             */
            'login' => ['nullable', 'string', 'max:100'],

            /**
             * Mật khẩu đăng nhập tài khoản sinh viên.
             * 
             * @var string
             * @example student123
             */
            'password' => ['required', 'string'],

            /**
             * Thông tin môi trường thiết bị của sinh viên (Client Desktop).
             * 
             * @var array|null
             * @example {"os": "windows", "app_version": "1.0.0", "screen": "1920x1080"}
             */
            'device_info' => ['nullable', 'array'],
        ];
    }

    /**
     * Prepare inputs before validation.
     */
    protected function prepareForValidation(): void
    {
        if (!$this->has('org_code') && $this->has('organization_code')) {
            $this->merge(['org_code' => $this->input('organization_code')]);
        }
        if (!$this->has('username') && $this->has('login')) {
            $this->merge(['username' => $this->input('login')]);
        }
        if (!$this->has('login') && $this->has('username')) {
            $this->merge(['login' => $this->input('username')]);
        }
    }

    /**
     * Custom error messages for validation.
     */
    public function messages(): array
    {
        return [
            'password.required' => 'Vui lòng cung cấp mật khẩu sinh viên.',
        ];
    }
}
