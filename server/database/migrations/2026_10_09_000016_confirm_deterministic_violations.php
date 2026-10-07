<?php

use App\Support\ViolationCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('violations')
            ->whereIn('violation_type', ViolationCatalog::AUTO)
            ->where('is_reviewed', false)
            ->where('is_false_positive', false)
            ->update(['is_reviewed' => true]);
    }

    public function down(): void
    {
        // confirmation of facts is not undone
    }
};
