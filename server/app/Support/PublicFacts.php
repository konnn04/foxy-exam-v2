<?php

namespace App\Support;

use App\Models\Plan;
use App\Services\ClientReleaseService;
use Illuminate\Support\Facades\Cache;

/**
 * Facts about the product that change without a deploy (plans, prices, contact, latest FoxyClient).
 * One source for `GET /api/v1/public/facts` (readable by any bot or crawler) and for the landing assistant's tools,
 * so the assistant always answers with what the admin set a minute ago, never with numbers frozen in a prompt.
 */
final class PublicFacts
{
    private const TTL = 60;

    public static function all(): array
    {
        return [
            'product' => self::product(),
            'plans' => self::plans(),
            'contact' => self::contact(),
            'download' => self::download(),
            'updated_at' => now()->toIso8601String(),
        ];
    }

    public static function product(): array
    {
        $site = SiteSettings::all();

        return [
            'name' => $site['brand.name'] ?? 'FoxyExam',
            'site' => rtrim((string) config('app.url'), '/'),
            'pages' => ['features' => '/features', 'pricing' => '/pricing', 'download' => '/download', 'contact' => '/#tu-van', 'biometric_policy' => '/biometric-policy'],
        ];
    }

    /** Active plans, cheapest first. Prices are list prices in VND; a quote for a school is made by the sales team. */
    public static function plans(): array
    {
        return Cache::remember('public_facts.plans', self::TTL, fn () => Plan::where('is_active', true)->orderBy('price')->get()
            ->map(fn (Plan $p) => [
                'code' => $p->name,
                'name' => $p->display_name ?: $p->name,
                'price_vnd' => (int) $p->price,
                'billing' => match ($p->billing_cycle) {
                    'MONTHLY' => 'tháng', 'YEARLY' => 'năm', 'ONCE' => 'một lần', default => (string) $p->billing_cycle,
                },
                'exams_per_month' => $p->max_exams_per_month,
                'students_per_exam' => $p->max_students_per_exam,
                'storage_gb' => $p->storage_limit_gb,
                'ai_proctoring' => (bool) $p->has_ai_proctoring,
                'code_replay' => (bool) $p->has_code_replay,
            ])->values()->all());
    }

    public static function contact(): array
    {
        $site = SiteSettings::all();
        $phone = (string) ($site['contact.phone'] ?? '');
        $digits = preg_replace('/\D+/', '', $phone);

        return [
            'email' => $site['contact.email'] ?? null,
            'phone' => $phone ?: null,
            'zalo' => ($site['contact.zalo'] ?? '') ?: ($digits ? "https://zalo.me/{$digits}" : null),
            'address' => $site['contact.address.vi'] ?? null,
            'form' => '/#tu-van',
        ];
    }

    public static function download(): array
    {
        return Cache::remember('public_facts.download', 600, function () {
            $r = ClientReleaseService::getLatest();

            return [
                'version' => $r['version'] ?? null,
                'published_at' => $r['published_at'] ?? null,
                'windows_installer' => $r['exe_url'] ?? null,
                'windows_msi' => $r['msi_url'] ?? null,
                'page' => '/download',
            ];
        });
    }
}
