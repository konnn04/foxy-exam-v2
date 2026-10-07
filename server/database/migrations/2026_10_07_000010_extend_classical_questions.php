<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bring the exam-sys question model into the new system:
 *  - all six question types (adds TRUE_FALSE and MULTIPLE_FILL_IN_BLANK),
 *  - 4 difficulty levels,
 *  - per-type settings (blanks, essay mode, shared passage / audio / image of a group),
 *  - question image and skill tag,
 *  - question-set draw rules (how many questions to deal, ratio per difficulty).
 */
return new class extends Migration
{
    public function up(): void
    {
        // enum -> string so new types / levels need no further migrations
        Schema::table('classical_questions', function (Blueprint $table) {
            $table->string('type', 40)->default('SINGLE_CHOICE')->change();
            $table->string('difficulty', 20)->default('MEDIUM')->change();
        });

        Schema::table('classical_questions', function (Blueprint $table) {
            $table->boolean('is_true')->nullable()->after('explanation');   // TRUE_FALSE
            $table->json('settings')->nullable()->after('is_true');         // per-type options (see ClassicalQuestion::TYPES)
            $table->string('skill', 40)->nullable()->after('settings');     // Nghe / Nói / Đọc / Viết / ...
            $table->string('image', 500)->nullable()->after('skill');       // illustration shown with the question
        });

        Schema::table('question_sets', function (Blueprint $table) {
            $table->unsignedInteger('limit_questions')->default(0)->after('max_score'); // 0 = deal every question
            $table->json('ratio_per_difficulty')->nullable()->after('limit_questions'); // {"EASY":30,"MEDIUM":40,...} (percent)
        });
    }

    public function down(): void
    {
        Schema::table('question_sets', function (Blueprint $table) {
            $table->dropColumn(['limit_questions', 'ratio_per_difficulty']);
        });
        Schema::table('classical_questions', function (Blueprint $table) {
            $table->dropColumn(['is_true', 'settings', 'skill', 'image']);
        });
    }
};
