<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The link a candidate opens on a phone to use it as a second camera. Only the SHA-256 of the token is stored.
        // It exists before the attempt (the lobby checks the phone first) and is bound to the attempt when the exam starts.
        Schema::create('mobile_camera_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attempt_id')->nullable()->constrained('exam_attempts')->nullOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('relay_ack_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index(['user_id', 'exam_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_camera_tokens');
    }
};
