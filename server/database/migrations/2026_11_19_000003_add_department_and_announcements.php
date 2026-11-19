<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // "Khoa / bộ môn" of a course: the grouping key of the reports. Free text so every school keeps its own naming.
        Schema::table('courses', function (Blueprint $table) {
            $table->string('department', 120)->nullable()->after('name')->index();
        });

        // One row per broadcast the platform sent to schools (the notifications themselves live in user_notifications).
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title', 160);
            $table->text('body')->nullable();
            $table->string('url', 300)->nullable();
            $table->json('audience');                 // { scope, types[], org_ids[], roles[] }
            $table->unsignedInteger('recipients_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
        Schema::table('courses', fn (Blueprint $table) => $table->dropColumn('department'));
    }
};
