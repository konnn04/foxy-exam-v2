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
        // 1. Courses (belong to an Organization)
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('code', 50)->index();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'code']);
        });

        // 2. Exams
        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('title');
            $table->string('code', 30)->unique()->index(); // Room code for students to enter: e.g. "FOXY-8291"
            $table->text('description')->nullable();
            $table->enum('type', ['PROGRAMMING', 'QUIZ', 'HYBRID'])->default('PROGRAMMING');
            $table->enum('status', ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'ENDED'])->default('DRAFT');
            $table->timestamp('start_time')->nullable();
            $table->timestamp('end_time')->nullable();
            $table->unsignedInteger('duration_minutes')->default(60);
            
            // Security & Anti-Cheat monitoring configuration
            $table->json('monitoring_config')->nullable(); // { ai_face: true, ai_object: true, prevent_paste: true, ... }
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 3. Programming Problems
        Schema::create('programming_problems', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->nullable()->constrained('exams')->cascadeOnDelete();
            $table->string('title');
            $table->longText('description'); // Markdown format for problem specification
            $table->enum('difficulty', ['EASY', 'MEDIUM', 'HARD', 'EXPERT'])->default('MEDIUM');
            $table->unsignedInteger('time_limit_ms')->default(2000); // Max execution time per test case
            $table->unsignedInteger('memory_limit_mb')->default(256);
            $table->json('allowed_languages')->nullable(); // ['cpp', 'java', 'python', 'c']
            $table->json('starter_templates')->nullable(); // { "cpp": "#include...", "python": "def solve()..." }
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
        });

        // 4. Test Cases
        Schema::create('test_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('programming_problem_id')->constrained('programming_problems')->cascadeOnDelete();
            $table->longText('input_data');
            $table->longText('expected_output');
            $table->boolean('is_sample')->default(false); // Sample visible to students or secret test case for grading
            $table->float('score_weight')->default(1.0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('test_cases');
        Schema::dropIfExists('programming_problems');
        Schema::dropIfExists('exams');
        Schema::dropIfExists('courses');
    }
};
