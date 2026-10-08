<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The chat between the proctors and one candidate during an attempt. Kept as part of the evidence (answers must not be leaked through it).
        Schema::create('attempt_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender_role', 16); // PROCTOR | STUDENT
            $table->text('body');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['exam_attempt_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attempt_messages');
    }
};
