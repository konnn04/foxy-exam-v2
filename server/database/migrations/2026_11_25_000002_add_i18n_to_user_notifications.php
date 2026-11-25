<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `title`/`body` stay as the Vietnamese fallback (old rows and free text typed by staff).
     * `key` + `params` let each client build the sentence in its own language: nothing is stored twice.
     */
    public function up(): void
    {
        Schema::table('user_notifications', function (Blueprint $table) {
            $table->string('key', 60)->nullable()->after('type');
            $table->json('params')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('user_notifications', function (Blueprint $table) {
            $table->dropColumn(['key', 'params']);
        });
    }
};
