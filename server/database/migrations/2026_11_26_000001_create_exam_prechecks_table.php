<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per lobby check a candidate submits ("precheck"). A passed one carries a single-use token that
 * POST /student/exams/{exam}/start requires, so an attempt is only entered (or resumed after a restart) from a
 * machine the server has just accepted. Kept for the proctor as the record of each entry.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exam_prechecks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exam_attempt_id')->nullable()->constrained('exam_attempts')->nullOnDelete();
            $table->string('token_hash', 64)->nullable()->unique();
            $table->boolean('passed');
            $table->json('reasons')->nullable();
            $table->json('checks')->nullable();
            $table->json('env')->nullable();
            $table->string('fingerprint', 80)->nullable();
            $table->unsignedBigInteger('boot_time')->nullable();
            $table->string('os_family', 16)->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'exam_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_prechecks');
    }
};
