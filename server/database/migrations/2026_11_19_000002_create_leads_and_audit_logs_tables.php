<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pilot / contact requests sent from the public site. Consent is stored with the request: it is the proof.
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            $table->string('email', 190);
            $table->string('phone', 40);
            $table->string('organization', 190)->nullable();
            $table->string('locale', 5)->default('vi');
            $table->string('status', 20)->default('NEW'); // NEW | CONTACTED | QUALIFIED | CLOSED | SPAM
            $table->text('note')->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('terms_accepted_at');
            $table->string('terms_hash', 64);            // sha256 of the terms text the visitor saw
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('email');
        });

        // Append-only trail of what staff did (who, what, where, from which address).
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_name', 160)->nullable();       // kept even if the account is deleted later
            $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->string('action', 60);                        // e.g. auth.login, org.create, site.update
            $table->string('target_type', 40)->nullable();
            $table->string('target_id', 40)->nullable();
            $table->string('summary', 255)->nullable();
            $table->json('meta')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['organization_id', 'created_at']);
            $table->index(['action', 'created_at']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('leads');
    }
};
