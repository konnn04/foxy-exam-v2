import { usePage } from '@inertiajs/react';
import { useLanguage } from '@/contexts/LanguageContext';

type SiteValues = Record<string, string | undefined>;

/**
 * White-label content of the public website. `text('hero.title', fallback)` returns the admin's override for the
 * current language, otherwise the built-in translation passed as fallback.
 */
export function useSite() {
  const site = ((usePage().props as { site?: SiteValues }).site ?? {}) as SiteValues;
  const { lang } = useLanguage();

  return {
    lang,
    /** raw value of a non-localized key */
    get: (key: string, fallback = ''): string => site[key] || fallback,
    /** localized value (`key.vi` / `key.en`) with the built-in text as fallback */
    text: (key: string, fallback = ''): string => site[`${key}.${lang}`] || fallback,
    flag: (key: string): boolean => site[key] !== '0',
  };
}
