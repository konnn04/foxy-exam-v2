import React from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ShieldCheck,
  Lock,
  Server,
  Ban,
  FileCheck2,
  Calendar,
  Eye,
  UserCheck,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface PolicySection {
  title: string;
  body: string;
}

interface Props {
  version: string;
  initialLang?: string;
  sections: PolicySection[];
  sections_vi?: PolicySection[];
  sections_en?: PolicySection[];
}

/**
 * Biometric Data Processing Policy Page
 * Fully responsive, bilingual (VI/EN), integrated with PublicLayout.
 */
export default function BiometricPolicy({
  version,
  sections,
  sections_vi,
  sections_en,
}: Props) {
  const { lang, t } = useLanguage();

  // Determine current active sections according to selected language
  const activeSections =
    lang === 'en'
      ? (sections_en && sections_en.length > 0 ? sections_en : sections)
      : (sections_vi && sections_vi.length > 0 ? sections_vi : sections);

  const sectionIcons = [
    Lock,        // 1. Processed Data
    TargetIcon,  // 2. Purpose
    Eye,         // 3. Who has access
    Calendar,    // 4. Retention
    UserCheck,   // 5. Rights
    CheckCircle2 // 6. Login consent
  ];

  function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
    return <FileCheck2 {...(props as any)} />;
  }

  return (
    <PublicLayout>
      <Head title={t.biometricPolicy.metaTitle} />

      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t.biometricPolicy.heroBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.biometricPolicy.heroTitle}
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
            {t.biometricPolicy.heroDesc}
          </p>

          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs text-slate-700 font-mono">
            <span className="font-semibold text-slate-900">{t.biometricPolicy.versionLabel}</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
              {version}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-sans">{t.biometricPolicy.versionSub}</span>
          </div>
        </div>
      </section>

      {/* 3 Core Principles */}
      <section className="py-10 bg-white border-b border-slate-100">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              {t.biometricPolicy.principlesTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {t.biometricPolicy.principlesSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">
                {t.biometricPolicy.principle1Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.biometricPolicy.principle1Desc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">
                {t.biometricPolicy.principle2Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.biometricPolicy.principle2Desc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <Ban className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">
                {t.biometricPolicy.principle3Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.biometricPolicy.principle3Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Policy Sections */}
      <section className="py-12 sm:py-16 bg-slate-50">
        <div className="max-w-[850px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {activeSections.map((s, i) => {
              const IconComp = sectionIcons[i] || ShieldCheck;
              return (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold text-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <IconComp className="w-4 h-4 text-blue-600 shrink-0" />
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {s.title}
                        </h2>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {s.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Candidate Rights Banner */}
          <div className="mt-8 p-5 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <strong className="text-slate-900 block mb-0.5">
                {t.biometricPolicy.rightsTitle}
              </strong>
              <p className="text-slate-600 leading-relaxed">
                {t.biometricPolicy.rightsDesc}
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.biometricPolicy.backHome}
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
