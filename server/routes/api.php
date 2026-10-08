<?php

use App\Http\Controllers\Api\V1\AdminController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ExamController;
use App\Http\Controllers\Api\V1\SubmissionController;
use App\Http\Controllers\Api\V1\TelemetryController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Internal\EventsController as InternalEventsController;
use App\Http\Controllers\Api\V1\Student\RealtimeController;
use App\Http\Middleware\VerifyInternalSignature;

/*
|--------------------------------------------------------------------------
| API Routes - FoxyExam Core v2
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {
    // 1. Public Health, Organizations & Tunnel Checks
    Route::get('/health', [TelemetryController::class, 'health']);
    Route::get('/ai/status', [TelemetryController::class, 'aiStatusProxy']);
    Route::get('/public/organizations', [\App\Http\Controllers\Api\V1\Public\OrganizationController::class, 'publicList']);

    // 2. Student Authentication
    Route::post('/auth/login', [\App\Http\Controllers\Api\V1\Auth\AuthController::class, 'login']);
    Route::post('/student/login', [AuthController::class, 'studentLogin']);

    // 3. Protected Routes (Requires Sanctum Token)
    Route::middleware('auth:sanctum')->group(function () {
        // Auth profile & logout
        Route::get('/auth/me', [\App\Http\Controllers\Api\V1\Auth\AuthController::class, 'me']);
        Route::post('/auth/logout', [\App\Http\Controllers\Api\V1\Auth\AuthController::class, 'logout']);

        // Student Portal & Exam Taking Flow
        Route::prefix('student')->group(function () {
            // Dashboard
            Route::get('/dashboard', [\App\Http\Controllers\Api\V1\Student\DashboardController::class, 'index']);

            // Courses
            Route::get('/courses', [\App\Http\Controllers\Api\V1\Student\CourseController::class, 'index']);
            Route::get('/courses/{course}', [\App\Http\Controllers\Api\V1\Student\CourseController::class, 'show']);
            Route::get('/courses/{course}/exams', [\App\Http\Controllers\Api\V1\Student\CourseController::class, 'exams']);

            // Exams Flow
            Route::get('/exams/{exam}', [\App\Http\Controllers\Api\V1\Student\ExamController::class, 'show']);
            Route::post('/exams/{exam}/start', [\App\Http\Controllers\Api\V1\Student\ExamController::class, 'start']);
            Route::get('/exams/{exam}/take/{attempt}', [\App\Http\Controllers\Api\V1\Student\ExamController::class, 'take']);
            Route::post('/exams/{exam}/take/{attempt}/save-answer', [\App\Http\Controllers\Api\V1\Student\ExamController::class, 'saveAnswer']);
            Route::post('/exams/{exam}/submit/{attempt}', [\App\Http\Controllers\Api\V1\Student\ExamController::class, 'submit']);
            Route::get('/exams/{exam}/review/{attempt}', [\App\Http\Controllers\Api\V1\Student\ExamController::class, 'review']);

            // Legacy Client compatibility routes
            Route::get('/paper', [ExamController::class, 'getPaper']);
            Route::post('/heartbeat', [ExamController::class, 'heartbeat']);
            Route::post('/finish', [ExamController::class, 'finishExam']);

            // Realtime plane: tokens + URLs for batched telemetry, evidence upload and LiveKit
            // Camera frames for the AI services (identity + prohibited objects)
            Route::post('/ai/frame', [\App\Http\Controllers\Api\V1\Student\AiFrameController::class, 'store'])->middleware('throttle:12,1');
            Route::post('/ai/evidence', [\App\Http\Controllers\Api\V1\Student\AiFrameController::class, 'evidence'])->middleware('throttle:12,1');

            Route::post('/realtime/session', [RealtimeController::class, 'session']);

            // Anti-Cheat Telemetry & Keystroke Op-Log
            Route::post('/op-log', [TelemetryController::class, 'recordOpLog']);
            Route::post('/violation', [TelemetryController::class, 'recordViolation']);

            // Code Submissions
            Route::post('/submit', [SubmissionController::class, 'submitCode']);
            Route::get('/submissions', [SubmissionController::class, 'getHistory']);
        });

        // Admin & Teacher Management (SaaS Quotas & Violations)
        Route::prefix('admin')->group(function () {
            Route::get('/quota', [AdminController::class, 'getQuotaStatus']);
            Route::post('/exams', [AdminController::class, 'createExam']);
            Route::get('/exams/{examId}/violations', [AdminController::class, 'getExamViolations']);
        });
    });
});

// Service-to-service (realtime worker -> core), HMAC-signed, no user session
Route::prefix('internal/v1')->middleware(VerifyInternalSignature::class)->group(function () {
    Route::post('/events/bulk', [InternalEventsController::class, 'bulk']);
});
