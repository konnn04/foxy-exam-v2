<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The realtime worker delivers events at-least-once; client_event_id ("<attempt>:<seq>") makes that idempotent.
        Schema::table('violations', function (Blueprint $table) {
            $table->string('client_event_id', 64)->nullable()->unique();
            $table->string('evidence_id', 64)->nullable()->index(); // id in the recording service
        });

        Schema::table('edit_op_logs', function (Blueprint $table) {
            $table->string('client_event_id', 64)->nullable()->unique();
            $table->string('payload_ref', 255)->nullable(); // object-storage key of the raw keystroke stream
        });

        // Throttled presence mirror (the live value is in Redis / the hub).
        Schema::table('exam_attempts', function (Blueprint $table) {
            $table->timestamp('last_seen_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('exam_attempts', fn (Blueprint $t) => $t->dropColumn('last_seen_at'));
        Schema::table('edit_op_logs', function (Blueprint $t) {
            $t->dropUnique(['client_event_id']);
            $t->dropColumn(['client_event_id', 'payload_ref']);
        });
        Schema::table('violations', function (Blueprint $t) {
            $t->dropUnique(['client_event_id']);
            $t->dropIndex(['evidence_id']);
            $t->dropColumn(['client_event_id', 'evidence_id']);
        });
    }
};
