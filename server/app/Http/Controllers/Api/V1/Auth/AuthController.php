<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Đăng nhập tài khoản sinh viên.
     * 
     * Xác thực thông tin sinh viên bằng tên đăng nhập/mã sinh viên/email và mật khẩu, trả về Sanctum Bearer Token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $orgCode = $request->input('org_code');
        $loginIdentifier = $request->input('login');
        $password = (string) $request->input('password');

        $userQuery = User::with('organization');

        if (!empty($orgCode)) {
            $org = \App\Models\Organization::where('code', strtoupper($orgCode))->first();
            if (!$org) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mã tổ chức hoặc trường học không tồn tại.',
                ], 404);
            }
            $userQuery->where('organization_id', $org->id);
        }

        $user = $userQuery->where(function ($q) use ($loginIdentifier) {
            $q->where('email', $loginIdentifier)
              ->orWhere('username', $loginIdentifier);
        })->first();

        if (!$user || !Hash::check($password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Tên đăng nhập hoặc mật khẩu không chính xác.',
            ], 401);
        }

        if ($user->role !== 'STUDENT') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản này không phải là tài khoản sinh viên.',
            ], 403);
        }

        if ($user->status === 'SUSPENDED') {
            return response()->json([
                'success' => false,
                'message' => 'Tài khoản sinh viên này đã bị khóa hoặc tạm ngưng.',
            ], 403);
        }

        // Tạo Sanctum access token
        $deviceName = $request->input('device_name') ?? 'FoxyClient';
        $token = $user->createToken($deviceName, ['student'])->plainTextToken;

        $userData = [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'role' => $user->role,
            'organization' => $user->organization ? [
                'id' => $user->organization->id,
                'name' => $user->organization->name,
                'code' => $user->organization->code,
            ] : null,
        ];

        return response()->json([
            'success' => true,
            'message' => 'Đăng nhập sinh viên thành công.',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $userData,
            'data' => [
                'token_type' => 'Bearer',
                'access_token' => $token,
                'token' => $token,
                'user' => $userData,
            ],
        ]);
    }

    /**
     * Lấy thông tin tài khoản sinh viên đang đăng nhập.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('organization');

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'name' => $user->name,
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'date_of_birth' => $user->date_of_birth ? $user->date_of_birth->format('Y-m-d') : null,
                'address' => $user->address,
                'avatar' => $user->avatar,
                'role' => $user->role,
                'status' => $user->status,
                'organization' => $user->organization ? [
                    'id' => $user->organization->id,
                    'name' => $user->organization->name,
                    'code' => $user->organization->code,
                    'type' => $user->organization->type,
                ] : null,
            ],
        ]);
    }

    /**
     * Đăng xuất tài khoản sinh viên và thu hồi access token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Đăng xuất thành công.',
        ]);
    }
}
