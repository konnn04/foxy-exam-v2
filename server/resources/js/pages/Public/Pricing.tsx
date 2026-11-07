import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Check,
  Shield,
  HelpCircle,
  ArrowRight,
  FileText,
  Building,
  GraduationCap,
  Scale,
  Sparkles,
  Zap,
} from 'lucide-react';

import { OFFICIAL_PRICING, OFFICIAL_PRICING_EN } from '@/constants/projectInfo';

interface PlanProps {
  id: number;
  name: string;
  code: string;
  price: number;
  period: string;
  description: string;
  features: string[];
}

interface PricingPageProps {
  plans?: PlanProps[];
}

export default function Pricing({ plans = [] }: PricingPageProps) {
  const { lang, t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<'per_session' | 'semester'>('per_session');

  const pricingSource = lang === 'vi' ? OFFICIAL_PRICING : OFFICIAL_PRICING_EN;

  const sessionPlans = pricingSource.perClass.map((p) => ({
    title: p.title,
    badge: p.scale.toUpperCase(),
    price: p.price,
    unit: p.unit,
    perStudent: p.perStudent,
    desc: p.desc,
    features: p.features,
    popular: p.popular,
    ctaText: p.ctaText,
  }));

  const semesterPlans = pricingSource.semester.map((p) => ({
    title: p.title,
    badge: p.scale.toUpperCase(),
    price: p.price,
    unit: p.unit,
    perStudent: p.perStudent,
    desc: p.desc,
    features: p.features,
    popular: p.popular,
    ctaText: p.ctaText,
  }));

  return (
    <PublicLayout>
      <Head title={t.pricing.metaTitle} />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <Scale className="w-3.5 h-3.5" />
            {t.pricing.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.pricing.heroTitle}
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
            {t.pricing.heroDesc}
          </p>

          {/* Bộ chọn chu kỳ */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/80 border border-slate-300">
            <button
              type="button"
              onClick={() => setBillingCycle('per_session')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                billingCycle === 'per_session'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.pricing.tabPerClass}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('semester')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                billingCycle === 'semester'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.pricing.tabSemester}
            </button>
          </div>
        </div>
      </section>

      {/* Danh sách thẻ giá */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(billingCycle === 'per_session' ? sessionPlans : semesterPlans).map((p, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between p-6 sm:p-8 relative ${
                  p.popular
                    ? 'border-blue-600 shadow-xl shadow-blue-500/10 ring-2 ring-blue-600/20 bg-gradient-to-b from-blue-50/30 to-white'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-wide uppercase shadow-sm">
                    {t.pricing.recommendedBadge}
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase bg-slate-100 px-2.5 py-1 rounded-md">
                      {p.badge}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2.5">{p.title}</h2>
                    <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{p.desc}</p>
                  </div>

                  <div className="my-6 pb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                        {p.price}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">{p.unit}</div>
                    <div className="text-xs text-emerald-600 font-semibold mt-1">
                      {p.perStudent}
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {t.pricing.benefitsLabel}
                    </div>
                    {p.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                        <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/#tu-van"
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-center transition-all flex items-center justify-center gap-2 ${
                    p.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {p.ctaText}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          {/* Ưu đãi khách hàng sáng lập & Gói On-premise */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded">
                  {t.pricing.foundingTitle}
                </span>
                <h3 className="text-xl font-bold mt-3 mb-2">{t.pricing.foundingDiscount}</h3>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed mb-4">
                  {t.pricing.foundingDesc}
                </p>
                <div className="text-xs text-blue-200">
                  {t.pricing.foundingTrial}
                </div>
              </div>
              <Link
                href="/#tu-van"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {t.pricing.foundingCta}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="p-6 sm:p-7 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-blue-400 px-2.5 py-1 rounded border border-slate-700">
                  {pricingSource.onPremise.title}
                </span>
                <div className="mt-3 text-lg font-bold text-white">
                  {pricingSource.onPremise.setupFee}
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  + {pricingSource.onPremise.maintenanceFee}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {pricingSource.onPremise.desc}
                </p>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {pricingSource.onPremise.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href="/#tu-van"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm transition-colors border border-slate-700 cursor-pointer"
              >
                {t.pricing.onPremiseCta}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Cơ sở pháp lý & Hồ sơ mua sắm */}
      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              {t.pricing.legalSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t.pricing.legalSectionDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                {t.pricing.legal1Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.pricing.legal1Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                {t.pricing.legal2Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.pricing.legal2Desc}
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3.5">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                {t.pricing.legal3Title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.pricing.legal3Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bảng so sánh chi phí thực tế */}
      <section className="py-14 bg-white">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              {t.pricing.tableTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {t.pricing.tableDesc}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t.pricing.colCategory}</th>
                  <th className="py-3 px-4 text-slate-500">{t.pricing.colTraditional}</th>
                  <th className="py-3 px-4 text-blue-600 font-bold bg-blue-50/50">
                    {t.pricing.colExamGuard}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-medium">{t.pricing.row1Cat}</td>
                  <td className="py-3 px-4 text-slate-500">{t.pricing.row1Trad}</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    {t.pricing.row1Exam}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">{t.pricing.row2Cat}</td>
                  <td className="py-3 px-4 text-slate-500">{t.pricing.row2Trad}</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    {t.pricing.row2Exam}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">{t.pricing.row3Cat}</td>
                  <td className="py-3 px-4 text-slate-500">{t.pricing.row3Trad}</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    {t.pricing.row3Exam}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">{t.pricing.row4Cat}</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">{t.pricing.row4Trad}</td>
                  <td className="py-3 px-4 text-blue-600 font-bold bg-blue-50/30">
                    {t.pricing.row4Exam}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
