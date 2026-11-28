<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The landing-page assistant: a lead remembers where it came from (the contact form or the chat) and what the
 * visitor needs; questions the assistant could not answer are kept (text only, no IP) to grow the FAQ.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->string('source', 16)->default('form')->after('locale');
            $table->string('plan', 60)->nullable()->after('source');
            $table->string('scale', 60)->nullable()->after('plan');
            $table->text('message')->nullable()->after('scale');
        });

        Schema::create('chat_questions', function (Blueprint $table) {
            $table->id();
            $table->string('question', 500);
            $table->string('locale', 5)->default('vi');
            $table->boolean('resolved')->default(false);
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_questions');
        Schema::table('leads', fn (Blueprint $table) => $table->dropColumn(['source', 'plan', 'scale', 'message']));
    }
};
