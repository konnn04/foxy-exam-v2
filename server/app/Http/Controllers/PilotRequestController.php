<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\User;
use App\Support\Notify;
use Illuminate\Http\Request;

/** Public "register a pilot" form. Throttled by the route; consent is mandatory and stored with the request. */
class PilotRequestController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email:rfc', 'max:190'],
            'phone' => ['required', 'string', 'max:40'],
            'organization' => ['nullable', 'string', 'max:190'],
            'locale' => ['nullable', 'in:vi,en'],
            'terms_accepted' => ['accepted'],
            'terms_hash' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/'],
            'website' => ['nullable', 'max:0'], // honeypot: humans leave it empty
        ]);

        // the same person pressing twice (or a refresh) must not create a second row
        $duplicate = Lead::where('email', $data['email'])->where('created_at', '>=', now()->subHour())->exists();

        if (!$duplicate) {
            $lead = Lead::create([
                'name' => strip_tags($data['name']),
                'email' => $data['email'],
                'phone' => strip_tags($data['phone']),
                'organization' => isset($data['organization']) ? strip_tags($data['organization']) : null,
                'locale' => $data['locale'] ?? 'vi',
                'terms_accepted_at' => now(),
                'terms_hash' => $data['terms_hash'],
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            ]);

            User::where('role', 'SUPER_ADMIN')->pluck('id')->each(fn ($id) => Notify::to(
                $id,
                'lead',
                'Có yêu cầu thí điểm mới',
                "{$lead->name} · {$lead->organization}",
                '/admin/leads',
            ));
        }

        return response()->json(['ok' => true]);
    }
}
