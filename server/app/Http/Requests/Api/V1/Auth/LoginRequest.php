<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Tự động ánh xạ username hoặc email sang login nếu client truyền format cũ.
     */
    protected function prepareForValidation(): void
    {
        if (!$this->filled('org_code') && $this->filled('organization_code')) {
            $this->merge(['org_code' => $this->input('organization_code')]);
        }

        if (!$this->filled('login')) {
            if ($this->filled('username')) {
                $this->merge(['login' => $this->input('username')]);
            } elseif ($this->filled('email')) {
                $this->merge(['login' => $this->input('email')]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            /**
             * Mã định danh tổ chức / trường học (ví dụ: HCMUS, BKDN).
             * @example HCMUS
             */
            'org_code' => ['nullable', 'string', 'max:50'],

            /**
             * Tên đăng nhập, mã số sinh viên hoặc địa chỉ email.
             * @example student01
             */
            'login' => ['required', 'string'],

            /**
             * Mật khẩu đăng nhập tài khoản.
             * @example student123
             */
            'password' => ['required', 'string'],

            /**
             * Tên thiết bị đăng nhập (tùy chọn).
             * @example FoxyClient Desktop
             */
            'device_name' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'login.required' => 'Vui lòng cung cấp mã sinh viên, tên đăng nhập hoặc email.',
            'password.required' => 'Vui lòng cung cấp mật khẩu.',
        ];
    }
}
