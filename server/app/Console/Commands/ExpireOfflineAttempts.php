<?php

namespace App\Console\Commands;

use App\Models\ExamAttempt;
use App\Services\AttemptFinisher;
use Illuminate\Console\Command;

class ExpireOfflineAttempts extends Command
{
    protected $signature = 'attempts:expire-offline {--minutes=5 : minutes without any sign of life}';

    protected $description = 'Close running attempts whose candidate has been gone for too long (marked absent)';

    public function handle(AttemptFinisher $finisher): int
    {
        $cutoff = now()->subMinutes((int) $this->option('minutes'));
        $n = 0;

        // last sign of life = newest of: realtime presence, any REST call that touched the row, the start time
        ExamAttempt::where('status', 'IN_PROGRESS')
            ->where('started_at', '<', $cutoff)
            ->where(fn ($q) => $q->whereNull('last_seen_at')->orWhere('last_seen_at', '<', $cutoff))
            ->where('updated_at', '<', $cutoff)
            ->each(function (ExamAttempt $a) use ($finisher, &$n) {
                $finisher->submit($a, 'ABSENT');
                $n++;
            });

        $this->info("Closed {$n} absent attempt(s).");

        return self::SUCCESS;
    }
}
