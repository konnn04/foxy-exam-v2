<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BiometricConsent;
use App\Models\FaceChangeRequest;
use App\Models\User;
use App\Services\TenantContext;
use App\Support\FaceReference;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/** Org-wide view of the reference faces: who has one, who is locked, bulk actions and the change requests to decide. */
class FaceManagementController extends Controller
{
    private const PER_PAGE = 20;

    public function __construct(private TenantContext $tenant)
    {
    }

    private function guard(): void
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403);
    }

    private function students()
    {
        return User::where('organization_id', $this->tenant->current()->id)->where('role', 'STUDENT');
    }

    public function index(Request $request)
    {
        $this->guard();
        $tab = $request->query('tab') === 'requests' ? 'requests' : 'faces';
        $user = Auth::user();
        $org = $this->tenant->current();

        $base = [
            'user' => ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role,
                'organization' => ['id' => $org->id, 'name' => $org->name, 'code' => $org->code, 'type' => $org->type, 'plan' => $org->activeSubscription?->plan?->name ?? 'FREE']],
            'teams' => $this->tenant->teams(),
            'tab' => $tab,
            'counts' => [
                'students' => $this->students()->count(),
                'enrolled' => $this->students()->whereNotNull('face_enrolled_at')->count(),
                'locked' => $this->students()->whereNotNull('face_locked_at')->count(),
                'pending' => FaceChangeRequest::where('status', 'PENDING')->whereIn('user_id', $this->students()->select('id'))->count(),
            ],
        ];

        if ($tab === 'requests') {
            $status = in_array($request->query('status'), ['PENDING', 'APPROVED', 'REJECTED'], true) ? $request->query('status') : 'PENDING';
            $page = FaceChangeRequest::with(['user:id,name,username,email', 'decider:id,name'])
                ->whereIn('user_id', $this->students()->select('id'))->where('status', $status)->orderByDesc('id')->paginate(self::PER_PAGE)->withQueryString();

            return Inertia::render('Admin/Faces/Index', $base + [
                'rows' => $page->getCollection()->map(fn ($r) => [
                    'id' => $r->id, 'user_id' => $r->user_id, 'name' => $r->user?->name, 'username' => $r->user?->username, 'reason' => $r->reason, 'status' => $r->status,
                    'note' => $r->decision_note, 'decided_by' => $r->decider?->name, 'at' => $r->created_at?->toIso8601String(), 'decided_at' => $r->decided_at?->toIso8601String(),
                ])->values(),
                'listMeta' => ['total' => $page->total(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'filters' => ['status' => $status, 'q' => '']],
            ]);
        }

        $q = trim((string) $request->query('q', ''));
        $state = (string) $request->query('state', '');
        $query = $this->students()->select(['id', 'name', 'username', 'email', 'face_enrolled_at', 'face_locked_at'])
            ->when($q !== '', fn ($b) => $b->where(fn ($w) => $w->where('name', 'like', "%{$q}%")->orWhere('username', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%")))
            ->when($state === 'enrolled', fn ($b) => $b->whereNotNull('face_enrolled_at'))
            ->when($state === 'missing', fn ($b) => $b->whereNull('face_enrolled_at'))
            ->when($state === 'locked', fn ($b) => $b->whereNotNull('face_locked_at'))
            ->when($state === 'unlocked', fn ($b) => $b->whereNotNull('face_enrolled_at')->whereNull('face_locked_at'))
            ->orderBy('name');
        $page = $query->paginate(self::PER_PAGE)->withQueryString();
        $ids = $page->getCollection()->pluck('id');
        $consents = BiometricConsent::whereIn('user_id', $ids)->selectRaw('user_id, max(accepted_at) as last_at, count(*) as n')->groupBy('user_id')->get()->keyBy('user_id');
        $pending = FaceChangeRequest::where('status', 'PENDING')->whereIn('user_id', $ids)->pluck('user_id')->flip();

        return Inertia::render('Admin/Faces/Index', $base + [
            'rows' => $page->getCollection()->map(fn ($u) => [
                'id' => $u->id, 'name' => $u->name, 'username' => $u->username, 'email' => $u->email,
                'enrolled_at' => $u->face_enrolled_at?->toIso8601String(), 'locked' => $u->face_locked_at !== null,
                'consent_at' => $consents[$u->id]->last_at ?? null, 'consents' => (int) ($consents[$u->id]->n ?? 0), 'pending' => isset($pending[$u->id]),
            ])->values(),
            'listMeta' => ['total' => $page->total(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'filters' => ['state' => $state, 'q' => $q]],
        ]);
    }

    /** POST /admin/faces/bulk — lock | unlock | delete for the chosen students of this organization. */
    public function bulk(Request $request)
    {
        $this->guard();
        $data = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:500'], 'ids.*' => ['integer'], 'action' => ['required', 'in:lock,unlock,delete']]);
        $users = $this->students()->whereIn('id', $data['ids'])->get();
        foreach ($users as $u) {
            match ($data['action']) {
                'lock' => $u->face_enrolled_at ? $u->forceFill(['face_locked_at' => now()])->save() : null,
                'unlock' => $u->forceFill(['face_locked_at' => null])->save(),
                'delete' => FaceReference::delete($u),
            };
        }

        return back()->with('success', 'Đã áp dụng cho ' . $users->count() . ' sinh viên.');
    }

    /** POST /admin/faces/lock-all — lock every enrolled face of the organization (before the exam season). */
    public function lockAll()
    {
        $this->guard();
        $n = $this->students()->whereNotNull('face_enrolled_at')->whereNull('face_locked_at')->update(['face_locked_at' => now()]);

        return back()->with('success', "Đã khoá {$n} khuôn mặt.");
    }

    /** POST /admin/faces/requests/{id} — approve (the photo is unlocked) or reject. */
    public function decide(Request $request, int $id)
    {
        $this->guard();
        $data = $request->validate(['decision' => ['required', 'in:approve,reject'], 'note' => ['nullable', 'string', 'max:500']]);
        $row = FaceChangeRequest::with('user')->findOrFail($id);
        $this->tenant->enforceOwnership($row->user);
        abort_unless($row->status === 'PENDING', 409, 'Yêu cầu này đã được xử lý.');

        $approve = $data['decision'] === 'approve';
        $row->update(['status' => $approve ? 'APPROVED' : 'REJECTED', 'decided_by' => Auth::id(), 'decided_at' => now(), 'decision_note' => $data['note'] ?? null]);
        if ($approve) {
            $row->user->forceFill(['face_locked_at' => null])->save();
        }
        Notify::to($row->user, 'face_decision', $approve ? 'Yêu cầu đổi khuôn mặt đã được duyệt' : 'Yêu cầu đổi khuôn mặt bị từ chối', $approve ? 'Bạn có thể đăng ký lại khuôn mặt trong phòng chờ.' : ($data['note'] ?? null));

        return back()->with('success', $approve ? 'Đã duyệt và mở khoá khuôn mặt.' : 'Đã từ chối yêu cầu.');
    }
}
