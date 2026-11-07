<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('violation_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->unique()->constrained('exam_attempts')->cascadeOnDelete();
            $table->foreignId('exam_id')->constrained('exams')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('slug', 120)->unique();
            $table->boolean('is_published')->default(true);
            $table->string('status', 32)->default('warning'); // no_violation | warning | suspended
            $table->text('suspension_reason')->nullable();
            $table->unsignedTinyInteger('score_deduction_percent')->default(0);
            $table->float('original_score')->nullable();
            $table->json('attached_violation_ids')->nullable();
            $table->timestamp('link_expires_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('violation_reports');
    }
};
