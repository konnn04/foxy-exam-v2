<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\ExamAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Lấy tổng quan bảng điều khiển sinh viên (Dashboard).
     * 
     * Tổng hợp số liệu thống kê học tập, danh sách khóa học đã tham gia, các kỳ thi sắp diễn ra và lịch sử các lượt làm bài gần nhất.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $enrolledCourses = $user->enrolledCourses()
            ->with(['teacher:id,name,email,avatar'])
            ->withCount(['exams' => fn($q) => $q->where('status', 'PUBLISHED')])
            ->get();

        $enrolledCourseIds = $enrolledCourses->pluck('id');

        // Upcoming or active published exams from enrolled courses
        $upcomingExams = Exam::whereIn('course_id', $enrolledCourseIds)
            ->where('status', 'PUBLISHED')
            ->with(['course:id,name,code', 'questionSet:id,name,type,max_score'])
            ->orderBy('start_time')
            ->take(5)
            ->get()
            ->map(function ($exam) use ($user) {
                $latestAttempt = ExamAttempt::where('exam_id', $exam->id)
                    ->where('user_id', $user->id)
                    ->latest()
                    ->first();

                return [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'code' => $exam->code,
                    'type' => $exam->type,
                    'status' => $exam->status,
                    'duration_minutes' => $exam->duration_minutes,
                    'start_time' => $exam->start_time?->toIso8601String(),
                    'end_time' => $exam->end_time?->toIso8601String(),
                    'course' => [
                        'id' => $exam->course?->id,
                        'name' => $exam->course?->name,
                        'code' => $exam->course?->code,
                    ],
                    'has_attempt' => $latestAttempt !== null,
                    'attempt_status' => $latestAttempt?->status,
                    'attempt_score' => $latestAttempt?->score,
                ];
            });

        // Recent attempts by this student
        $recentAttempts = ExamAttempt::where('user_id', $user->id)
            ->with(['exam:id,title,code,type,course_id', 'exam.course:id,name,code'])
            ->latest()
            ->take(5)
            ->get()
            ->map(fn($att) => [
                'id' => $att->id,
                'exam_id' => $att->exam_id,
                'exam_title' => $att->exam?->title,
                'exam_code' => $att->exam?->code,
                'course_name' => $att->exam?->course?->name,
                'type' => $att->exam?->type,
                'status' => $att->status,
                'score' => $att->score,
                'started_at' => $att->started_at?->toIso8601String(),
                'submitted_at' => $att->submitted_at?->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'statistics' => [
                    'total_courses' => $enrolledCourses->count(),
                    'total_exams' => Exam::whereIn('course_id', $enrolledCourseIds)->where('status', 'PUBLISHED')->count(),
                    'completed_attempts' => ExamAttempt::where('user_id', $user->id)->where('status', 'SUBMITTED')->count(),
                    'in_progress_attempts' => ExamAttempt::where('user_id', $user->id)->where('status', 'IN_PROGRESS')->count(),
                ],
                'courses' => $enrolledCourses->map(fn($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'code' => $c->code,
                    'description' => $c->description,
                    'teacher_name' => $c->teacher?->name ?? 'Chưa gán',
                    'exams_count' => $c->exams_count,
                ]),
                'upcoming_exams' => $upcomingExams,
                'recent_attempts' => $recentAttempts,
            ],
        ]);
    }
}
