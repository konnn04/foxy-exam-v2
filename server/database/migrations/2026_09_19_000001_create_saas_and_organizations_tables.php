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
        // 1. Organizations (Tenants: Root, Schools, Centers, Lecturers)
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 50)->unique()->index();
            $table->string('slug', 100)->unique()->index();
            $table->enum('type', ['ROOT', 'UNIVERSITY', 'CENTER', 'INDIVIDUAL'])->default('UNIVERSITY');
            $table->enum('status', ['ACTIVE', 'LOCKED', 'SUSPENDED'])->default('ACTIVE');
            $table->foreignId('parent_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        // 2. Plans (SaaS Pricing Tiers: Free, Pro, Enterprise)
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique();
            $table->string('display_name');
            $table->decimal('price', 12, 2)->default(0);
            $table->enum('billing_cycle', ['ONCE', 'MONTHLY', 'YEARLY'])->default('MONTHLY');
            
            // Quota Limits
            $table->unsignedInteger('max_exams_per_month')->default(1);
            $table->unsignedInteger('max_students_per_exam')->default(20);
            $table->unsignedInteger('storage_limit_gb')->default(1);
            
            // Feature Flags
            $table->boolean('has_ai_proctoring')->default(false);
            $table->boolean('has_code_replay')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 3. Subscriptions (Organization Plan Assignment)
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable(); // NULL = Never expires (e.g. Free)
            $table->enum('status', ['ACTIVE', 'EXPIRED', 'CANCELLED', 'TRIAL'])->default('ACTIVE');
            $table->boolean('auto_renew')->default(false);
            $table->timestamps();
        });

        // 4. Monthly Usage Tracker
        Schema::create('organization_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('month_year', 7)->index(); // Format: 'YYYY-MM', e.g. '2026-09'
            $table->unsignedInteger('exams_created_count')->default(0);
            $table->unsignedInteger('total_attempts_count')->default(0);
            $table->unsignedBigInteger('storage_used_bytes')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'month_year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('organization_usages');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
        Schema::dropIfExists('organizations');
    }
};
