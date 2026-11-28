<?php

namespace App\Http\Controllers;

use App\Services\LandingChat;
use App\Support\PublicFacts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** Public assistant of the landing page (POST /chat, server-sent events) and the facts it reads (GET /api/v1/public/facts). */
class LandingChatController extends Controller
{
    public function facts()
    {
        return response()->json(PublicFacts::all())->header('Cache-Control', 'public, max-age=60');
    }

    public function chat(Request $request, LandingChat $chat)
    {
        if (!LandingChat::available()) {
            return response()->json(['message' => 'Trợ lý AI đang tắt.'], 503);
        }

        $v = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:30'],
            'messages.*.role' => ['required', 'in:user,assistant'],
            'messages.*.content' => ['required', 'string', 'max:2000'],
            'lang' => ['nullable', 'in:vi,en'],
        ]);

        // a daily budget for the whole site, on top of the per-IP throttle of the route
        $key = 'landing_chat:' . now()->format('Ymd');
        Cache::add($key, 0, now()->endOfDay());
        if (Cache::increment($key) > (int) config('services.landing_chat.daily_limit', 3000)) {
            return response()->json(['message' => 'Trợ lý đã trả lời rất nhiều câu hỏi hôm nay, thầy cô vui lòng liên hệ trực tiếp.'], 429);
        }

        // the last 10 turns are enough context and keep every request small and fast
        $history = array_slice(array_map(fn ($m) => ['role' => $m['role'], 'content' => $m['content']], $v['messages']), -10);
        $lang = $v['lang'] ?? 'vi';

        return response()->stream(function () use ($chat, $history, $lang) {
            @set_time_limit(90);
            $emit = function (string $event, array $data) {
                echo "event: {$event}\ndata: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
                if (ob_get_level() > 0) {
                    @ob_flush();
                }
                flush();
            };
            $chat->run($history, $lang, $emit);
            $emit('done', []);
        }, 200, [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
