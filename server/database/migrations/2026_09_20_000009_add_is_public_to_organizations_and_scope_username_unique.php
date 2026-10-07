<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Thêm cờ is_public cho bảng organizations
        Schema::table('organizations', function (Blueprint $table) {
            $table->boolean('is_public')->default(false)->after('status')->index();
        });

        // 2. Chuyển đổi username trên bảng users từ unique toàn cục sang unique theo tổ chức
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->unique(['organization_id', 'username'], 'users_organization_id_username_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_organization_id_username_unique');
            $table->unique('username');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('is_public');
        });
    }
};
