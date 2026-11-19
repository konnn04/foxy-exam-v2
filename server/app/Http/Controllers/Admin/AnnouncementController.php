<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Organization;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/** Broadcast from the platform to the staff of the schools (arrives in their notification bell). */
class AnnouncementController extends Controller
{
    private const ROLES = ['ORG_ADMIN', 'TEACHER'];
    private const TYPES = ['UNIVERSITY', 'CENTER', 'INDIVIDUAL'];

    private function authorizePlatform(): void
    {
        abort_unless(Auth::user()?->role === 'SUPER_ADMIN' && app(TenantContext::class)->isRoot(), 403, 'Chỉ Super Admin ở ngữ cảnh nền tảng mới gửi được thông báo hàng loạt.');
    }

    /** @return array{scope:string,types:array<int,string>,org_ids:array<int,int>,roles:array<int,string>} */
    private function audience(Request $request): array
    {
        $data = $request->validate([
            'scope' => ['required', 'in:all,types,orgs'],
            'types' => ['nullable', 'array'],
            'types.*' => ['in:' . implode(',', self::TYPES)],
            'org_ids' => ['nullable', 'array', 'max:500'],
            'org_ids.*' => ['integer'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['in:' . implode(',', self::ROLES)],
        ]);

        return [
            'scope' => $data['scope'],
            'types' => array_values($data['types'] ?? []),
            'org_ids' => array_values(array_map('intval', $data['org_ids'] ?? [])),
            'roles' => array_values($data['roles']),
        ];
    }

    private function recipients(array $a): Builder
    {
        return User::query()
            ->whereIn('role', $a['roles'])
            ->where('status', 'ACTIVE')
            ->whereHas('organization', function ($o) use ($a) {
                $o->where('code', '!=', 'ROOT')->where('status', 'ACTIVE');
                if ($a['scope'] === 'types') {
                    $o->whereIn('type', $a['types'] ?: ['-']);
                } elseif ($a['scope'] === 'orgs') {
                    $o->whereIn('id', $a['org_ids'] ?: [0]);
                }
            });
    }

    public function index()
    {
        $this->authorizePlatform();
        $u = Auth::user();

        return Inertia::render('Admin/Announcements/Index', [
            'user' => ['id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'email' => $u->email, 'role' => $u->role],
            'teams' => [],
            'history' => Announcement::with('author:id,name')->latest()->limit(30)->get()->map(fn (Announcement $a) => [
                'id' => $a->id, 'title' => $a->title, 'body' => $a->body, 'url' => $a->url, 'audience' => $a->audience,
                'recipients' => $a->recipients_count, 'author' => $a->author?->name, 'at' => $a->created_at?->toIso8601String(),
            ]),
        ]);
    }

    /** POST /admin/announcements/preview: how many people would receive it. */
    public function preview(Request $request)
    {
        $this->authorizePlatform();

        return response()->json(['count' => $this->recipients($this->audience($request))->count()]);
    }

    public function store(Request $request)
    {
        $this->authorizePlatform();
        $a = $this->audience($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'body' => ['nullable', 'string', 'max:500'],
            // an internal path only: a notification must never be a way to send people to another site
            'url' => ['nullable', 'string', 'max:300', 'regex:#^/(?!/)#'],
        ]);

        $now = now();
        $total = 0;
        $this->recipients($a)->select('users.id')->chunkById(500, function ($users) use ($data, $now, &$total) {
            DB::table('user_notifications')->insert($users->map(fn ($u) => [
                'user_id' => $u->id, 'type' => 'announcement', 'title' => $data['title'], 'body' => $data['body'] ?? null,
                'url' => $data['url'] ?? null, 'created_at' => $now,
            ])->all());
            $total += $users->count();
        }, 'users.id', 'id');

        $announcement = Announcement::create([
            'title' => strip_tags($data['title']), 'body' => isset($data['body']) ? strip_tags($data['body']) : null, 'url' => $data['url'] ?? null,
            'audience' => $a, 'recipients_count' => $total, 'created_by' => Auth::id(),
        ]);
        Audit::record('announce.send', "Thông báo \"{$announcement->title}\" tới {$total} người", 'announcement', $announcement->id, ['scope' => $a['scope']]);

        return back()->with('success', "Đã gửi thông báo tới {$total} người.");
    }
}
