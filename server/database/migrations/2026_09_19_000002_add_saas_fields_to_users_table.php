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
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('organization_id')
                ->after('id')
                ->default(1)
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->string('username', 50)->unique()->after('organization_id');
            $table->string('first_name', 100)->nullable()->after('name');
            $table->string('last_name', 100)->nullable()->after('first_name');
            $table->enum('role', ['SUPER_ADMIN', 'ORG_ADMIN', 'TEACHER', 'STUDENT'])
                ->default('STUDENT')
                ->after('password');
            $table->enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])
                ->default('ACTIVE')
                ->after('role');
            $table->string('avatar')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['organization_id']);
            $table->dropColumn([
                'organization_id',
                'username',
                'first_name',
                'last_name',
                'role',
                'status',
                'avatar',
            ]);
        });
    }
};
