<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Runs inside the container through `php artisan schedule:work` (docker/start.sh, RUN_SCHEDULER=true).
Schedule::command('attempts:sweep')->everyMinute()->withoutOverlapping(5);
