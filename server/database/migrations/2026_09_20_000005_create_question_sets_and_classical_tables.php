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
        // 1. Question Sets (Bộ đề)
        Schema::create('question_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->string('name');
            $table->string('code', 50)->index();
            $table->enum('type', ['CLASSICAL', 'PROGRAMMING'])->default('CLASSICAL');
            $table->text('description')->nullable();
            $table->enum('status', ['DRAFT', 'PUBLISHED', 'ARCHIVED'])->default('DRAFT');
            $table->float('max_score')->default(10.0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'code']);
        });

        // 2. Classical Questions (Câu hỏi cổ điển: Trắc nghiệm, Tự luận, Nhóm bài đọc)
        Schema::create('classical_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_set_id')->constrained('question_sets')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('classical_questions')->cascadeOnDelete(); // Cho câu hỏi con trong GROUP_QUESTION
            $table->enum('type', [
                'SINGLE_CHOICE',   // Trắc nghiệm 1 đáp án (2-4 lựa chọn, radio)
                'MULTIPLE_CHOICE', // Trắc nghiệm nhiều đáp án (2-8 lựa chọn, checkbox)
                'SHORT_ANSWER',    // Tự luận 1 dòng (< 300 ký tự)
                'ESSAY',           // Tự luận 1 đoạn
                'GROUP_QUESTION'   // Nhóm câu hỏi (bài đọc hiểu tiếng Anh + các câu con)
            ])->default('SINGLE_CHOICE');
            $table->longText('content');
            $table->text('explanation')->nullable();
            $table->float('points')->default(1.0);
            $table->enum('difficulty', ['EASY', 'MEDIUM', 'HARD'])->default('MEDIUM');
            $table->unsignedInteger('order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 3. Classical Question Answers (Phương án đáp án)
        Schema::create('classical_question_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('classical_question_id')->constrained('classical_questions')->cascadeOnDelete();
            $table->text('content');
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
        });

        // 4. Update programming_problems: add question_set_id and make exam_id nullable
        Schema::table('programming_problems', function (Blueprint $table) {
            $table->foreignId('question_set_id')->nullable()->after('id')->constrained('question_sets')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('programming_problems', function (Blueprint $table) {
            $table->dropForeign(['question_set_id']);
            $table->dropColumn('question_set_id');
        });

        Schema::dropIfExists('classical_question_answers');
        Schema::dropIfExists('classical_questions');
        Schema::dropIfExists('question_sets');
    }
};
