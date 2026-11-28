<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * White-label content of the public website (landing, features, pricing, about, download, footer).
 *
 * Flat key => string store. A key without an override falls back to the built-in text of the frontend
 * (translations.ts), so only what the platform admin actually changed is stored. Keys ending in .vi / .en are
 * localized. Only keys listed in schema() are ever accepted or served.
 */
class SiteSettings
{
    private const CACHE_KEY = 'site_settings.v1';

    public const TEXT = 'text';
    public const AREA = 'area';
    public const LONG = 'long';
    public const URL = 'url';
    public const BOOL = 'bool';

    /** Non-text defaults (identity, contact, media). Text keys are absent on purpose: the frontend owns them. */
    private const DEFAULTS = [
        'brand.name' => 'EXAM GUARD',
        'brand.badge' => 'STEM 2026',
        'brand.logo' => '/mark.png',
        'banner.enabled' => '1',
        'contact.email' => 'minkhoi.dev@gmail.com',
        'contact.phone' => '0387 291 237',
        'chat.enabled' => '1',
        'media.video_url' => 'https://drive.google.com/file/d/1U-k20_mAvNmi8x24-qqgtex1-4MBj2zJ/preview',
        'media.dashboard' => '/images/mockups/dashboard-proctor.png',
        'media.kiosk' => '/images/mockups/kiosk-candidate.png',
        'media.operator' => '/images/mockups/operator-view.png',
        'media.phone' => '/images/mockups/phone-camera.png',
        'media.report' => '/images/mockups/violation-report.png',
    ];

    /** @return array<string, string> key => type */
    public static function schema(): array
    {
        $s = [
            'brand.name' => self::TEXT, 'brand.badge' => self::TEXT, 'brand.logo' => self::URL,
            'brand.tagline.vi' => self::TEXT, 'brand.tagline.en' => self::TEXT,
            'banner.enabled' => self::BOOL,
            'banner.institution.vi' => self::TEXT, 'banner.institution.en' => self::TEXT,
            'banner.project.vi' => self::TEXT, 'banner.project.en' => self::TEXT,
            'banner.faculty.vi' => self::TEXT, 'banner.faculty.en' => self::TEXT,
            'contact.email' => self::TEXT, 'contact.phone' => self::TEXT, 'contact.zalo' => self::URL,
            'chat.enabled' => self::BOOL,
            'contact.phone_role.vi' => self::TEXT, 'contact.phone_role.en' => self::TEXT,
            'contact.address.vi' => self::TEXT, 'contact.address.en' => self::TEXT,
            'footer.description.vi' => self::AREA, 'footer.description.en' => self::AREA,
            'footer.badge.vi' => self::TEXT, 'footer.badge.en' => self::TEXT,
            'footer.copyright.vi' => self::TEXT, 'footer.copyright.en' => self::TEXT,
            'footer.legal.vi' => self::TEXT, 'footer.legal.en' => self::TEXT,
            'hero.badge.vi' => self::TEXT, 'hero.badge.en' => self::TEXT,
            'hero.title.vi' => self::TEXT, 'hero.title.en' => self::TEXT,
            'hero.highlight.vi' => self::TEXT, 'hero.highlight.en' => self::TEXT,
            'hero.description.vi' => self::AREA, 'hero.description.en' => self::AREA,
            'legal.terms.vi' => self::LONG, 'legal.terms.en' => self::LONG,
            'media.video_url' => self::URL, 'media.dashboard' => self::URL, 'media.kiosk' => self::URL,
            'media.operator' => self::URL, 'media.phone' => self::URL, 'media.report' => self::URL,
        ];
        for ($i = 1; $i <= 6; $i++) {
            $s["media.feature.$i"] = self::URL;
        }
        for ($i = 1; $i <= 4; $i++) {
            $s["metrics.$i.value"] = self::TEXT;
            $s["metrics.$i.label.vi"] = self::TEXT;
            $s["metrics.$i.label.en"] = self::TEXT;
        }

        return $s;
    }

    /** Stored overrides only. */
    private static function stored(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            if (!Schema::hasTable('site_settings')) {
                return [];
            }

            return DB::table('site_settings')->pluck('value', 'key')->map(fn ($v) => (string) $v)->all();
        });
    }

    /** What the public pages receive: defaults overlaid with non-empty overrides. */
    public static function all(): array
    {
        return array_merge(self::DEFAULTS, array_filter(self::stored(), fn ($v) => $v !== ''));
    }

    /** Admin editor view: current values (override or default) and the defaults to reset to. */
    public static function forEditor(): array
    {
        return ['values' => array_merge(self::DEFAULTS, self::stored()), 'defaults' => self::DEFAULTS];
    }

    /**
     * Saves the given keys. Unknown keys are dropped; an empty value (or one equal to the default) removes the
     * override, which brings back the built-in text.
     *
     * @param  array<string, mixed>  $input
     */
    public static function save(array $input): void
    {
        $schema = self::schema();

        foreach ($input as $key => $value) {
            if (!isset($schema[$key])) {
                continue;
            }
            $value = self::clean($schema[$key], is_scalar($value) ? (string) $value : '');

            if ($value === '' || (array_key_exists($key, self::DEFAULTS) && $value === self::DEFAULTS[$key])) {
                DB::table('site_settings')->where('key', $key)->delete();

                continue;
            }
            DB::table('site_settings')->upsert(
                [['key' => $key, 'value' => $value, 'created_at' => now(), 'updated_at' => now()]],
                ['key'],
                ['value', 'updated_at'],
            );
        }

        Cache::forget(self::CACHE_KEY);
    }

    private static function clean(string $type, string $value): string
    {
        $value = trim($value);

        return match ($type) {
            self::BOOL => in_array($value, ['1', 'true', 'on'], true) ? '1' : '0',
            // Never let a stored value become a javascript:/data: link or image source
            self::URL => preg_match('#^(https?://|/(?!/))#i', $value) === 1 ? mb_substr($value, 0, 500) : '',
            self::AREA => mb_substr(strip_tags($value), 0, 1000),
            self::LONG => mb_substr(strip_tags($value), 0, 20000),
            default => mb_substr(strip_tags($value), 0, 255),
        };
    }
}
