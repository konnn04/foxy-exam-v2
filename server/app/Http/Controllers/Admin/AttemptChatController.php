<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AttemptMessage;
use App\Models\ExamAttempt;
use App\Models\Violation;
use App\Services\Realtime;
use App\Services\TenantContext;
use App\Support\Risk;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Proctor side of an attempt's chat, and violations a proctor records by hand. */
class AttemptChatController extends Controller
{
    public const MAX_BODY = 1000;

    public function __construct(private TenantContext $tenant, private Realtime $realtime)
    {
    }

    private function attempt(int $id): ExamAttempt
    {
        abort_unless(in_array(Auth::user()?->role, ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER'], true), 403);
        $attempt = ExamAttempt::with('exam')->findOrFail($id);
        abort_unless($attempt->exam, 404);
        $this->tenant->enforceOwnership($attempt->exam);

        return $attempt;
    }

    /** GET /admin/attempts/{id}/chat?after=ID */
    public function index(Request $request, int $id): JsonResponse
    {
        $attempt = $this->attempt($id);
        $messages = AttemptMessage::where('exam_attempt_id', $attempt->id)->where('id', '>', (int) $request->query('after', 0))
            ->with('sender:id,name')->orderBy('id')->limit(200)->get();

        return response()->json(['data' => $messages->map->toPayload()->values()]);
    }

    /** POST /admin/attempts/{id}/chat */
    public function store(Request $request, int $id): JsonResponse
    {
        $attempt = $this->attempt($id);
        $data = $request->validate(['body' => ['required', 'string', 'max:' . self::MAX_BODY]]);
        if ($attempt->status !== 'IN_PROGRESS') {
            return response()->json(['message' => 'Phiên thi đã kết thúc, không gửi tin nhắn được nữa.'], 409);
        }
        $message = AttemptMessage::create([
            'exam_attempt_id' => $attempt->id,
            'sender_id' => Auth::id(),
            'sender_role' => 'PROCTOR',
            'body' => trim($data['body']),
        ])->load('sender:id,name');
        $this->realtime->chat($attempt, $message);

        return response()->json(['data' => $message->toPayload()], 201);
    }

    /** POST /admin/attempts/{id}/violations — a violation the proctor saw with their own eyes. */
    public function violation(Request $request, int $id)
    {
        $attempt = $this->attempt($id);
        $data = $request->validate([
            'severity' => ['required', 'in:LOW,MEDIUM,HIGH,CRITICAL'],
            'message' => ['required', 'string', 'max:500'],
        ]);
        Violation::create([
            'exam_attempt_id' => $attempt->id,
            'violation_type' => 'MANUAL',
            'severity' => $data['severity'],
            'details' => ['message' => trim($data['message']), 'source' => 'proctor', 'by' => Auth::id(), 'by_name' => Auth::user()->name],
            'is_reviewed' => true,
            'timestamp' => now(),
        ]);
        Risk::apply($attempt, Risk::weight($data['severity']));

        return back()->with('success', 'Đã ghi nhận vi phạm.');
    }
}
