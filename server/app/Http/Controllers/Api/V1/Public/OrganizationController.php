<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;

class OrganizationController extends Controller
{
    /**
     * Lấy danh sách các trường / tổ chức công khai (Public Organizations).
     * 
     * Hỗ trợ ứng dụng máy trạm (Desktop Client) tải danh sách các trường học đối tác để sinh viên lựa chọn khi đăng nhập lần đầu.
     */
    public function publicList(): JsonResponse
    {
        $organizations = Organization::where('status', 'ACTIVE')
            ->where('is_public', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'slug', 'type'])
            ->map(fn($org) => [
                'id' => $org->id,
                'name' => $org->name,
                'code' => $org->code,
                'slug' => $org->slug,
                'type' => $org->type,
            ]);

        return response()->json([
            'success' => true,
            'data' => $organizations,
        ]);
    }
}
