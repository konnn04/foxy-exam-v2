<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The client detects more than the original enum (banned app, extra monitor, gaze, capture lost...).
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_violation_type_check');
        }
        Schema::table('violations', function (Blueprint $table) {
            $table->string('violation_type', 50)->change();
        });

        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->string('ended_reason', 30)->nullable(); // ABSENT, ...
        });
    }

    public function down(): void
    {
        Schema::table('exam_attempts', fn (Blueprint $t) => $t->dropColumn('ended_reason'));
    }
};
