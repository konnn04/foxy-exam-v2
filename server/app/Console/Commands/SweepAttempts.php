<?php

namespace App\Console\Commands;

use App\Models\ExamAttempt;
use App\Services\AttemptFinisher;
use App\Support\MonitoringConfig;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Runs every minute (routes/console.php). Closes the running attempts that can no longer go on:
 *   TIME_UP  the duration has run out (plus a grace for the last autosave)
 *   ABSENT   no sign of life for longer than the exam's `offline_minutes` (0 = never closed for that)
 * Submitted attempts are closed and graded by the submit request itself; this only catches the ones whose
 * submit never arrived (crash, lost network, closed laptop).
 */
class SweepAttempts extends Command
{
    protected $signature = 'attempts:sweep
        {--grace=60 : seconds after the deadline before an attempt is closed}
        {--minutes= : override the offline limit of every exam (minutes)}
        {--dry-run : only list what would be closed}';

    protected $aliases = ['attempts:expire-offline'];

    protected $description = 'Close running attempts that are past their time or whose candidate has been gone too long';

    public function handle(AttemptFinisher $finisher): int
    {
        $grace = max(0, (int) $this->option('grace'));
        $override = $this->option('minutes');
        $dry = (bool) $this->option('dry-run');
        $counts = ['TIME_UP' => 0, 'ABSENT' => 0];

        // running attempts are few at any moment (the ones in an exam room right now)
        ExamAttempt::whereIn('status', AttemptFinisher::OPEN)
            ->whereNotNull('started_at')
            ->whereNull('voided_at')
            ->with('exam:id,duration_minutes,monitoring_config')
            ->lazyById(500)
            ->each(function (ExamAttempt $a) use ($finisher, $grace, $override, $dry, &$counts) {
                $reason = $this->reasonToClose($a, $grace, $override);
                if (!$reason) {
                    return;
                }
                $counts[$reason]++;
                if ($dry) {
                    $this->line("#{$a->id} exam {$a->exam_id}: {$reason}");

                    return;
                }
                try {
                    $finisher->submit($a, $reason);
                } catch (\Throwable $e) {
                    // one broken attempt must not stop the others; it is retried next minute
                    Log::error('attempts:sweep could not close an attempt', ['attempt' => $a->id, 'reason' => $reason, 'error' => $e->getMessage()]);
                    $counts[$reason]--;
                }
            });

        if ($counts['TIME_UP'] || $counts['ABSENT']) {
            Log::info('attempts:sweep', $counts + ['dry_run' => $dry]);
        }
        $this->info("Hết giờ: {$counts['TIME_UP']}, vắng thi: {$counts['ABSENT']}" . ($dry ? ' (chạy thử)' : ''));

        return self::SUCCESS;
    }

    private function reasonToClose(ExamAttempt $a, int $grace, ?string $override): ?string
    {
        if ($a->isOverdue($grace)) {
            return 'TIME_UP';
        }

        $minutes = $override !== null ? (int) $override : MonitoringConfig::offlineMinutes($a->exam?->monitoring_config);
        if ($minutes > 0 && $a->lastSeen()?->lt(now()->subMinutes($minutes))) {
            return 'ABSENT';
        }

        return null;
    }
}
