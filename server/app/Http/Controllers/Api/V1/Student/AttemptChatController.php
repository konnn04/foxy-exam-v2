<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Admin\AttemptChatController as ProctorChat;
use App\Http\Controllers\Controller;
use App\Models\AttemptMessage;
use App\Models\ExamAttempt;
use App\Services\Realtime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Candidate side of the chat with the proctors. Only the owner of the attempt can read or write it. */
class AttemptChatController extends Controller
{
    public function __construct(private Realtime $realtime)
    {
    }

    private function mine(Request $request, int $id): ExamAttempt
    {
        return ExamAttempt::where('user_id', $request->user()->id)->findOrFail($id);
    }

    public function index(Request $request, int $id): JsonResponse
    {
        $attempt = $this->mine($request, $id);
        $messages = AttemptMessage::where('exam_attempt_id', $attempt->id)->where('id', '>', (int) $request->query('after', 0))
            ->with('sender:id,name')->orderBy('id')->limit(200)->get();

        return response()->json(['data' => $messages->map->toPayload()->values()]);
    }

    public function store(Request $request, int $id): JsonResponse
    {
        $attempt = $this->mine($request, $id);
        $data = $request->validate(['body' => ['required', 'string', 'max:' . ProctorChat::MAX_BODY]]);
        if ($attempt->status !== 'IN_PROGRESS') {
            return response()->json(['message' => 'Phiên thi đã kết thúc.'], 409);
        }
        $message = AttemptMessage::create([
            'exam_attempt_id' => $attempt->id,
            'sender_id' => $request->user()->id,
            'sender_role' => 'STUDENT',
            'body' => trim($data['body']),
        ])->load('sender:id,name');
        $this->realtime->chat($attempt, $message);

        return response()->json(['data' => $message->toPayload()], 201);
    }
}
