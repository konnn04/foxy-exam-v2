<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\SaveAnswerRequest;
use App\Http\Requests\Api\V1\Student\StartExamRequest;
use App\Models\ClassicalQuestion;
use App\Models\ClassicalQuestionAnswer;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptAnswer;
use App\Models\ProgrammingProblem;
use App\Models\Submission;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ExamController extends Controller
{
    /**
     * Xem thông tin chi tiết kỳ thi và trạng thái lượt làm bài.
     * 
     * Trả về thông tin kỳ thi, môn học, bộ đề thi, quy chế giám sát AI và lịch sử lượt thi gần nhất của thí sinh.
     */
    public function show(Request $request, Exam $exam): JsonResponse
    {
        $user = $request->user();

        // Kiểm tra sinh viên có thuộc khóa học của kỳ thi không
        if ($exam->course_id && !$user->enrolledCourses()->where('courses.id', $exam->course_id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không thuộc khóa học của kỳ thi này.',
            ], 403);
        }
        if ($exam->excludedStudents()->whereKey($user->id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Bạn không nằm trong danh sách dự thi của kỳ thi này.'], 403);
        }

        $exam->loadMissing(['course:id,name,code', 'questionSet:id,name,type,max_score']);

        $attempts = ExamAttempt::where('exam_id', $exam->id)
            ->where('user_id', $user->id)
            ->latest()
            ->get();

        $latestAttempt = $attempts->first();
        $aiCheck = AiService::checkExamRequirement($exam);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $exam->id,
                'title' => $exam->title,
                'code' => $exam->code,
                'type' => $exam->type,
                'status' => $exam->status,
                'duration_minutes' => $exam->duration_minutes,
                'start_time' => $exam->start_time?->toIso8601String(),
                'end_time' => $exam->end_time?->toIso8601String(),
                'description' => $exam->description,
                'monitoring_config' => $exam->monitoring_config,
                'ai_service' => $aiCheck,
                'can_start' => $aiCheck['available'],
                'course' => [
                    'id' => $exam->course?->id,
                    'name' => $exam->course?->name,
                    'code' => $exam->course?->code,
                ],
                'question_set' => $exam->questionSet ? [
                    'id' => $exam->questionSet->id,
                    'name' => $exam->questionSet->name,
                    'type' => $exam->questionSet->type,
                    'max_score' => $exam->questionSet->max_score,
                ] : null,
                'attempts_count' => $attempts->count(),
                'latest_attempt' => $latestAttempt ? [
                    'id' => $latestAttempt->id,
                    'status' => $latestAttempt->status,
                    'score' => $latestAttempt->score,
                    'started_at' => $latestAttempt->started_at?->toIso8601String(),
                    'submitted_at' => $latestAttempt->submitted_at?->toIso8601String(),
                ] : null,
            ],
        ]);
    }

    /**
     * Bắt đầu làm bài thi hoặc tiếp tục lượt thi đang dở (Resume).
     * 
     * Khởi tạo một lượt làm bài thi mới cho sinh viên hoặc khôi phục phiên đang làm dở (IN_PROGRESS), tính toán thời gian còn lại.
     */
    public function start(StartExamRequest $request, Exam $exam): JsonResponse
    {
        $user = $request->user();

        // Kiểm tra quyền ghi danh
        if ($exam->course_id && !$user->enrolledCourses()->where('courses.id', $exam->course_id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn chưa ghi danh vào môn học này.',
            ], 403);
        }
        if ($exam->excludedStudents()->whereKey($user->id)->exists()) {
            return response()->json(['success' => false, 'message' => 'Bạn không nằm trong danh sách dự thi của kỳ thi này.'], 403);
        }

        if ($exam->status !== 'PUBLISHED' && $exam->status !== 'IN_PROGRESS') {
            return response()->json([
                'success' => false,
                'message' => 'Kỳ thi hiện tại chưa mở hoặc đã kết thúc.',
            ], 400);
        }

        // Kiểm tra tính sẵn sàng của AI Service nếu kỳ thi yêu cầu giám sát AI
        $aiCheck = AiService::checkExamRequirement($exam);
        if (!$aiCheck['available']) {
            return response()->json([
                'success' => false,
                'error_code' => 'AI_SERVICE_UNAVAILABLE',
                'message' => $aiCheck['message'],
                'ai_status' => $aiCheck['status'],
            ], 503);
        }

        // 1. Kiểm tra xem có phiên đang làm dở (IN_PROGRESS) hay không -> Resume
        $activeAttempt = ExamAttempt::where('exam_id', $exam->id)
            ->where('user_id', $user->id)
            ->where('status', 'IN_PROGRESS')
            ->first();

        if ($activeAttempt) {
            app(\App\Services\Realtime::class)->lifecycle($activeAttempt, 'active');
            $elapsedSeconds = now()->diffInSeconds($activeAttempt->started_at);
            $totalSeconds = $exam->duration_minutes * 60;
            $timeRemaining = max(0, $totalSeconds - $elapsedSeconds);

            return response()->json([
                'success' => true,
                'message' => 'Tiếp tục bài thi đang làm dở.',
                'data' => [
                    'attempt_id' => $activeAttempt->id,
                    'attempt_number' => $activeAttempt->attempt_number,
                    'status' => $activeAttempt->status,
                    'started_at' => $activeAttempt->started_at?->toIso8601String(),
                    'duration_minutes' => $exam->duration_minutes,
                    'time_remaining_seconds' => $timeRemaining,
                    'exam' => [
                        'id' => $exam->id,
                        'title' => $exam->title,
                        'code' => $exam->code,
                        'type' => $exam->type,
                        'monitoring_config' => $exam->monitoring_config,
                    ],
                ],
            ]);
        }

        // 2. Tạo lượt thi mới — chỉ trong khung giờ của kỳ thi, và trong hạn mức
        // `max_attempts` (NULL = không giới hạn).
        if ($reason = $exam->scheduleBlockReason()) {
            return response()->json([
                'success' => false,
                'error_code' => 'OUTSIDE_SCHEDULE',
                'message' => $reason,
            ], 403);
        }

        $pastAttemptsCount = ExamAttempt::where('exam_id', $exam->id)
            ->where('user_id', $user->id)
            ->count();

        if ($exam->max_attempts !== null && $pastAttemptsCount >= $exam->max_attempts) {
            return response()->json([
                'success' => false,
                'message' => "Bạn đã dùng hết số lượt thi cho phép ({$pastAttemptsCount}/{$exam->max_attempts}) cho kỳ thi này.",
            ], 403);
        }

        $attempt = ExamAttempt::create([
            'exam_id' => $exam->id,
            'user_id' => $user->id,
            // Số lớn nhất + 1 (không dùng count + 1): admin có thể đã xoá 1 lượt ở giữa,
            // còn (exam_id, user_id, attempt_number) là unique.
            'attempt_number' => (int) ExamAttempt::where('exam_id', $exam->id)->where('user_id', $user->id)->max('attempt_number') + 1,
            'status' => 'IN_PROGRESS',
            'started_at' => now(),
            'session_token' => Str::random(40),
            'device_info' => $request->input('device_info'),
        ]);
        app(\App\Services\Realtime::class)->lifecycle($attempt, 'active');

        return response()->json([
            'success' => true,
            'message' => 'Bắt đầu làm bài thi thành công.',
            'data' => [
                'attempt_id' => $attempt->id,
                'attempt_number' => $attempt->attempt_number,
                'status' => $attempt->status,
                'started_at' => $attempt->started_at->toIso8601String(),
                'duration_minutes' => $exam->duration_minutes,
                'time_remaining_seconds' => $exam->duration_minutes * 60,
                'exam' => [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'code' => $exam->code,
                    'type' => $exam->type,
                    'monitoring_config' => $exam->monitoring_config,
                ],
            ],
        ]);
    }

    /**
     * Tải toàn bộ nội dung đề thi và bài làm đã lưu để thí sinh làm bài.
     * 
     * Lấy danh sách câu hỏi trắc nghiệm, bài tập tự luận hoặc bài toán lập trình. BẢO MẬT: Loại bỏ hoàn toàn đáp án đúng (is_correct) và các test case ẩn.
     */
    public function take(Request $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $user = $request->user();

        if ($attempt->exam_id !== $exam->id || $attempt->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền truy cập lượt thi này.',
            ], 403);
        }

        if ($attempt->status === 'SUBMITTED' || $attempt->status === 'FORCE_ENDED') {
            return response()->json([
                'success' => false,
                'message' => 'Bài thi đã được nộp, không thể tiếp tục làm bài.',
            ], 400);
        }

        // Tính thời gian còn lại
        $elapsedSeconds = now()->diffInSeconds($attempt->started_at);
        $totalSeconds = $exam->duration_minutes * 60;
        $timeRemaining = max(0, $totalSeconds - $elapsedSeconds);

        $exam->loadMissing('questionSet');
        $isClassical = ($exam->type === 'QUIZ') || ($exam->questionSet?->type === 'CLASSICAL');

        $questionsData = [];
        $problemsData = [];

        if ($isClassical) {
            // Lấy câu hỏi cổ điển (Trắc nghiệm, tự luận)
            // The paper of THIS attempt: honours the set's "limit_questions" / difficulty ratio (seeded by attempt id)
            $classicalQuestions = $exam->questionSet
                ? \App\Support\QuestionSettings::draw($exam->questionSet, $attempt->id)
                : collect();

            // Lấy câu trả lời đã lưu của sinh viên
            $savedAnswers = ExamAttemptAnswer::where('exam_attempt_id', $attempt->id)
                ->get()
                ->keyBy('classical_question_id');

            $questionsData = $classicalQuestions->map(function ($q) use ($savedAnswers) {
                $saved = $savedAnswers->get($q->id);

                return [
                    'id' => $q->id,
                    'type' => $q->type,
                    'content' => $q->content,
                    'points' => $q->points,
                    'difficulty' => $q->difficulty,
                    'order' => $q->order,
                    'parent_id' => $q->parent_id,
                    'image' => $q->image,
                    'skill' => $q->skill,
                    // BẢO MẬT: settings đã lọc đáp án (QuestionSettings::forClient); không bao giờ gửi is_true / is_correct
                    'settings' => \App\Support\QuestionSettings::forClient($q),
                    'options' => $q->answers->map(fn($a) => [
                        'id' => $a->id,
                        'content' => $a->content,
                        'order' => $a->order,
                    ]),
                    'saved_answer' => $saved ? [
                        'answer_id' => $saved->answer_id,
                        'selected_answer_ids' => $saved->selected_answer_ids,
                        'answer_content' => $saved->answer_content,
                    ] : null,
                ];
            });
        } else {
            // Lấy bài toán lập trình
            $problems = ProgrammingProblem::where(function ($q) use ($exam) {
                $q->where('exam_id', $exam->id);
                if ($exam->question_set_id) {
                    $q->orWhere('question_set_id', $exam->question_set_id);
                }
            })
            ->with(['testCases' => fn($q) => $q->where('is_sample', true)])
            ->orderBy('order')
            ->get();

            $savedSubmissions = Submission::where('exam_attempt_id', $attempt->id)
                ->get()
                ->keyBy('programming_problem_id');

            $problemsData = $problems->map(function ($p) use ($savedSubmissions) {
                $sub = $savedSubmissions->get($p->id);

                return [
                    'id' => $p->id,
                    'title' => $p->title,
                    'description' => $p->description,
                    'difficulty' => $p->difficulty,
                    'time_limit_ms' => $p->time_limit_ms,
                    'memory_limit_mb' => $p->memory_limit_mb,
                    'allowed_languages' => $p->allowed_languages ?? ['cpp', 'python', 'java'],
                    'starter_templates' => $p->starter_templates,
                    'order' => $p->order,
                    // BẢO MẬT: CHỈ gửi sample test case. KHÔNG gửi secret test case!
                    'sample_test_cases' => $p->testCases->map(fn($tc) => [
                        'id' => $tc->id,
                        'input_data' => $tc->input_data,
                        'expected_output' => $tc->expected_output,
                    ]),
                    'saved_submission' => $sub ? [
                        'language' => $sub->language,
                        'source_code' => $sub->source_code,
                        'status' => $sub->status,
                    ] : null,
                ];
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'attempt_id' => $attempt->id,
                'status' => $attempt->status,
                'started_at' => $attempt->started_at?->toIso8601String(),
                'duration_minutes' => $exam->duration_minutes,
                'time_remaining_seconds' => $timeRemaining,
                'is_classical' => $isClassical,
                'questions' => $questionsData,
                'problems' => $problemsData,
            ],
        ]);
    }

    /**
     * Lưu câu trả lời tự động trong quá trình làm bài (Autosave).
     * 
     * Hỗ trợ tự động lưu đáp án trắc nghiệm, nội dung tự luận hoặc mã nguồn nháp của bài toán lập trình theo thời gian thực.
     */
    public function saveAnswer(SaveAnswerRequest $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $user = $request->user();

        if ($attempt->exam_id !== $exam->id || $attempt->user_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Không có quyền truy cập.'], 403);
        }

        if ($attempt->status === 'SUBMITTED' || $attempt->status === 'FORCE_ENDED') {
            return response()->json(['success' => false, 'message' => 'Bài thi đã được nộp.'], 400);
        }

        // Xử lý câu hỏi trắc nghiệm / tự luận cổ điển
        if ($request->has('question_id')) {
            $validated = $request->validate([
                'question_id' => ['required', 'exists:classical_questions,id'],
                'answer_id' => ['nullable', 'exists:classical_question_answers,id'],
                'selected_answer_ids' => ['nullable', 'array'],
                'selected_answer_ids.*' => ['integer', 'exists:classical_question_answers,id'],
                'answer_content' => ['nullable', 'string'],
            ]);

            ExamAttemptAnswer::updateOrCreate(
                [
                    'exam_attempt_id' => $attempt->id,
                    'classical_question_id' => $validated['question_id'],
                ],
                [
                    'answer_id' => $validated['answer_id'] ?? null,
                    'selected_answer_ids' => $validated['selected_answer_ids'] ?? null,
                    'answer_content' => $validated['answer_content'] ?? null,
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Đã lưu câu trả lời thành công.',
                'saved_at' => now()->toIso8601String(),
            ]);
        }

        // Xử lý bài toán lập trình (lưu mã nguồn nháp)
        if ($request->has('problem_id')) {
            $validated = $request->validate([
                'problem_id' => ['required', 'exists:programming_problems,id'],
                'language' => ['required', 'string'],
                'source_code' => ['required', 'string'],
            ]);

            Submission::updateOrCreate(
                [
                    'exam_attempt_id' => $attempt->id,
                    'programming_problem_id' => $validated['problem_id'],
                ],
                [
                    'language' => $validated['language'],
                    'source_code' => $validated['source_code'],
                    'status' => 'PENDING',
                    'submitted_at' => now(),
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Đã lưu mã nguồn nháp thành công.',
                'saved_at' => now()->toIso8601String(),
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Thiếu dữ liệu câu trả lời (question_id hoặc problem_id).',
        ], 422);
    }

    /**
     * Nộp bài thi chính thức và tự động chấm điểm.
     * 
     * Kết thúc phiên làm bài của thí sinh, khóa lượt thi và tự động chấm điểm toàn bộ câu hỏi trắc nghiệm khách quan (Single/Multiple choice).
     */
    public function submit(Request $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $user = $request->user();

        if ($attempt->exam_id !== $exam->id || $attempt->user_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Không có quyền truy cập.'], 403);
        }

        if ($attempt->status === 'SUBMITTED') {
            return response()->json(['success' => false, 'message' => 'Bài thi đã được nộp trước đó.'], 400);
        }

        $attempt = app(\App\Services\AttemptFinisher::class)->submit($attempt);
        $finalScore = $attempt->score;

        return response()->json([
            'success' => true,
            'message' => 'Nộp bài thi thành công.',
            'data' => [
                'attempt_id' => $attempt->id,
                'status' => 'SUBMITTED',
                'submitted_at' => $attempt->submitted_at->toIso8601String(),
                'score' => $finalScore,
            ],
        ]);
    }

    /**
     * Xem lại kết quả bài làm, điểm số và đáp án chi tiết sau khi thi.
     * 
     * Trả về bảng điểm tổng kết, chi tiết từng câu trả lời đúng/sai của thí sinh và đáp án đối soát sau khi kỳ thi đã được nộp.
     */
    public function review(Request $request, Exam $exam, ExamAttempt $attempt): JsonResponse
    {
        $user = $request->user();

        if ($attempt->exam_id !== $exam->id || $attempt->user_id !== $user->id) {
            return response()->json(['success' => false, 'message' => 'Không có quyền truy cập.'], 403);
        }

        if ($attempt->status !== 'SUBMITTED' && $attempt->status !== 'FORCE_ENDED') {
            return response()->json(['success' => false, 'message' => 'Bài thi chưa nộp, không thể xem lại.'], 400);
        }

        $answers = ExamAttemptAnswer::where('exam_attempt_id', $attempt->id)
            ->with(['question.answers'])
            ->get()
            ->map(fn($a) => [
                'question_id' => $a->classical_question_id,
                'type' => $a->question?->type,
                'content' => $a->question?->content,
                'explanation' => $a->question?->explanation,
                'points' => $a->question?->points,
                'score_earned' => $a->score,
                'is_correct' => $a->is_correct,
                'selected_answer_id' => $a->answer_id,
                'selected_answer_ids' => $a->selected_answer_ids,
                'answer_content' => $a->answer_content,
                // Answer key shown only here, after the attempt is submitted
                'is_true' => $a->question?->type === 'TRUE_FALSE' ? (bool) $a->question->is_true : null,
                'blanks' => $a->question?->type === 'MULTIPLE_FILL_IN_BLANK' ? ($a->question->settings['blanks'] ?? []) : null,
                'reference' => $a->question?->type === 'SHORT_ANSWER' ? ($a->question->settings['reference'] ?? null) : null,
                'pending_review' => $a->is_correct === null && in_array($a->question?->type, ['ESSAY', 'SHORT_ANSWER', 'MULTIPLE_FILL_IN_BLANK'], true),
                'options' => $a->question?->answers->map(fn($opt) => [
                    'id' => $opt->id,
                    'content' => $opt->content,
                    'is_correct' => $opt->is_correct,
                ]),
            ]);

        $submissions = Submission::where('exam_attempt_id', $attempt->id)
            ->with('problem:id,title,difficulty')
            ->get()
            ->map(fn($s) => [
                'problem_id' => $s->programming_problem_id,
                'problem_title' => $s->problem?->title,
                'language' => $s->language,
                'source_code' => $s->source_code,
                'status' => $s->status,
                'score' => $s->score,
                'passed_cases_count' => $s->passed_cases_count,
                'total_cases_count' => $s->total_cases_count,
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'attempt_id' => $attempt->id,
                'score' => $attempt->score,
                'started_at' => $attempt->started_at?->toIso8601String(),
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                'answers' => $answers,
                'submissions' => $submissions,
            ],
        ]);
    }
}
