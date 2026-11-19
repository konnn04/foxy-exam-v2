<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Services\TenantContext;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/** Inbox of pilot requests from the public site. Platform Super Admin only. */
class LeadController extends Controller
{
    private function authorizePlatform(): void
    {
        abort_unless(Auth::user()?->role === 'SUPER_ADMIN' && app(TenantContext::class)->isRoot(), 403, 'Chỉ Super Admin ở ngữ cảnh nền tảng mới xem được hộp thư thí điểm.');
    }

    public function index(Request $request)
    {
        $this->authorizePlatform();
        $user = Auth::user();

        $status = in_array($request->query('status'), Lead::STATUSES, true) ? $request->query('status') : null;
        $q = trim((string) $request->query('q', ''));

        $leads = Lead::query()
            ->with('handler:id,name')
            ->when($status, fn ($x) => $x->where('status', $status))
            ->when($q !== '', fn ($x) => $x->where(fn ($w) => $w
                ->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%")
                ->orWhere('organization', 'like', "%{$q}%")->orWhere('phone', 'like', "%{$q}%")))
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Lead $l) => [
                'id' => $l->id, 'name' => $l->name, 'email' => $l->email, 'phone' => $l->phone,
                'organization' => $l->organization, 'locale' => $l->locale, 'status' => $l->status, 'note' => $l->note,
                'handler' => $l->handler?->name, 'at' => $l->created_at?->toIso8601String(),
                'terms_at' => $l->terms_accepted_at?->toIso8601String(), 'terms_hash' => substr($l->terms_hash, 0, 12),
            ]);

        return Inertia::render('Admin/Leads/Index', [
            'user' => ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'role' => $user->role],
            'teams' => [],
            'leads' => $leads,
            'filters' => ['status' => $status, 'q' => $q],
            'counts' => array_merge(['ALL' => Lead::count()], Lead::selectRaw('status, count(*) c')->groupBy('status')->pluck('c', 'status')->all()),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $this->authorizePlatform();
        $lead = Lead::findOrFail($id);
        $data = $request->validate([
            'status' => ['required', 'in:' . implode(',', Lead::STATUSES)],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $before = $lead->status;
        $lead->update(['status' => $data['status'], 'note' => $data['note'] ?? null, 'handled_by' => Auth::id()]);
        Audit::record('lead.update', "Yêu cầu thí điểm #{$lead->id}: {$before} → {$lead->status}", 'lead', $lead->id);

        return back()->with('success', 'Đã cập nhật yêu cầu.');
    }
}
