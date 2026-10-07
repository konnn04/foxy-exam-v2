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
        // 1. Course Enrollments (Ghi danh sinh viên vào khóa học)
        Schema::create('course_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['ENROLLED', 'COMPLETED', 'DROPPED'])->default('ENROLLED');
            $table->timestamp('enrolled_at')->useCurrent();
            $table->timestamps();

            $table->unique(['course_id', 'user_id']);
        });

        // 2. Exam Attempt Answers (Lưu câu trả lời bài thi trắc nghiệm & tự luận cổ điển)
        Schema::create('exam_attempt_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->foreignId('classical_question_id')->constrained('classical_questions')->cascadeOnDelete();
            $table->foreignId('answer_id')->nullable()->constrained('classical_question_answers')->nullOnDelete();
            $table->json('selected_answer_ids')->nullable(); // Cho dạng MULTIPLE_CHOICE [1, 3, 5]
            $table->text('answer_content')->nullable();      // Cho dạng SHORT_ANSWER, ESSAY
            $table->boolean('is_correct')->nullable();
            $table->float('score')->default(0);
            $table->timestamps();

            $table->unique(['exam_attempt_id', 'classical_question_id'], 'attempt_question_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('exam_attempt_answers');
        Schema::dropIfExists('course_enrollments');
    }
};
