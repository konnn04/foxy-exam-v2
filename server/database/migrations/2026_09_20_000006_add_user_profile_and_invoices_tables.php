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
        // 1. Add detailed profile fields to users table
        Schema::table('users', function (Blueprint $table) {
            $table->string('middle_name', 100)->nullable()->after('first_name');
            $table->date('date_of_birth')->nullable()->after('middle_name');
            $table->text('address')->nullable()->after('date_of_birth');
        });

        // 2. Invoices & SaaS Payments table
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_code', 50)->unique()->index();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->cascadeOnDelete();
            $table->decimal('amount', 12, 2)->default(0);
            $table->enum('status', ['PAID', 'PENDING', 'CANCELLED', 'REFUNDED'])->default('PAID');
            $table->enum('payment_method', ['VNPAY', 'MOMO', 'BANK_TRANSFER', 'CREDIT_CARD'])->default('BANK_TRANSFER');
            $table->string('transaction_id', 100)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['middle_name', 'date_of_birth', 'address']);
        });
    }
};
