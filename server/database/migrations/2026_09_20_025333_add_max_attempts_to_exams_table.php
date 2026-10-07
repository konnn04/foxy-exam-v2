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
        Schema::table('exams', function (Blueprint $table) {
            // Số lượt thi tối đa cho phép mỗi sinh viên trên kỳ thi này.
            // NULL = không giới hạn (thi lại bao nhiêu lần cũng được).
            // Mặc định 1 để giữ đúng hành vi cũ (1 lượt duy nhất) cho các kỳ
            // thi đã tạo trước migration này.
            $table->unsignedInteger('max_attempts')->nullable()->default(1)->after('duration_minutes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('exams', function (Blueprint $table) {
            $table->dropColumn('max_attempts');
        });
    }
};
