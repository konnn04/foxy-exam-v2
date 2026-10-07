<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 255)->nullable();
        });
        Schema::table('violations', function (Blueprint $table) {
            $table->boolean('voided')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('violations', fn (Blueprint $table) => $table->dropColumn('voided'));
        Schema::table('exam_attempts', fn (Blueprint $table) => $table->dropColumn(['voided_at', 'void_reason']));
    }
};
