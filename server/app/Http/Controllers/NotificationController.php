<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The bell: the newest notifications of the signed-in user (web session or bearer token), and marking them read. */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = UserNotification::where('user_id', $user->id)->when($request->query('before'), fn ($q, $b) => $q->where('id', '<', (int) $b))->orderByDesc('id')->limit(30)->get();

        return response()->json(['data' => $rows->map->toPayload()->values(), 'unread' => UserNotification::where('user_id', $user->id)->whereNull('read_at')->count()]);
    }

    public function read(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['nullable', 'array', 'max:100'], 'ids.*' => ['integer']]);
        UserNotification::where('user_id', $request->user()->id)->whereNull('read_at')
            ->when(!empty($data['ids']), fn ($q) => $q->whereIn('id', $data['ids']))->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
