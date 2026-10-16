<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Each violation carries a hash of its own immutable facts and of the one before it in the same attempt, so a log
        // that was edited, reordered or trimmed afterwards no longer verifies. Rows from before this column stay unchained.
        Schema::table('violations', function (Blueprint $table) {
            $table->string('chain_hash', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('violations', fn (Blueprint $table) => $table->dropColumn('chain_hash'));
    }
};
