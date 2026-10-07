<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Exam Student Attempts
        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('attempt_number')->default(1);
            $table->enum('status', ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'FORCE_ENDED'])->default('NOT_STARTED');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->float('score')->default(0);
            $table->unsignedInteger('risk_score')->default(0); // Aggregated suspicious score (0-100)
            $table->boolean('is_flagged')->default(false);
            $table->json('device_info')->nullable();
            $table->string('session_token', 64)->nullable()->index();
            $table->timestamps();

            $table->unique(['exam_id', 'user_id', 'attempt_number']);
        });

        // 2. Submissions (Student submitted code for each problem)
        Schema::create('submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->foreignId('programming_problem_id')->constrained('programming_problems')->cascadeOnDelete();
            $table->string('language', 20); // 'cpp', 'python', 'java'
            $table->longText('source_code');
            $table->unsignedInteger('passed_cases_count')->default(0);
            $table->unsignedInteger('total_cases_count')->default(0);
            $table->float('score')->default(0);
            $table->enum('status', ['PENDING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR'])->default('PENDING');
            $table->json('grading_details')->nullable(); // Output per test case
            $table->timestamp('submitted_at');
            $table->timestamps();
        });

        // 3. Edit Op Logs (Keystrokes, typing dynamics, paste detection payload)
        Schema::create('edit_op_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->foreignId('programming_problem_id')->nullable()->constrained('programming_problems')->nullOnDelete();
            $table->unsignedInteger('batch_seq')->default(1);
            $table->unsignedInteger('keystroke_count')->default(0);
            $table->unsignedInteger('paste_event_count')->default(0);
            $table->json('synthetic_flags')->nullable(); // e.g. { bulk_insert: true, length: 120 }
            $table->longText('raw_ops_payload')->nullable(); // Compressed keystroke stream for timeline replay
            $table->timestamp('created_at')->useCurrent();
            
            $table->index(['exam_attempt_id', 'batch_seq']);
        });

        // 4. Violations (Suspicious activities flagged during the exam)
        Schema::create('violations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->enum('violation_type', [
                'BULK_PASTE',
                'SYNTHETIC_INPUT',
                'TAB_SWITCH',
                'WINDOW_LOST_FOCUS',
                'DEVTOOLS_OPENED',
                'MULTIPLE_KEYBOARDS',
                'FACE_MISMATCH',
                'MULTIPLE_PEOPLE',
                'NO_FACE_DETECTED',
                'PROHIBITED_DEVICE'
            ]);
            $table->enum('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])->default('MEDIUM');
            $table->json('details')->nullable();
            $table->string('evidence_url')->nullable(); // Presigned URL on Cloudflare R2
            $table->boolean('is_reviewed')->default(false);
            $table->boolean('is_false_positive')->default(false);
            $table->timestamp('timestamp')->useCurrent();
            $table->timestamps();

            $table->index(['exam_attempt_id', 'violation_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('violations');
        Schema::dropIfExists('edit_op_logs');
        Schema::dropIfExists('submissions');
        Schema::dropIfExists('exam_attempts');
    }
};
