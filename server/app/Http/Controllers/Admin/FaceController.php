<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\FaceReference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Staff side of the biometric reference photo: upload, delete, lock / unlock, and view. */
class FaceController extends Controller
{
    public function __construct(private TenantContext $tenant)
    {
    }

    private function student(int $id): User
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403);
        $user = User::findOrFail($id);
        $this->tenant->enforceOwnership($user);
        abort_unless($user->role === 'STUDENT', 404);

        return $user;
    }

    public function photo(int $id)
    {
        $user = $this->student($id);
        abort_unless(FaceReference::has($user), 404);

        return response(FaceReference::bytes($user), 200, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'private, max-age=60']);
    }

    public function upload(Request $request, int $id)
    {
        $request->validate(['photo' => ['required', 'file', 'mimetypes:image/jpeg,image/png', 'max:5120']]);
        $user = $this->student($id);
        $result = FaceReference::enroll($user, (string) file_get_contents($request->file('photo')->getRealPath()));
        if (!$result['ok']) {
            return back()->with('error', $result['message']);
        }
        $user->forceFill(['face_locked_at' => now()])->save();

        return back()->with('success', 'Đã lưu khuôn mặt của sinh viên.');
    }

    public function destroy(int $id)
    {
        FaceReference::delete($this->student($id));

        return back()->with('success', 'Đã xoá dữ liệu khuôn mặt.');
    }

    public function lock(Request $request, int $id)
    {
        $request->validate(['locked' => ['required', 'boolean']]);
        $user = $this->student($id);
        $user->forceFill(['face_locked_at' => $request->boolean('locked') ? now() : null])->save();

        return back()->with('success', $request->boolean('locked') ? 'Đã khoá đăng ký khuôn mặt.' : 'Đã mở khoá, sinh viên có thể đăng ký lại.');
    }
}
