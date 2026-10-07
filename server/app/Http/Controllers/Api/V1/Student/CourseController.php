<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use App\Models\ExamAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    /**
     * Lấy danh sách khóa học sinh viên đã ghi danh.
     * 
     * Trả về danh sách tất cả các khóa học mà sinh viên đang tham gia, kèm thông tin giảng viên và số lượng kỳ thi đang mở.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $courses = $user->enrolledCourses()
            ->with(['teacher:id,name,email,avatar', 'organization:id,name,code'])
            ->withCount(['exams' => fn($q) => $q->where('status', 'PUBLISHED')])
            ->latest('course_enrollments.created_at')
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'description' => $c->description,
                'enrolled_at' => $c->pivot?->enrolled_at ? \Carbon\Carbon::parse($c->pivot->enrolled_at)->toIso8601String() : null,
                'status' => $c->pivot?->status ?? 'ENROLLED',
                'teacher' => $c->teacher ? [
                    'id' => $c->teacher->id,
                    'name' => $c->teacher->name,
                    'email' => $c->teacher->email,
                    'avatar' => $c->teacher->avatar,
                ] : null,
                'organization_name' => $c->organization?->name,
                'exams_count' => $c->exams_count,
            ]);

        return response()->json([
            'success' => true,
            'data' => $courses,
        ]);
    }

    /**
     * Xem thông tin chi tiết khóa học và các kỳ thi đang mở.
     * 
     * Trả về thông tin chi tiết khóa học, giảng viên phụ trách và danh sách kỳ thi đã phát hành kèm trạng thái làm bài của thí sinh.
     */
    public function show(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();

        // Kiểm tra sinh viên đã đăng ký khóa học này chưa
        $isEnrolled = $user->enrolledCourses()->where('courses.id', $course->id)->exists();
        if (!$isEnrolled) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn chưa được ghi danh vào khóa học này.',
            ], 403);
        }

        $course->loadMissing(['teacher:id,name,email,avatar', 'organization:id,name,code']);

        $exams = Exam::where('course_id', $course->id)
            ->where('status', 'PUBLISHED')
            ->whereDoesntHave('excludedStudents', fn ($q) => $q->where('users.id', $user->id))
            ->with(['questionSet:id,name,type,max_score'])
            ->withCount(['programmingProblems'])
            ->orderBy('start_time', 'desc')
            ->get()
            ->map(function ($e) use ($user) {
                $latestAttempt = ExamAttempt::where('exam_id', $e->id)
                    ->where('user_id', $user->id)
                    ->latest()
                    ->first();

                $attemptsCount = ExamAttempt::where('exam_id', $e->id)
                    ->where('user_id', $user->id)
                    ->count();

                return [
                    'id' => $e->id,
                    'title' => $e->title,
                    'code' => $e->code,
                    'type' => $e->type,
                    'status' => $e->status,
                    'duration_minutes' => $e->duration_minutes,
                    'start_time' => $e->start_time?->toIso8601String(),
                    'end_time' => $e->end_time?->toIso8601String(),
                    'description' => $e->description,
                    'attempts_count' => $attemptsCount,
                    'latest_attempt' => $latestAttempt ? [
                        'id' => $latestAttempt->id,
                        'status' => $latestAttempt->status,
                        'score' => $latestAttempt->score,
                        'started_at' => $latestAttempt->started_at?->toIso8601String(),
                        'submitted_at' => $latestAttempt->submitted_at?->toIso8601String(),
                    ] : null,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => [
                'course' => [
                    'id' => $course->id,
                    'name' => $course->name,
                    'code' => $course->code,
                    'description' => $course->description,
                    'teacher' => $course->teacher ? [
                        'id' => $course->teacher->id,
                        'name' => $course->teacher->name,
                        'email' => $course->teacher->email,
                        'avatar' => $course->teacher->avatar,
                    ] : null,
                ],
                'exams' => $exams,
            ],
        ]);
    }

    /**
     * Lấy danh sách kỳ thi thuộc khóa học cụ thể.
     * 
     * Danh sách tất cả các bài thi đã công bố trong khuôn khổ khóa học và trạng thái lượt làm bài của sinh viên.
     */
    public function exams(Request $request, Course $course): JsonResponse
    {
        $user = $request->user();

        if (!$user->enrolledCourses()->where('courses.id', $course->id)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn chưa được ghi danh vào khóa học này.',
            ], 403);
        }

        $exams = Exam::where('course_id', $course->id)
            ->where('status', 'PUBLISHED')
            ->whereDoesntHave('excludedStudents', fn ($q) => $q->where('users.id', $user->id))
            ->with(['questionSet:id,name,type,max_score'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($e) use ($user) {
                $attempts = ExamAttempt::where('exam_id', $e->id)
                    ->where('user_id', $user->id)
                    ->latest()
                    ->get();
                $latestAttempt = $attempts->first();

                return [
                    'id' => $e->id,
                    'title' => $e->title,
                    'code' => $e->code,
                    'type' => $e->type,
                    'duration_minutes' => $e->duration_minutes,
                    'max_attempts' => $e->max_attempts, // null = không giới hạn
                    'attempts_count' => $attempts->count(),
                    'start_time' => $e->start_time?->toIso8601String(),
                    'end_time' => $e->end_time?->toIso8601String(),
                    'monitoring_config' => $e->monitoring_config,
                    'latest_attempt' => $latestAttempt ? [
                        'id' => $latestAttempt->id,
                        'status' => $latestAttempt->status,
                        'score' => $latestAttempt->score,
                        'started_at' => $latestAttempt->started_at?->toIso8601String(),
                        'submitted_at' => $latestAttempt->submitted_at?->toIso8601String(),
                    ] : null,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $exams,
        ]);
    }
}
