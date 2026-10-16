<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Append-only audit of "I agree to biometric processing": one row per login (token) and per policy version.
        Schema::create('biometric_consents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('token_id')->nullable()->index();
            $table->string('policy_version', 32);
            $table->string('source', 24)->default('login');
            $table->string('ip', 64)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('accepted_at')->useCurrent();
            $table->index(['user_id', 'policy_version']);
        });

        // A student asks to replace a locked reference photo; staff approve (the photo is unlocked) or reject.
        Schema::create('face_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 500);
            $table->string('status', 16)->default('PENDING'); // PENDING | APPROVED | REJECTED
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decision_note', 500)->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        // Short-lived, single-use link that lets a phone take the reference photo (QR from the computer).
        Schema::create('face_enroll_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('face_enroll_tokens');
        Schema::dropIfExists('face_change_requests');
        Schema::dropIfExists('biometric_consents');
    }
};
