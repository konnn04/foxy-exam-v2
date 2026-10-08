<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The reference photo used for identity checks (stored privately). Locked once enrolled: a student cannot
        // swap it mid-course; staff can unlock, replace or delete it.
        Schema::table('users', function (Blueprint $table) {
            $table->string('face_photo')->nullable();
            $table->timestamp('face_enrolled_at')->nullable();
            $table->timestamp('face_locked_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['face_photo', 'face_enrolled_at', 'face_locked_at']));
    }
};
