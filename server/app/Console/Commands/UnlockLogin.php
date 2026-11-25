<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Audit;
use App\Support\LoginGuard;
use Illuminate\Console\Command;

/** Lifts the sign-in lock of an account hit by a password-guessing attack (see App\Support\LoginGuard). */
class UnlockLogin extends Command
{
    protected $signature = 'foxy:unlock-login {login : username or email} {--org= : organization code, when the name exists in several schools}';

    protected $description = 'Lift the temporary sign-in lock of an account';

    public function handle(): int
    {
        $login = (string) $this->argument('login');
        $q = User::query()->where(fn ($w) => $w->where('username', $login)->orWhere('email', $login));
        if ($code = $this->option('org')) {
            $q->whereHas('organization', fn ($o) => $o->where('code', strtoupper((string) $code)));
        }
        $users = $q->get();
        if ($users->count() !== 1) {
            $this->error($users->isEmpty() ? 'No such account.' : 'Several accounts match: add --org=CODE.');

            return self::FAILURE;
        }
        LoginGuard::unlock($users->first());
        Audit::record('auth.unlock', 'Mở khóa đăng nhập cho ' . $users->first()->username, 'user', $users->first()->id);
        $this->info('Unlocked ' . $users->first()->username . '.');

        return self::SUCCESS;
    }
}
