<?php

namespace App\Console\Commands;

use App\Models\Organization;
use Illuminate\Console\Command;

class SeedIfEmpty extends Command
{
    protected $signature = 'foxy:seed-if-empty';

    protected $description = 'Run the database seeders only when no organization exists yet';

    public function handle(): int
    {
        if (Organization::withoutGlobalScopes()->exists()) {
            $this->info('Database already has data, seeding skipped.');

            return self::SUCCESS;
        }

        return $this->call('db:seed', ['--force' => true]);
    }
}
