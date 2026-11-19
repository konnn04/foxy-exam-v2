<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\TenantContext;
use App\Support\SiteSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

/** White-label editor of the public website. Platform (ROOT) Super Admin only; EnforceContextScope guards the path too. */
class SiteSettingsController extends Controller
{
    private function authorizePlatform(): void
    {
        abort_unless(
            Auth::user()?->role === 'SUPER_ADMIN' && app(TenantContext::class)->isRoot(),
            403,
            'Chỉ Super Admin ở ngữ cảnh nền tảng mới được chỉnh nội dung website.',
        );
    }

    public function show()
    {
        $this->authorizePlatform();
        $user = Auth::user();

        return Inertia::render('Admin/Site/Edit', [
            'user' => ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role],
            'teams' => [],
            ...SiteSettings::forEditor(),
        ]);
    }

    public function update(Request $request)
    {
        $this->authorizePlatform();
        $data = $request->validate(['values' => ['required', 'array']]);
        SiteSettings::save($data['values']);
        \App\Support\Audit::record('site.update', 'Cập nhật nội dung website', null, null, ['fields' => count($data['values'])]);

        return back()->with('success', 'Đã lưu nội dung website.');
    }

    public function upload(Request $request)
    {
        $this->authorizePlatform();
        $request->validate(['file' => ['required', 'image', 'mimes:png,jpg,jpeg,webp,gif', 'max:5120']]);
        $path = $request->file('file')->store('site', 'public');

        return response()->json(['url' => Storage::disk('public')->url($path)]);
    }
}
