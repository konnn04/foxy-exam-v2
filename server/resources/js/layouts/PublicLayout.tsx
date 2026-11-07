import React, { useState, useEffect } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
  Download,
  Menu,
  X,
  ArrowUp,
  ExternalLink,
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PublicLayoutProps {
  children: React.ReactNode;
}

function PublicLayoutContent({ children }: PublicLayoutProps) {
  const { url } = usePage();
  const { lang, setLang, toggleLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navLinks = [
    { label: t.nav.home, href: '/' },
    { label: t.nav.features, href: '/features' },
    { label: t.nav.pricing, href: '/pricing' },
    { label: t.nav.about, href: '/about' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return url === '/';
    return url.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-['Be_Vietnam_Pro','Instrument_Sans',system-ui,sans-serif] selection:bg-blue-600 selection:text-white antialiased flex flex-col justify-between">
      {/* Top Banner */}
      <div className="bg-slate-950 text-slate-200 border-b border-slate-800 py-1.5 px-4 sm:px-6">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-3 text-[11px] sm:text-[12px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span className="font-bold text-white tracking-wide truncate">
              {t.topBanner.institution}
            </span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="text-slate-300 hidden md:inline truncate">
              {t.topBanner.project}
            </span>
          </div>
          <div className="text-slate-400 hidden lg:flex items-center gap-3 shrink-0 text-[11.5px] font-mono">
            <span className="text-blue-400 font-semibold">{t.topBanner.faculty}</span>
          </div>
        </div>
      </div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[70px]">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs flex items-center justify-center p-1.5 shrink-0 transition-transform group-hover:scale-105">
              <img src="/mark.png" alt="Exam Guard Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[17px] sm:text-[19px] font-black tracking-tight text-slate-900 leading-none whitespace-nowrap group-hover:text-blue-600 transition-colors">
                  EXAM GUARD
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-bold tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                  STEM 2026
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 hidden sm:block truncate mt-0.5">
                {lang === 'vi' ? 'Hệ thống Giám sát Thi cử Trực tuyến' : 'Smart Online Proctoring System'}
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-[14px] font-medium text-slate-700">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors py-1 relative ${
                  isActive(item.href)
                    ? 'text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive(item.href) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </Link>
            ))}
            <a
              href="/docs/api"
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <span>{t.nav.apiDocs}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </nav>

          {/* Action Buttons & Language Switcher */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Language Switcher Button */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setLang('vi')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  lang === 'vi'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tiếng Việt"
              >
                <span>🇻🇳</span>
                <span className="hidden sm:inline">VI</span>
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  lang === 'en'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="English"
              >
                <span>🇬🇧</span>
                <span className="hidden sm:inline">EN</span>
              </button>
            </div>

            <Link
              href="/download"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[13px] sm:text-[13.5px] font-bold rounded-xl transition-colors border border-slate-200"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 88 88">
                <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L0 75.48v-29.35zm4.326-39.043L87.314 0v41.527l-47.318.376zm47.329 44.912l-.011 41.535-47.318-6.678-.041-35.195z"/>
              </svg>
              <span className="hidden sm:inline">{t.nav.downloadApp}</span>
            </Link>

            <Link
              href="/login"
              className="px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] sm:text-[13.5px] font-bold rounded-xl shadow-xs transition-colors whitespace-nowrap"
            >
              {t.nav.portalLogin}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Mở danh mục điều hướng"
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-5 pt-3 pb-5 shadow-lg space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Ngôn ngữ / Language:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLang('vi')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    lang === 'vi' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600'
                  }`}
                >
                  🇻🇳 Tiếng Việt
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    lang === 'en' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600'
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>

            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href="/docs/api"
              target="_blank"
              rel="noreferrer"
              className="block px-3 py-2 text-sm text-slate-600 hover:text-blue-600 flex items-center justify-between"
            >
              <span>{t.nav.apiDocs}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center p-1.5 shadow-2xs">
                  <img src="/mark.png" alt="Exam Guard Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-[18px] font-bold text-white tracking-tight">EXAM GUARD</span>
              </div>
              <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-[420px]">
                {t.footer.brandDesc}
              </p>
              <div className="mt-4 text-xs text-slate-500 font-mono">
                {t.footer.stemBadge}
              </div>
            </div>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                {t.footer.navTitle}
              </div>
              <div><Link href="/" className="hover:text-white transition-colors">{t.nav.home}</Link></div>
              <div><Link href="/features" className="hover:text-white transition-colors">{t.nav.features}</Link></div>
              <div><Link href="/pricing" className="hover:text-white transition-colors">{t.nav.pricing}</Link></div>
              <div><Link href="/download" className="hover:text-white transition-colors">{t.nav.downloadApp}</Link></div>
              <div><Link href="/about" className="hover:text-white transition-colors">{t.nav.about}</Link></div>
            </div>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                {t.footer.contactTitle}
              </div>
              <div>Email: <a href="mailto:minkhoi.dev@gmail.com" className="hover:text-white text-slate-300">minkhoi.dev@gmail.com</a></div>
              <div>Hotline: <span className="text-slate-300 font-semibold">0387 291 237</span> ({t.footer.leaderRole})</div>
              <div>{lang === 'vi' ? 'Địa chỉ' : 'Address'}: <span className="text-slate-300">{t.footer.address}</span></div>
              <div className="pt-2">
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-bold inline-block">
                  {t.footer.accessPortal}
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-mono">
            <span>{t.footer.copyright}</span>
            <span>{t.footer.legalBadge}</span>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Cuộn lên đầu trang"
        className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center cursor-pointer ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return <PublicLayoutContent>{children}</PublicLayoutContent>;
}
