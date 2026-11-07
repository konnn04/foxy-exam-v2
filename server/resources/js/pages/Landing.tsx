import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
  ShieldCheck,
  Laptop,
  Cpu,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Monitor,
  ExternalLink,
  Download,
  Lock,
  Layers,
  FileCheck,
  QrCode,
  Users,
  Award,
  Check,
  Server,
  ArrowRight,
  ArrowUp,
  Clock,
  Database,
  Building2,
  PhoneCall,
  Mail,
  Sparkles,
  HelpCircle,
  FileText,
  Menu,
  X,
  Play,
  Eye,
  Video,
  Wifi,
  Bell,
  Shield,
  RefreshCw,
  BarChart3,
  Smartphone,
  Zap,
  ChevronDown,
  Radio,
  Share2,
} from 'lucide-react';

interface Plan {
  id: number;
  name: string;
  display_name: string;
  price: number;
  billing_cycle: string;
  max_exams_per_month: number;
  max_students_per_exam: number;
  storage_limit_gb: number;
  has_ai_proctoring: boolean;
  has_code_replay: boolean;
}

interface Props {
  plans?: Plan[];
}

export default function Landing({ plans = [] }: Props) {
  // Pricing tab state: 'semester' | 'per_exam' | 'on_premise'
  const [pricingTab, setPricingTab] = useState<'semester' | 'per_exam' | 'on_premise'>('semester');

  // Contact form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formScale, setFormScale] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Scroll to top & mobile menu state
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-['Be_Vietnam_Pro','Instrument_Sans',system-ui,sans-serif] selection:bg-blue-600 selection:text-white antialiased">
      <Head>
        <title>Exam Guard · Hệ thống Giám sát Thi cử Trực tuyến &amp; Phòng máy Thông minh</title>
        <meta
          name="description"
          content="Exam Guard là nền tảng giám sát thi cử thế hệ mới tích hợp AI đa tầng trên thiết bị (Edge AI) và ứng dụng Kiosk Lockdown, tối ưu cho thi trực tuyến, thi phòng máy và thi kết hợp. Cảnh báo thời gian thực trong 2 giây, dữ liệu lưu trữ nội địa tuân thủ Nghị định 13/2023/NĐ-CP."
        />
      </Head>

      {/* =========================================================================
          TOP BANNER: TRANG TRỌNG - TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH
      ========================================================================= */}
      <div className="bg-slate-950 text-slate-200 border-b border-slate-800 py-2 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 text-[11px] sm:text-[12px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span className="font-bold text-white tracking-wide truncate">TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH</span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="text-slate-300 hidden md:inline truncate">
              CUỘC THI “SINH VIÊN VỚI Ý TƯỞNG SÁNG TẠO &amp; KHỞI NGHIỆP” NĂM 2026
            </span>
          </div>
          <div className="text-slate-400 hidden lg:flex items-center gap-3 shrink-0 text-[11.5px] font-mono">
            <span className="text-blue-400 font-semibold">LĨNH VỰC: STEM</span>
            <span>·</span>
            <span>ĐỒ ÁN CÔNG NGHỆ THÔNG TIN</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          HEADER (STICKY CHUẨN, BACKDROP BLUR, NAVIGATION CAO CẤP)
      ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px]">
          {/* Brand Logo & Proctoring Tag */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs flex items-center justify-center p-1.5 shrink-0 transition-transform group-hover:scale-105">
              <img src="/mark.png" alt="Exam Guard Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[17px] sm:text-[19px] font-black tracking-tight text-slate-900 leading-none whitespace-nowrap group-hover:text-blue-600 transition-colors">
                  EXAM GUARD
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-bold tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                  STEM 2026
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 hidden sm:block truncate max-w-[240px] md:max-w-none mt-0.5">
                Hệ thống Giám sát Thi cử Trực tuyến · ĐH Mở TP.HCM
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-5 2xl:gap-7 text-[13.5px] font-medium text-slate-700 whitespace-nowrap">
            <a href="#tong-quan" className="hover:text-blue-600 transition-colors">
              Tổng quan
            </a>
            <a href="#demo" className="text-blue-700 font-bold hover:text-blue-800 transition-colors flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 animate-ping" />
              Video Demo
            </a>
            <a href="#giai-phap" className="hover:text-blue-600 transition-colors">
              Giải pháp đa tầng
            </a>
            <a href="#tinh-nang" className="hover:text-blue-600 transition-colors">
              Tính năng AI
            </a>
            <a href="#quy-trinh" className="hover:text-blue-600 transition-colors">
              Quy trình
            </a>
            <a href="#so-sanh" className="hover:text-blue-600 transition-colors">
              So sánh
            </a>
            <a href="#gia" className="hover:text-blue-600 transition-colors">
              Biểu phí
            </a>
            <a href="#doi-ngu" className="hover:text-blue-600 transition-colors">
              Đội ngũ
            </a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">
              Hỏi đáp
            </a>
            <a
              href="/docs/api"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 font-semibold"
            >
              API <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </nav>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/login"
              className="px-3 sm:px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-[13px] sm:text-[14px] font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Cổng Khảo thí
            </Link>
            <a
              href="#tai-app"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[13.5px] font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-all whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Tải Client (.exe)</span>
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Mở danh mục điều hướng"
              className="xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-200 bg-white px-5 pt-4 pb-6 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-2 text-[14px] font-medium text-slate-700">
              <a href="#tong-quan" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                Tổng quan đề án
              </a>
              <a
                href="#demo"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3.5 py-2.5 rounded-lg text-blue-700 font-bold bg-blue-50/80 hover:bg-blue-100/70 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                Video Demo
              </a>
              <a href="#giai-phap" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                Giải pháp đa tầng
              </a>
              <a href="#tinh-nang" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                Tính năng AI
              </a>
              <a href="#quy-trinh" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                Quy trình khảo thí
              </a>
              <a href="#so-sanh" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                So sánh cạnh tranh
              </a>
              <a href="#gia" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                Biểu phí đề xuất
              </a>
              <a href="#doi-ngu" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                Đội ngũ thực hiện
              </a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="px-3.5 py-2.5 rounded-lg hover:bg-slate-100">
                Hỏi đáp chuyên môn
              </a>
              <a
                href="/docs/api"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2.5 rounded-lg text-blue-600 font-semibold hover:bg-slate-100 flex items-center gap-1"
              >
                API Docs <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
              <a
                href="#tai-app"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-[14px] font-semibold rounded-xl hover:bg-blue-700 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Tải Exam Guard Client (.exe / .msi)
              </a>
              <a
                href="#lien-he"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center py-3 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-xl hover:bg-slate-50"
              >
                Đăng ký thí điểm
              </a>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          HERO SECTION: ENTERPRISE SAAS VISUAL HIERARCHY + PRODUCT MOCKUP
      ========================================================================= */}
      <section id="tong-quan" className="pt-12 sm:pt-16 pb-16 sm:pb-24 bg-gradient-to-b from-blue-50/50 via-white to-slate-50/40 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[12px] sm:text-[13px] font-bold mb-6 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>NỀN TẢNG KHẢO THÍ THẾ HỆ MỚI · KHOA CNTT · ĐH MỞ TP.HCM</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-black tracking-tight text-slate-900 leading-[1.18] max-w-[1020px] mx-auto text-balance">
            Hệ Thống Giám Sát Thi Cử Trực Tuyến &amp; Phòng Máy Thông Minh
            <span className="block text-blue-600 mt-2 font-extrabold">Bảo đảm toàn vẹn và công bằng với Edge AI hai tầng</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 sm:mt-6 text-[15.5px] sm:text-[17.5px] text-slate-600 max-w-[860px] mx-auto leading-relaxed text-pretty">
            Exam Guard kết hợp ứng dụng kiểm soát môi trường thi (<strong>Kiosk Lockdown</strong>) và mô hình trí tuệ nhân tạo phân tích đa tầng trên thiết bị (<strong>Edge AI</strong>). Phát hiện bất thường và trích xuất video đối soát trong vòng <strong>≤ 2 giây</strong>, giúp cơ sở giáo dục tiết kiệm <strong>85–90%</strong> chi phí vận hành so với giải pháp quốc tế.
          </p>

          {/* Call to Actions */}
          <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 sm:gap-4 max-w-md sm:max-w-none mx-auto">
            <a
              href="#lien-he"
              className="px-8 py-3.5 bg-blue-600 text-white text-[15px] font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/25 text-center flex items-center justify-center gap-2 group"
            >
              <span>Đăng ký chương trình thí điểm</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#demo"
              className="px-7 py-3.5 bg-white border border-slate-300 text-slate-700 text-[15px] font-semibold rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs text-center flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 text-blue-600 fill-blue-600" />
              <span>Xem Video Thực Nghiệm</span>
            </a>
          </div>

          {/* Social Proof Metric Highlights */}
          <div className="mt-12 pt-8 border-t border-slate-200/90 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-[1080px] mx-auto text-center">
            <div className="p-3">
              <div className="text-3xl sm:text-4xl font-black text-blue-600 font-mono">≤ 2 giây</div>
              <div className="text-[13px] sm:text-[13.5px] font-medium text-slate-600 mt-1">
                Độ trễ cảnh báo AI kèm video đối soát
              </div>
            </div>
            <div className="p-3 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">1 : 80</div>
              <div className="text-[13px] sm:text-[13.5px] font-medium text-slate-600 mt-1">
                Tỷ lệ giám thị / thí sinh đồng thời
              </div>
            </div>
            <div className="p-3 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">4.500 đ</div>
              <div className="text-[13px] sm:text-[13.5px] font-medium text-slate-600 mt-1">
                Định mức chi phí tối ưu / lượt thi
              </div>
            </div>
            <div className="p-3 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">100%</div>
              <div className="text-[13px] sm:text-[13.5px] font-medium text-slate-600 mt-1">
                Lưu trữ nội địa · Nghị định 13/2023
              </div>
            </div>
          </div>

          {/* =========================================================================
              HIGH-FIDELITY PRODUCT MONITORING DASHBOARD MOCKUP
          ========================================================================= */}
          <div className="mt-12 sm:mt-14 relative max-w-[1120px] mx-auto">
            {/* Ambient Glow */}
            <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-600/15 via-indigo-600/10 to-blue-500/15 rounded-3xl blur-xl -z-10" />

            {/* Dashboard Container */}
            <div className="bg-slate-950 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 text-left overflow-hidden">
              {/* Mockup Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800/90 bg-slate-900/90 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] ml-2 hidden sm:inline">
                    examguard.edu.vn/admin/live/session-it2026
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE · 78/80 THÍ SINH ĐANG THI
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
                    LIVEKIT WEBRTC SFU
                  </span>
                </div>
              </div>

              {/* Dashboard Content Grid */}
              <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 2x2 Candidate Tiles (Span 2 Cols) */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Candidate 1: Normal */}
                  <div className="relative rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 flex flex-col justify-between overflow-hidden group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-bold text-xs text-white">Lê Minh Khoa</span>
                        <span className="text-[10px] font-mono text-slate-400">2351050084</span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                        99.4% KHỚP MẶT
                      </span>
                    </div>
                    {/* Simulated Camera Window */}
                    <div className="relative aspect-video rounded-lg bg-slate-950/90 border border-slate-800/80 flex items-center justify-center overflow-hidden">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <Users className="w-8 h-8 opacity-40" />
                      </div>
                      <div className="absolute top-2 left-2 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-slate-300">
                        CAM 1 (DESKTOP)
                      </div>
                      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> CAM PHỤ OK
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Kiosk: Đã khóa Alt+Tab</span>
                      <span className="text-emerald-400 font-medium">Bình thường</span>
                    </div>
                  </div>

                  {/* Candidate 2: Prohibited Object Warning */}
                  <div className="relative rounded-xl border-2 border-red-500/80 bg-red-950/20 p-3.5 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="font-bold text-xs text-white">Trần Thị Mai</span>
                        <span className="text-[10px] font-mono text-slate-400">2351050112</span>
                      </div>
                      <span className="text-[10px] font-bold text-red-400 bg-red-950/80 border border-red-800 px-1.5 py-0.5 rounded">
                        CẢNH BÁO CẤP 1
                      </span>
                    </div>
                    {/* Simulated Camera with Red Bounding Box */}
                    <div className="relative aspect-video rounded-lg bg-slate-950/90 border border-red-500/40 flex items-center justify-center overflow-hidden">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <Users className="w-8 h-8 opacity-40" />
                      </div>
                      {/* Bounding box simulation */}
                      <div className="absolute bottom-3 left-4 border-2 border-red-500 bg-red-500/20 px-2 py-1 rounded text-[10px] font-bold text-white flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-red-400" />
                        <span>cell phone 91%</span>
                      </div>
                      <div className="absolute top-2 right-2 text-[10px] font-mono bg-red-600 text-white font-bold px-1.5 py-0.5 rounded">
                        ĐÃ TRÍCH VIDEO 15S
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className="text-red-300 font-medium truncate">Phát hiện: Điện thoại di động</span>
                      <button className="text-blue-400 hover:text-blue-300 font-bold text-[11px] underline">
                        Xem 3 góc
                      </button>
                    </div>
                  </div>

                  {/* Candidate 3: Gaze Warning */}
                  <div className="relative rounded-xl border border-amber-500/60 bg-amber-950/15 p-3.5 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="font-bold text-xs text-white">Nguyễn Hoàng Long</span>
                        <span className="text-[10px] font-mono text-slate-400">2351050145</span>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800 px-1.5 py-0.5 rounded">
                        QUAY ĐẦU &gt; 8S
                      </span>
                    </div>
                    <div className="relative aspect-video rounded-lg bg-slate-950/90 border border-slate-800/80 flex items-center justify-center overflow-hidden">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <Users className="w-8 h-8 opacity-40" />
                      </div>
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center">
                        <span className="text-[11px] font-bold text-amber-300 bg-black/70 px-2 py-1 rounded">
                          TỰ ĐỘNG LÀM MỜ ĐỀ THI
                        </span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Điểm tập trung: 72%</span>
                      <span className="text-amber-400 font-medium">Đã gửi nhắc nhở</span>
                    </div>
                  </div>

                  {/* Candidate 4: Normal */}
                  <div className="relative rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-bold text-xs text-white">Phạm Quỳnh Nga</span>
                        <span className="text-[10px] font-mono text-slate-400">2351050210</span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                        98.7% KHỚP MẶT
                      </span>
                    </div>
                    <div className="relative aspect-video rounded-lg bg-slate-950/90 border border-slate-800/80 flex items-center justify-center overflow-hidden">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <Users className="w-8 h-8 opacity-40" />
                      </div>
                      <div className="absolute top-2 left-2 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-slate-300">
                        CAM 1 (DESKTOP)
                      </div>
                      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> CAM PHỤ OK
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Kiosk: Đã khóa Alt+Tab</span>
                      <span className="text-emerald-400 font-medium">Bình thường</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Event Stream & Incident Action Drawer */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between text-xs">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                      <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-blue-400" />
                        Nhật ký cảnh báo tự động
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">03 Sự cố</span>
                    </div>

                    <div className="space-y-2.5 font-mono text-[11px]">
                      <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/60 text-slate-200">
                        <div className="flex items-center justify-between text-red-400 font-bold text-[10.5px]">
                          <span>14:22:18 · PHÁT HIỆN VẬT CẤM</span>
                          <span>SV 02</span>
                        </div>
                        <div className="mt-1 text-slate-300 text-[11.5px] font-sans">
                          Camera phụ nhận diện điện thoại di động trên bàn làm việc (91%).
                        </div>
                        <div className="mt-2 flex items-center gap-2 font-sans">
                          <button className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold">
                            Tạm dừng bài thi
                          </button>
                          <button className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]">
                            Lập biên bản
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-slate-200">
                        <div className="flex items-center justify-between text-amber-400 font-bold text-[10.5px]">
                          <span>14:21:05 · QUAY MẶT NGOÀI GÓC</span>
                          <span>SV 03</span>
                        </div>
                        <div className="mt-1 text-slate-300 text-[11.5px] font-sans">
                          Mất dấu khuôn mặt &gt; 8 giây. Màn hình tự động mờ.
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300">
                        <div className="flex items-center justify-between text-slate-400 font-bold text-[10.5px]">
                          <span>14:20:00 · PRE-CHECK HOÀN TẤT</span>
                          <span>TOÀN PHÒNG</span>
                        </div>
                        <div className="mt-1 text-slate-300 text-[11.5px] font-sans">
                          78/80 thí sinh đã khóa Kiosk và ghép đôi camera phụ.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Độ trễ trung bình: <strong>1.4 giây</strong></span>
                    <span className="text-emerald-400 font-bold">● SFU Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Pills / Highlights around Mockup */}
            <div className="hidden lg:flex items-center gap-2 absolute -top-4 -left-4 bg-white text-slate-800 border border-slate-200 shadow-lg px-3.5 py-1.5 rounded-full text-xs font-bold">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>WebRTC SFU · Độ trễ cảnh báo ≤ 2s</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 absolute -bottom-4 -right-4 bg-white text-slate-800 border border-slate-200 shadow-lg px-3.5 py-1.5 rounded-full text-xs font-bold">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>Kiosk Mode · Chặn Alt+Tab, AnyDesk, Máy ảo</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TICKER BAR: CÔNG NGHỆ CHỦ CHỐT
      ========================================================================= */}
      <div className="overflow-hidden border-b border-blue-200 bg-blue-50/80 py-3 text-blue-900 font-semibold text-[13px] tracking-wide">
        <div className="flex w-max animate-[fxTicker_38s_linear_infinite] hover:[animation-play-state:paused]">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-10 px-5 items-center">
              <span>Ứng dụng Lockdown Kiosk Mode (Tauri v2 + Rust)</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Xác thực khuôn mặt MobileFaceNet &amp; ArcFace</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Nhận diện vật cấm thời gian thực YOLOX</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Độ trễ truyền phát WebRTC SFU ≤ 2 giây</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Trích xuất video bằng chứng có mã băm toàn vẹn</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Camera phụ góc rộng liên kết tức thì qua mã QR</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Bộ đệm ngoại tuyến (Offline Cache) khi rớt mạng</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Định mức kinh phí tiết kiệm từ 4.500 đ/lượt thi</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Tích hợp chuẩn quốc tế Moodle LMS LTI 1.3</span>
              <span className="text-blue-500 font-bold">●</span>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          SECTION: VIDEO THỰC NGHIỆM VẬN HÀNH (#demo)
      ========================================================================= */}
      <section id="demo" className="py-16 sm:py-20 bg-slate-50/80 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/90 border border-blue-200 text-blue-900 text-[12.5px] font-bold mb-4 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            SẢN PHẨM MẪU ĐÃ VẬN HÀNH THỰC TẾ · KHOA CNTT - ĐH MỞ TP.HCM
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Video Thực Nghiệm Vận Hành Hệ Thống Exam Guard
          </h2>
          <p className="mt-3 text-[15.5px] text-slate-600 max-w-[820px] mx-auto leading-relaxed">
            Minh họa quy trình giám sát thực tế: ứng dụng Exam Guard Client khóa môi trường thi trên máy tính phổ thông, mô hình Edge AI tự động phát hiện vật cấm và gửi cảnh báo về bảng điều khiển giám thị trong vòng ≤ 2 giây.
          </p>

          {/* Video Player Card */}
          <div className="mt-8 max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-slate-300 bg-black aspect-video relative group">
            <iframe
              src="https://drive.google.com/file/d/1U-k20_mAvNmi8x24-qqgtex1-4MBj2zJ/preview"
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              title="Exam Guard System Demo Video"
            />
          </div>

          {/* 4 Trust Badges Under Video */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-700 font-medium">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Khóa Kiosk OS-level (Chặn phím tắt &amp; máy ảo)
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Edge AI hai tầng (Không đòi hỏi GPU đắt đỏ)
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Bảng điều khiển giám thị thời gian thực (≤ 2s)
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Video đối soát có mã băm toàn vẹn SHA-256
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 01: THỰC TRẠNG & TÍNH CẤP THIẾT (PROBLEM STATEMENT)
      ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
              01 — Thực trạng &amp; Bất cập Khảo thí
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Những lỗ hổng nghiêm trọng của phương thức coi thi truyền thống
            </h2>
            <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
              Phối hợp các phần mềm họp trực tuyến (Zoom, Google Meet) với website trắc nghiệm không đảm bảo an ninh học thuật, gây quá tải cho cán bộ coi thi và thiếu căn cứ xử lý tranh chấp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-12">
            {/* Problem 1 */}
            <div className="p-7 rounded-2xl border border-red-200/80 bg-red-50/30 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-lg mb-5">
                  <Eye className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  Quá tải thị giác &amp; Bỏ sót gian lận ngoài khung hình
                </h3>
                <p className="mt-3 text-[14.5px] text-slate-600 leading-relaxed">
                  Một giám thị phải quan sát 25–40 luồng video liên tục trong 90 phút. Giới hạn mắt người dẫn đến rủi ro bỏ sót người thi hộ, sử dụng tài liệu dưới góc bàn phím hoặc tai nghe siêu nhỏ.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-red-200/60 text-xs font-semibold text-red-700">
                ❌ Hậu quả: Bất công bằng giữa các thí sinh
              </div>
            </div>

            {/* Problem 2 */}
            <div className="p-7 rounded-2xl border border-amber-200/80 bg-amber-50/30 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg mb-5">
                  <Laptop className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  Máy tính thí sinh hoàn toàn không được kiểm soát
                </h3>
                <p className="mt-3 text-[14.5px] text-slate-600 leading-relaxed">
                  Trình duyệt web thông thường không thể khóa hệ điều hành. Thí sinh dễ dàng dùng UltraViewer cho người ngoài giải hộ, bật ChatGPT trên tab ẩn hoặc chạy đề thi trong môi trường máy ảo.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-amber-200/60 text-xs font-semibold text-amber-800">
                ❌ Hậu quả: Đề thi bị lộ và gian lận tinh vi
              </div>
            </div>

            {/* Problem 3 */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-lg mb-5">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  Thiếu chứng cứ số có giá trị pháp lý khi khiếu nại
                </h3>
                <p className="mt-3 text-[14.5px] text-slate-600 leading-relaxed">
                  Lưu trữ video cả buổi thi gây tốn dung lượng hàng trăm GB và không ai xem lại. Khi phát sinh khiếu nại, nhà trường thiếu đoạn clip ghi đúng khoảnh khắc vi phạm kèm chữ ký xác thực toàn vẹn.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 text-xs font-semibold text-slate-700">
                ❌ Hậu quả: Khó xử lý vi phạm, dễ xảy ra tranh cãi
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02: GIẢI PHÁP ĐA TẦNG (OUR SOLUTION - ALTERNATING LAYOUT)
      ========================================================================= */}
      <section id="giai-phap" className="py-16 sm:py-24 bg-slate-50/60 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
              02 — Kiến trúc Giải pháp Đa tầng
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Hệ Sinh Thái Exam Guard: Bảo vệ toàn diện 360°
            </h2>
            <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
              Kết hợp xử lý Edge AI trên máy thí sinh và hạ tầng máy chủ WebRTC SFU hiện đại, bảo đảm kỳ thi diễn ra minh bạch, an toàn mà không đòi hỏi đầu tư máy chủ GPU đắt đỏ.
            </p>
          </div>

          <div className="space-y-16">
            {/* Solution Item 1: Lockdown Kiosk */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-100/80 text-blue-800 text-xs font-bold uppercase tracking-wider mb-3">
                  TẦNG 1 · BẢO VỆ MÁY TÍNH
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                  Ứng dụng Kiosk Lockdown chuyên dụng trên máy thí sinh
                </h3>
                <p className="mt-4 text-[15.5px] text-slate-600 leading-relaxed">
                  Được xây dựng trên nền tảng Tauri v2 và Rust siêu nhẹ. Ứng dụng tự động khóa toàn màn hình, vô hiệu hóa các tổ hợp phím hệ thống (Alt+Tab, Win Key, PrtScn), ngắt kết nối đa màn hình và phát hiện máy ảo (VMware, VirtualBox).
                </p>
                <div className="mt-6 space-y-2.5 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Chặn hoàn toàn phần mềm điều khiển từ xa (UltraViewer, AnyDesk, TeamViewer)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Bộ đệm ngoại tuyến (Offline Buffer) giữ bài an toàn khi rớt mạng 3–5 phút</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Không đòi hỏi quyền quản trị hệ thống (Admin) khi cài đặt</span>
                  </div>
                </div>
              </div>

              {/* Graphic Mockup */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs font-mono">
                  <span className="text-blue-400 font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> FOXY-LOCKDOWN-ENGINE v2.4
                  </span>
                  <span className="text-emerald-400">● HOẠT ĐỘNG</span>
                </div>
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Hook bàn phím Low-Level:</span>
                    <span className="text-emerald-400 font-bold">ALT+TAB [CHẶN]</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Kiểm tra phần mềm từ xa:</span>
                    <span className="text-emerald-400 font-bold">ANYDESK: 0 TIẾN TRÌNH</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Phát hiện máy ảo Hypervisor:</span>
                    <span className="text-emerald-400 font-bold">VIRTUAL MACHINE: KHÔNG</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Bộ đệm mã hóa bài thi:</span>
                    <span className="text-emerald-400 font-bold">OFFLINE BUFFER [SẴN SÀNG]</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Solution Item 2: AI Identity & Prohibited Objects */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-100/80 text-blue-800 text-xs font-bold uppercase tracking-wider mb-3">
                  TẦNG 2 · AI THỊ GIÁC ĐA TẦNG
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                  Xác thực khuôn mặt &amp; Nhận diện vật cấm thông minh
                </h3>
                <p className="mt-4 text-[15.5px] text-slate-600 leading-relaxed">
                  Mô hình MobileFaceNet &amp; ArcFace chạy trực tiếp trên thiết bị (Edge AI) với tốc độ 5–10 FPS, không gửi video liên tục về máy chủ giúp tiết kiệm 95% băng thông.
                </p>
                <div className="mt-6 space-y-2.5 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đối soát khuôn mặt liên tục, chống thi hộ hoặc tráo người giữa giờ thi</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Phát hiện điện thoại di động, tai nghe, tài liệu và khoanh khung đỏ kèm % tin cậy</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tự động làm mờ màn hình đề thi khi thí sinh quay mặt đi quá ngưỡng cho phép</span>
                  </div>
                </div>
              </div>

              {/* Graphic Mockup */}
              <div className="lg:order-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs font-mono">
                  <span className="text-blue-400 font-bold flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" /> EDGE-AI-PROCTORING-PIPELINE
                  </span>
                  <span className="text-emerald-400">FPS: 8.5 · CPU: 4.2%</span>
                </div>
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>ArcFace Vector Distance:</span>
                    <span className="text-emerald-400 font-bold">COSINE: 0.94 (&gt; 0.35 CHUẨN)</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-red-900/60 flex items-center justify-between text-red-300">
                    <span>YOLOX Object Detector:</span>
                    <span className="text-red-400 font-bold">PHÁT HIỆN: CELL PHONE (91%)</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Ước lượng hướng nhìn (Gaze):</span>
                    <span className="text-slate-300">TRỌNG TÂM: MÀN HÌNH ĐỀ THI</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Solution Item 3: Secondary Mobile Camera via QR */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-100/80 text-blue-800 text-xs font-bold uppercase tracking-wider mb-3">
                  TẦNG 3 · GÓC NHÌN TOÀN CẢNH 360°
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                  Camera phụ góc rộng kết nối không dây qua mã QR
                </h3>
                <p className="mt-4 text-[15.5px] text-slate-600 leading-relaxed">
                  Thí sinh dùng điện thoại thông minh bất kỳ quét mã QR trên màn hình thi để kích hoạt camera thứ hai. Toàn bộ bàn làm việc, thao tác tay gõ phím và màn hình máy tính được truyền trực tiếp đến giám thị mà không cần cài thêm app.
                </p>
                <div className="mt-6 space-y-2.5 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>AI tự động kiểm tra góc đặt điện thoại trước khi cho phép mở đề thi</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Cảnh báo tức thì nếu điện thoại phụ tắt màn hình hoặc bị xê dịch góc quay</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Thực hiện kiểm tra khuôn mặt ngẫu nhiên 10 giây (Spot-check) trên cam phụ</span>
                  </div>
                </div>
              </div>

              {/* Graphic Mockup */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs font-mono">
                  <span className="text-blue-400 font-bold flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" /> DUAL-CAMERA-ROOM-SYNC
                  </span>
                  <span className="text-emerald-400">WEBRTC P2P/SFU</span>
                </div>
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Ghép đôi mã QR:</span>
                    <span className="text-emerald-400 font-bold">XÁC THỰC THÀNH CÔNG</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Góc quan sát bàn làm việc:</span>
                    <span className="text-emerald-400 font-bold">ĐẠT CHUẨN PRE-CHECK</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>Bảo vệ chống khóa màn hình:</span>
                    <span className="text-emerald-400 font-bold">WAKELOCK KÍCH HOẠT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Solution Item 4: Synchronized 3-Angle Evidence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-100/80 text-blue-800 text-xs font-bold uppercase tracking-wider mb-3">
                  TẦNG 4 · MINH BẠCH &amp; PHÁP LÝ
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                  Bằng chứng số đồng bộ 3 góc &amp; Link sharing phúc khảo
                </h3>
                <p className="mt-4 text-[15.5px] text-slate-600 leading-relaxed">
                  Khi AI phát hiện bất thường, hệ thống tự động lưu video 15–30 giây đồng thời từ 3 góc (Cam chính, Cam phụ, Màn hình máy tính) và tạo mã băm toàn vẹn SHA-256 chống chỉnh sửa.
                </p>
                <div className="mt-6 space-y-2.5 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Giảng viên có thể chia sẻ link web xem tổng thể bằng chứng vi phạm cho Hội đồng</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Linh hoạt xuất bản hoặc gỡ xuất bản biên bản vi phạm chỉ bằng một thao tác</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Lưu trữ nội địa và tự động hủy sau khi kết thúc kỳ thi theo Nghị định 13/2023</span>
                  </div>
                </div>
              </div>

              {/* Graphic Mockup */}
              <div className="lg:order-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs font-mono">
                  <span className="text-blue-400 font-bold flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5" /> 3-WAY-EVIDENCE-SYNCHRONIZER
                  </span>
                  <span className="text-blue-400">SHA-256 HASH VERIFIED</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono mb-3">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <div className="text-slate-400 mb-1">GÓC 1</div>
                    <div className="text-white font-bold">CAM CHÍNH</div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <div className="text-slate-400 mb-1">GÓC 2</div>
                    <div className="text-white font-bold">MÀN HÌNH</div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <div className="text-slate-400 mb-1">GÓC 3</div>
                    <div className="text-white font-bold">CAM PHỤ 360°</div>
                  </div>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono flex items-center justify-between">
                  <span className="text-slate-400">Link Sharing Biên bản:</span>
                  <span className="text-blue-400 font-bold">examguard.edu.vn/share/rep-71a2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03: TÍNH NĂNG NỔI BẬT (KEY FEATURES BENTO-GRID)
      ========================================================================= */}
      <section id="tinh-nang" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
              03 — Năng lực Vượt trội
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Bộ Công Cụ Giám Sát Chuyên Nghiệp Cho Khảo Thí
            </h2>
            <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
              Thiết kế tối ưu cho hội đồng thi, phòng đào tạo và cán bộ coi thi, kết hợp tính năng giám sát chủ động và can thiệp từ xa tức thì.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
                  <Server className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Giám sát Tiến trình &amp; Tắt từ xa (Remote Kill)</h3>
                <p className="mt-2.5 text-[14px] text-slate-600 leading-relaxed">
                  Giám thị có thể xem toàn bộ danh sách tiến trình đang chạy trên máy thí sinh và bấm lệnh tắt ứng dụng lạ từ xa mà không cần rời khỏi màn hình giám sát.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>Kiểm soát tiến trình theo thời gian thực</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
                  <Radio className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Can thiệp Trực tiếp: Tạm dừng, Nhắc nhở &amp; Beep</h3>
                <p className="mt-2.5 text-[14px] text-slate-600 leading-relaxed">
                  Bảng điều khiển phát âm thanh beep khi phát hiện sự cố cấp 1, hỗ trợ giám thị tạm dừng bài thi của thí sinh, gửi thông báo cảnh cáo riêng hoặc hủy ca thi.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>Can thiệp tức thì trong vòng 1 giây</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Khóa Thiết Bị (Hardware Fingerprint Lock)</h3>
                <p className="mt-2.5 text-[14px] text-slate-600 leading-relaxed">
                  Ràng buộc tài khoản thí sinh với vân tay phần cứng của máy tính đã đăng ký. Ngăn chặn việc thi hộ bằng cách mượn tài khoản hoặc đăng nhập đồng thời từ máy khác.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>Bảo vệ danh tính thí sinh tuyệt đối</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Cơ chế Reconnect &amp; Bắt buộc Pre-check lại</h3>
                <p className="mt-2.5 text-[14px] text-slate-600 leading-relaxed">
                  Nếu thí sinh bị mất kết nối mạng hoặc cố tình ngắt mạng để gian lận, khi kết nối lại hệ thống bắt buộc quét QR và đối soát lại góc camera trước khi tiếp tục bài thi.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>Loại bỏ lỗ hổng ngắt kết nối giả lập</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 5 */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Thống Kê Vi Phạm &amp; Phân Tích Điểm Tập Trung</h3>
                <p className="mt-2.5 text-[14px] text-slate-600 leading-relaxed">
                  Tự động phân tích biểu đồ vi phạm theo mốc thời gian, tính toán điểm tập trung trung bình của lớp thi và xuất hồ sơ báo cáo định dạng chuẩn PDF/Excel.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>Báo cáo khảo thí tự động</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 6 */}
            <div className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
                  <Share2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Cổng Phúc Khảo &amp; Chia Sẻ Biên Bản Vi Phạm</h3>
                <p className="mt-2.5 text-[14px] text-slate-600 leading-relaxed">
                  Cấp đường dẫn chia sẻ bảo mật chứa toàn bộ video và ảnh chụp vi phạm cho Hội đồng kỷ luật thẩm định. Giảng viên hoàn toàn chủ động xuất bản hoặc gỡ xuất bản.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>Minh bạch hóa hồ sơ xử lý</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 04: QUY TRÌNH TỔ CHỨC KHẢO THÍ (HOW IT WORKS - 4 BƯỚC)
      ========================================================================= */}
      <section id="quy-trinh" className="py-16 sm:py-24 bg-slate-50/60 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
              04 — Quy trình Chuẩn hóa
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              4 Giai Đoạn Vận Hành Một Kỳ Thi Trực Tuyến
            </h2>
            <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
              Hội đồng Khảo thí thực hiện toàn bộ nghiệp vụ trên giao diện web. Thí sinh sử dụng Exam Guard Client đóng gói sẵn, thao tác đơn giản trong 1 phút.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative">
              <div className="text-4xl font-black text-blue-600 font-mono">01</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Khởi tạo &amp; Thiết lập kỳ thi</h3>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">
                Giảng viên nhập ngân hàng câu hỏi, chọn hình thức trắc nghiệm hoặc lập trình, thiết lập danh mục vật cấm và ấn định thời gian làm bài.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative">
              <div className="text-4xl font-black text-blue-600 font-mono">02</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Pre-check &amp; Khóa Kiosk</h3>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">
                Thí sinh mở Exam Guard Client; hệ thống tự động khóa phím tắt, đối soát khuôn mặt và quét QR liên kết camera điện thoại phụ.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative">
              <div className="text-4xl font-black text-blue-600 font-mono">03</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Giám sát &amp; AI Gắn cờ</h3>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">
                Mô hình AI phân tích hành vi 10 FPS. Khi có sự cố, cảnh báo kèm video gửi về giám thị trong ≤ 2 giây để nhắc nhở hoặc lập biên bản.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative">
              <div className="text-4xl font-black text-blue-600 font-mono">04</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Xuất biên bản &amp; Nghiệm thu</h3>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">
                Hệ thống tự động kết xuất bảng điểm, nhật ký sự cố chi tiết và các đoạn video bằng chứng có mã băm toàn vẹn SHA-256.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 05: ĐÁNH GIÁ TÍNH CẠNH TRANH (COMPARISON TABLE)
      ========================================================================= */}
      <section id="so-sanh" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
              05 — Lợi thế Cạnh tranh
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              So Sánh Exam Guard Với Các Giải Pháp Hiện Hành
            </h2>
            <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
              Tối ưu hóa ngân sách giáo dục lên đến 90%, dữ liệu lưu trữ nội địa tuân thủ luật pháp Việt Nam và hỗ trợ kỹ thuật song ngữ tiếng Việt.
            </p>
          </div>

          {/* SaaS Comparison Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[760px] text-left border-collapse text-[14.5px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <th className="p-4 sm:p-5 w-1/4">Chỉ tiêu đánh giá</th>
                  <th className="p-4 sm:p-5 w-1/4">Giải pháp Quốc tế<br /><span className="text-xs text-slate-500 font-normal">(Proctorio, Honorlock, ProctorU)</span></th>
                  <th className="p-4 sm:p-5 w-1/4">Giải pháp Nội địa cơ bản<br /><span className="text-xs text-slate-500 font-normal">(Azota; Safe Exam Browser + Zoom)</span></th>
                  <th className="p-4 sm:p-5 bg-blue-50 text-blue-900 w-1/4 border-l-2 border-r-2 border-blue-500">
                    Exam Guard (ĐH Mở TP.HCM)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Chi phí trên mỗi lượt thi</td>
                  <td className="p-4 sm:p-5 text-slate-600">78.000 – 130.000 đ (tự động); lên tới 340.000 đ (có người giám sát)</td>
                  <td className="p-4 sm:p-5 text-slate-600">Miễn phí cơ bản hoặc thuê bao giáo viên cá nhân</td>
                  <td className="p-4 sm:p-5 bg-blue-50/40 font-bold text-blue-900 border-l-2 border-r-2 border-blue-500">
                    4.500 – 7.500 đ / lượt<br />
                    <span className="text-xs font-semibold text-emerald-700">Tiết kiệm 85–90% so với giải pháp ngoại nhập</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Kiến trúc AI &amp; Băng thông</td>
                  <td className="p-4 sm:p-5 text-slate-600">Xử lý tập trung trên Cloud quốc tế, tốn băng thông và dễ nghẽn mạng</td>
                  <td className="p-4 sm:p-5 text-slate-600">Chỉ kiểm tra chuyển tab, không có AI phân tích hành vi thời gian thực</td>
                  <td className="p-4 sm:p-5 bg-blue-50/40 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    Edge AI xử lý trên máy thí sinh; cảnh báo thời gian thực với độ trễ ≤ 2 giây
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Lưu trữ &amp; Tuân thủ pháp lý</td>
                  <td className="p-4 sm:p-5 text-slate-600">Dữ liệu đặt tại máy chủ nước ngoài, thủ tục chuyển giao phức tạp</td>
                  <td className="p-4 sm:p-5 text-slate-600">Phụ thuộc hạ tầng máy chủ bên thứ ba, không kiểm soát bảo mật</td>
                  <td className="p-4 sm:p-5 bg-blue-50/40 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    100% dữ liệu lưu trữ nội địa tại Việt Nam; tuân thủ Nghị định 13/2023/NĐ-CP
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Đội ngũ hỗ trợ kỹ thuật</td>
                  <td className="p-4 sm:p-5 text-slate-600">Tiếng Anh, chênh lệch múi giờ, không có kỹ thuật viên trực phòng thi</td>
                  <td className="p-4 sm:p-5 text-slate-600">Tự vận hành nội bộ, giám thị kiêm nhiệm xử lý lỗi máy tính</td>
                  <td className="p-4 sm:p-5 bg-blue-50/40 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    Hỗ trợ tiếng Việt 24/7; bố trí nhân sự kỹ thuật trực song song trong suốt ca thi
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Phạm vi ứng dụng</td>
                  <td className="p-4 sm:p-5 text-slate-600">Chuyên biệt cho thi trực tuyến từ xa</td>
                  <td className="p-4 sm:p-5 text-slate-600">Rời rạc giữa thi online và phần mềm phòng máy</td>
                  <td className="p-4 sm:p-5 bg-blue-50/40 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    Dùng chung cho cả thi online từ xa, thi phòng máy tập trung và thi kết hợp (Hybrid)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 06: KHUNG ĐỊNH MỨC KINH PHÍ DỊCH VỤ (PRICING)
      ========================================================================= */}
      <section id="gia" className="py-16 sm:py-24 bg-slate-50/50 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-6 items-end justify-between border-b border-slate-200 pb-8 mb-12">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
                06 — Khung Định Mức Kinh Phí
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Lựa Chọn Gói Triển Khai Phù Hợp Với Cơ Sở Đào Tạo
              </h2>
              <p className="mt-2 max-w-[640px] text-[15px] text-slate-600 leading-relaxed">
                Xây dựng trên biến phí vận hành thực tế (~3.000 đ/lượt thi). Các gói học kỳ đều dưới 100 triệu đồng, phù hợp quy định chỉ định thầu rút gọn theo Nghị định 214/2025/NĐ-CP và Luật Đấu thầu số 22/2023/QH15.
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-3 bg-slate-200/80 p-1.5 rounded-xl border border-slate-300/80 w-full lg:w-auto gap-1">
              <button
                type="button"
                onClick={() => setPricingTab('semester')}
                className={`px-4 py-2.5 rounded-lg text-[13.5px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  pricingTab === 'semester'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Gói Học kỳ (Quy mô cơ sở)
              </button>
              <button
                type="button"
                onClick={() => setPricingTab('per_exam')}
                className={`px-4 py-2.5 rounded-lg text-[13.5px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  pricingTab === 'per_exam'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Gói Ca thi độc lập
              </button>
              <button
                type="button"
                onClick={() => setPricingTab('on_premise')}
                className={`px-4 py-2.5 rounded-lg text-[13.5px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  pricingTab === 'on_premise'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Cài đặt nội bộ (On-Premise)
              </button>
            </div>
          </div>

          {/* TAB 1: GÓI HỌC KỲ */}
          {pricingTab === 'semester' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Pilot Package */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    GÓI THÍ ĐIỂM (PILOT)
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3 font-mono">0 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Dành cho đơn vị thử nghiệm lần đầu</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Hạn mức 200 lượt thi</strong> (01 học phần thực tế)</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Đầy đủ tính năng AI giám sát &amp; Kiosk Lockdown</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Nhân sự kỹ thuật hỗ trợ trực tiếp trong suốt ca thi</span>
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-xl hover:bg-slate-200 transition-colors text-center block"
                >
                  Đăng ký tham gia thí điểm
                </a>
              </div>

              {/* Semester S */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">
                    HỌC KỲ S · CẤP KHOA
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3 font-mono">15.000.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một học kỳ chính quy (2.000 lượt)</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>20 lớp học phần</strong> (≤ 100 SV/lớp)</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Đơn giá tương đương: <strong>7.500 đ/lượt</strong></span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Toàn quyền khai thác mô hình AI &amp; Dashboard</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Chi phí phát sinh vượt hạn mức: 7.000 đ/lượt</span>
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-xl hover:bg-slate-200 transition-colors text-center block"
                >
                  Lựa chọn Gói Học kỳ S
                </a>
              </div>

              {/* Semester M: Recommended */}
              <div className="bg-blue-50/60 border-2 border-blue-600 rounded-2xl p-6 shadow-md flex flex-col justify-between relative">
                <div className="absolute -top-3 right-4 bg-blue-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  KHUYÊN DÙNG
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-800 font-mono">
                    HỌC KỲ M · KHOA LỚN
                  </div>
                  <div className="text-3xl font-black text-blue-900 mt-3 font-mono">32.500.000 đ</div>
                  <div className="text-xs text-blue-700 font-semibold mt-1">Một học kỳ chính quy (5.000 lượt)</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span><strong>50 lớp học phần</strong> (≤ 100 SV/lớp)</span>
                    </div>
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>Đơn giá ưu đãi: <strong>6.500 đ/lượt thi</strong></span>
                    </div>
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>Kỹ thuật viên trực song song hỗ trợ ca thi</span>
                    </div>
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>Chi phí vượt hạn mức: 6.500 đ/lượt thi</span>
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-blue-600 text-white text-[14px] font-bold rounded-xl hover:bg-blue-700 transition-colors text-center block shadow-sm"
                >
                  Lựa chọn Gói Học kỳ M
                </a>
              </div>

              {/* Semester L */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    HỌC KỲ L · TOÀN TRƯỜNG
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3 font-mono">60.000.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một học kỳ chính quy (10.000 lượt)</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>10.000 lượt thi/học kỳ</strong> (chỉ 6.000 đ/lượt)</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Chi phí vượt hạn mức ưu đãi: 5.500 đ/lượt</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Tập huấn nghiệp vụ chuyên sâu cho cán bộ coi thi</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Cam kết SLA tiếp nhận sự cố &lt; 5 phút</span>
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-xl hover:bg-slate-200 transition-colors text-center block"
                >
                  Lựa chọn Gói Học kỳ L
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: GÓI CA THI ĐỘC LẬP */}
          {pricingTab === 'per_exam' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    CA THI · QUY MÔ NHỎ
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3 font-mono">300.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một ca thi độc lập (≤ 50 thí sinh)</div>
                  <div className="mt-6 space-y-2.5 text-[14px] text-slate-700">
                    <div>✓ Đơn giá quy đổi: 6.000 đ/lượt thí sinh</div>
                    <div>✓ Hỗ trợ kỹ thuật giám sát trực tuyến trong ca thi</div>
                    <div>✓ Lưu trữ hồ sơ bằng chứng số trong 12 tháng</div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-xl hover:bg-slate-200 transition-colors text-center block"
                >
                  Đăng ký ca thi 50 SV
                </a>
              </div>

              <div className="bg-blue-50/50 border-2 border-blue-600 rounded-2xl p-7 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">
                    CA THI · TIÊU CHUẨN
                  </div>
                  <div className="text-3xl font-black text-blue-900 mt-3 font-mono">500.000 đ</div>
                  <div className="text-xs text-blue-700 font-semibold mt-1">Một ca thi độc lập (≤ 100 thí sinh)</div>
                  <div className="mt-6 space-y-2.5 text-[14px] text-slate-800">
                    <div>✓ Đơn giá quy đổi: 5.000 đ/lượt thí sinh</div>
                    <div>✓ Đầy đủ mô hình AI đối soát khuôn mặt &amp; vật cấm</div>
                    <div>✓ Nhân sự kỹ thuật phối hợp giám sát trực tuyến</div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-blue-600 text-white text-[14px] font-bold rounded-xl hover:bg-blue-700 transition-colors text-center block"
                >
                  Đăng ký ca thi 100 SV
                </a>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    CA THI · QUY MÔ LỚN
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3 font-mono">1.350.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một ca thi độc lập (≤ 300 thí sinh)</div>
                  <div className="mt-6 space-y-2.5 text-[14px] text-slate-700">
                    <div>✓ Đơn giá ưu đãi: 4.500 đ/lượt thí sinh</div>
                    <div>✓ Cơ chế phân luồng đa phòng thi song song</div>
                    <div>✓ Kết xuất hồ sơ tổng hợp &amp; trích xuất video bằng chứng</div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-xl hover:bg-slate-200 transition-colors text-center block"
                >
                  Đăng ký ca thi 300 SV
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: ON-PREMISE PRIVATE DEPLOYMENT */}
          {pricingTab === 'on_premise' && (
            <div className="p-8 sm:p-12 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <div className="max-w-[880px]">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">
                  MÔ HÌNH CÀI ĐẶT TRÊN HẠ TẦNG NỘI BỘ (ON-PREMISE)
                </div>
                <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Exam Guard On-Premise Private Deployment
                </h3>
                <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
                  Chuyển giao và cài đặt trực tiếp trên hệ thống máy chủ nội bộ của nhà trường hoặc cơ quan khảo thí. Toàn bộ luồng truyền phát video, hình ảnh và cơ sở dữ liệu sinh trắc học được lưu trữ khép kín trong mạng nội bộ, đáp ứng tiêu chuẩn an toàn thông tin cấp độ cao.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 my-7">
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-xs text-slate-500 font-mono uppercase">PHÍ TRIỂN KHAI &amp; CÀI ĐẶT BAN ĐẦU</div>
                    <div className="text-2xl font-black text-blue-700 mt-2 font-mono">30.000.000 đ</div>
                    <p className="text-xs text-slate-500 mt-1">Chi phí thu một lần: Khảo sát, cài đặt hệ thống, kiểm thử tải và chuyển giao kỹ thuật.</p>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
                    <div className="text-xs text-slate-500 font-mono uppercase">PHÍ DUY TRÌ &amp; BẢO HÀNH HÀNG NĂM</div>
                    <div className="text-2xl font-black text-slate-900 mt-2 font-mono">70.000.000 đ / năm</div>
                    <p className="text-xs text-slate-500 mt-1">Cập nhật thuật toán Edge AI, rà soát lỗ hổng an ninh và hỗ trợ kỹ thuật chuyên trách.</p>
                  </div>
                </div>

                <a
                  href="#lien-he"
                  className="inline-flex px-7 py-3.5 bg-blue-600 text-white text-[14.5px] font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Yêu cầu khảo sát kỹ thuật On-premise →
                </a>
              </div>
            </div>
          )}

          {/* Policy & Compliance Banner */}
          <div className="mt-8 p-6 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-900">
                CHÍNH SÁCH ĐỐI TÁC TIÊN PHONG &amp; MỞ RỘNG
              </div>
              <p className="text-[14px] text-slate-700">
                <strong>Dịch vụ bổ sung:</strong> 3.000.000 đ/gói/năm (Gia hạn thời gian lưu trữ video bằng chứng 24 tháng hoặc mô-đun tích hợp Moodle LMS chuẩn LTI 1.3).
              </p>
              <p className="text-[14px] text-emerald-800 font-semibold">
                ★ <strong>Ưu đãi đối tác sáng lập:</strong> Giảm 30% tổng chi phí năm đầu tiên cho 03 đơn vị tiên phong ký kết thỏa thuận hợp tác thương mại.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Căn cứ pháp lý: Nghị định số 214/2025/NĐ-CP · Luật Đấu thầu số 22/2023/QH15
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: AN TOÀN DỮ LIỆU & QUYỀN RIÊNG TƯ (SECURITY & PRIVACY)
      ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
              An toàn &amp; Quyền riêng tư
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Bảo Mật Cấp Độ Enterprise &amp; Tuân Thủ Pháp Luật Việt Nam
            </h2>
            <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
              Exam Guard được thiết kế theo nguyên tắc "Tối thiểu hóa dữ liệu" (Data Minimization) và bảo vệ dữ liệu cá nhân theo Nghị định số 13/2023/NĐ-CP.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Lưu Trữ Nội Địa 100%</h3>
              <p className="mt-2 text-xs sm:text-[13.5px] text-slate-600 leading-relaxed">
                Máy chủ đặt hoàn toàn tại các trung tâm dữ liệu tiêu chuẩn tại Việt Nam, tuyệt đối không gửi luồng video ra nước ngoài.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Mã Hóa AES-256 &amp; TLS 1.3</h3>
              <p className="mt-2 text-xs sm:text-[13.5px] text-slate-600 leading-relaxed">
                Toàn bộ dữ liệu truyền nhận và ảnh đối soát khuôn mặt được mã hóa chuẩn quân sự, bảo vệ chống nghe lén và can thiệp trung gian.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Tối Thiểu Hóa Dữ Liệu</h3>
              <p className="mt-2 text-xs sm:text-[13.5px] text-slate-600 leading-relaxed">
                Hệ thống chỉ lưu lại đoạn video ngắn 15–30s khi có vi phạm; không lưu trữ tràn lan toàn bộ ca thi, tự động xóa theo chu kỳ quy định.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Mã Băm Toàn Vẹn SHA-256</h3>
              <p className="mt-2 text-xs sm:text-[13.5px] text-slate-600 leading-relaxed">
                Mỗi tệp video bằng chứng sinh trích xuất được gắn chữ ký số và mã băm toàn vẹn, bảo đảm giá trị pháp lý khi giải quyết khiếu nại.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: ỨNG DỤNG KHẢO THÍ DÀNH CHO THÍ SINH (#tai-app)
      ========================================================================= */}
      <section id="tai-app" className="py-16 sm:py-24 bg-slate-50/60 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-10 items-center">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
                Ứng dụng dành cho thí sinh
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Exam Guard Client
              </h2>
              <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
                Ứng dụng chuyên dụng khóa môi trường thi (Lockdown Kiosk Mode). Vận hành mượt mà trên phần cứng máy tính phổ thông, tự động đồng bộ khi rớt mạng và không đòi hỏi quyền Admin.
              </p>
              <div className="mt-6 space-y-2 text-xs text-slate-600 font-mono">
                <div>• KIẾN TRÚC: Nền tảng Tauri v2 kết hợp Rust (Tối ưu hóa RAM &lt; 150MB)</div>
                <div>• CẤU HÌNH YÊU CẦU: Máy tính phổ thông (RAM ≥ 4GB, Webcam tích hợp)</div>
                <div>• HỆ ĐIỀU HÀNH HỖ TRỢ: Microsoft Windows 10 / 11 (64-bit)</div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Windows Exe */}
              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Gói cài đặt độc lập (.exe)</h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                      CHO THÍ SINH
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Dành cho thí sinh tham dự kỳ thi cá nhân · Tự động khóa phím tắt và chặn đa nhiệm
                  </p>
                </div>
                <a
                  href="https://github.com/konnn04/foxy-exam-v2/releases/latest"
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-blue-600 text-white text-[14px] font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shrink-0 whitespace-nowrap shadow-sm"
                >
                  <Download className="w-4 h-4 shrink-0" /> Tải bản .exe
                </a>
              </div>

              {/* Room MSI */}
              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Gói triển khai phòng máy tập trung (.msi)</h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      CHO PHÒNG MÁY TRƯỜNG
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Hỗ trợ cài đặt đồng loạt qua chính sách nhóm Active Directory (GPO) hoặc mạng nội bộ (LAN)
                  </p>
                </div>
                <a
                  href="https://github.com/konnn04/foxy-exam-v2/releases/latest"
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-xl hover:bg-slate-200 transition-colors text-center shrink-0 whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 shrink-0" /> Tải gói .msi
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 06: ĐỘI NGŨ THỰC HIỆN ĐỀ ÁN (#doi-ngu)
      ========================================================================= */}
      <section id="doi-ngu" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-4 items-end justify-between border-b border-slate-200 pb-8 mb-10">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
                06 — Đơn vị chủ trì &amp; Nhóm thực hiện
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Đội Ngũ Thực Hiện Đề Án Exam Guard
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[13px] font-bold text-blue-800">
                KHOA CÔNG NGHỆ THÔNG TIN · TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH
              </div>
              <div className="text-xs text-slate-500">Đề án Tham dự Cuộc thi Khởi nghiệp Sinh viên Năm 2026</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Khôi */}
            <div className="p-5 bg-white border-2 border-blue-500 rounded-2xl shadow-xs relative flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase">
                  Trưởng nhóm
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Lê Minh Khôi</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2351050084</div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Điều phối tổng thể đề án, phụ trách quy trình vận hành kỳ thi và phối hợp phát triển mô hình AI.
                </p>
              </div>
              <div className="text-xs font-bold text-blue-800 mt-4 pt-2.5 border-t border-slate-100">
                0387 291 237
              </div>
            </div>

            {/* Triều */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Kỹ thuật &amp; Hạ tầng
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Nguyễn Thanh Triều</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2251052127</div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Phát triển ứng dụng Client, máy chủ backend, kiểm thử tải và tích hợp Edge AI.
                </p>
              </div>
              <div className="text-xs text-slate-600 mt-4 pt-2.5 border-t border-slate-200">
                0772 816 986
              </div>
            </div>

            {/* Kiều */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Tài chính &amp; Rủi ro
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Phạm Thị Diễm Kiều</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2551050116</div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Xây dựng mô hình tài chính, định mức kinh phí và hồ sơ đánh giá tác động dữ liệu (DPIA).
                </p>
              </div>
              <div className="text-xs text-slate-600 mt-4 pt-2.5 border-t border-slate-200">
                0387 631 476
              </div>
            </div>

            {/* Trân */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Pháp chế &amp; Bảo mật
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Cao Đỗ Huyền Trân</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2454050030</div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Xây dựng khung tuân thủ Nghị định 13/2023/NĐ-CP và thỏa thuận xử lý dữ liệu (DPA).
                </p>
              </div>
              <div className="text-xs text-slate-600 mt-4 pt-2.5 border-t border-slate-200 truncate">
                2454050030tran@ou.edu.vn
              </div>
            </div>

            {/* Trang */}
            <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Thị trường &amp; Đối tác
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Lê Phan Huyền Trang</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2454052084</div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Phụ trách liên kết hợp tác B2B, khảo sát nhu cầu thí điểm tại các cơ sở đào tạo.
                </p>
              </div>
              <div className="text-xs text-slate-600 mt-4 pt-2.5 border-t border-slate-200">
                0868 772 951
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: FAQ ACCORDION (HỎI ĐÁP CHUYÊN MÔN)
      ========================================================================= */}
      <section id="faq" className="py-16 sm:py-24 bg-slate-50/50 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-10">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-600">
                Hỏi đáp chuyên môn
              </div>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900 leading-tight">
                Giải Đáp Các Câu Hỏi Trọng Tâm Từ Hội Đồng Khảo Thí
              </h2>
              <p className="mt-3 text-[15px] text-slate-600 leading-relaxed">
                Những thắc mắc phổ biến nhất về hạ tầng công nghệ, an toàn dữ liệu và quy trình phối hợp triển khai kỳ thi.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: 'Nhà trường có cần đầu tư máy chủ chuyên dụng GPU để vận hành hệ thống không?',
                  a: 'Không. Giải pháp kỹ thuật của Exam Guard là phân bổ các mô hình nhận diện thị giác máy tính (YOLOX, MobileFaceNet) xử lý trực tiếp tại thiết bị của thí sinh (Edge AI). Máy chủ của nhà trường hoặc đám mây chỉ làm nhiệm vụ điều phối tín hiệu WebRTC và tiếp nhận dữ liệu nhật ký, do đó hoàn toàn không đòi hỏi hạ tầng máy chủ GPU đắt đỏ.',
                },
                {
                  q: 'Phương án xử lý kỹ thuật khi thí sinh gặp sự cố rớt mạng trong lúc làm bài?',
                  a: 'Ứng dụng Exam Guard Client tích hợp cơ chế bộ đệm ngoại tuyến (Offline Cache) có gắn mã kiểm tra toàn vẹn (Checksum). Khi xảy ra mất kết nối mạng đột ngột trong khoảng 3–5 phút, phiên thi vẫn được duy trì an toàn; thí sinh tiếp tục làm bài và hệ thống tự động đồng bộ đầy đủ bài thi ngay khi kết nối được khôi phục.',
                },
                {
                  q: 'Hệ thống bảo đảm an toàn dữ liệu sinh trắc học và tuân thủ pháp lý như thế nào?',
                  a: 'Đề án thiết kế tuân thủ nguyên tắc "Tối thiểu hóa dữ liệu" (Data Minimization) theo quy định của Nghị định số 13/2023/NĐ-CP: Hệ thống chỉ lưu lại các đoạn video ngắn (15–30 giây) khi phát hiện sự cố bất thường, không lưu trữ tràn lan luồng video toàn phiên. Dữ liệu được mã hóa chuẩn AES-256, lưu trữ hoàn toàn trên hệ thống máy chủ đặt tại Việt Nam và tự động hủy sau khi kết thúc kỳ thi.',
                },
                {
                  q: 'Mô hình trí tuệ nhân tạo (AI) có quyền tự động đình chỉ hay hủy bài thi của thí sinh không?',
                  a: 'Tuyệt đối không. Trí tuệ nhân tạo chỉ đóng vai trò phân tích, gắn cờ và gửi cảnh báo kèm đoạn video bằng chứng đến bảng điều khiển của giám thị. Toàn bộ thẩm quyền quyết định nhắc nhở, lập biên bản vi phạm hoặc đình chỉ thi thuộc về cán bộ coi thi và Hội đồng Khảo thí của nhà trường.',
                },
                {
                  q: 'Exam Guard có hỗ trợ tích hợp với hệ thống LMS sẵn có của trường không?',
                  a: 'Có. Hệ thống hỗ trợ tích hợp theo chuẩn quốc tế LTI 1.3 với Moodle LMS, Canvas, Blackboard và cung cấp RESTful API đầy đủ, cho phép đồng bộ danh sách lớp học phần, ngân hàng câu hỏi và điểm số về cơ sở dữ liệu của nhà trường một cách liền mạch.',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-5 text-left text-[15.5px] font-bold text-slate-900 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-blue-600 shrink-0 transition-transform duration-200 ${
                        openFaq === idx ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-5 pt-1 text-[14.5px] text-slate-600 leading-relaxed border-t border-slate-100 animate-in fade-in-50 duration-150">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: ĐĂNG KÝ THÍ ĐIỂM / LIÊN HỆ HỢP TÁC (#lien-he)
      ========================================================================= */}
      <section id="lien-he" className="py-16 sm:py-24 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 text-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div>
              <div className="inline-block px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-full text-xs font-bold uppercase tracking-wider text-blue-100">
                HỢP TÁC &amp; TRIỂN KHAI THÍ ĐIỂM
              </div>
              <h2 className="mt-4 text-3xl sm:text-5xl font-black leading-tight text-white">
                Đăng Ký Tham Gia Chương Trình Thí Điểm Khảo Thí
              </h2>
              <p className="mt-4 text-[16px] text-blue-100 leading-relaxed max-w-[520px]">
                Ban điều hành dự án Exam Guard hỗ trợ các đơn vị giáo dục tổ chức thi thử nghiệm (quy mô tối đa 200 lượt thi) vận hành song song với phương thức hiện hành, nhằm thẩm định khách quan độ chính xác của mô hình và tính tối ưu hóa nhân lực coi thi.
              </p>

              <div className="mt-8 space-y-3.5 text-[14px]">
                <div className="flex items-center gap-3">
                  <span className="w-24 text-blue-200 font-semibold">TRƯỞNG NHÓM:</span>
                  <span className="font-bold text-white">Lê Minh Khôi (0387 291 237)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-blue-200 font-semibold">EMAIL:</span>
                  <span className="font-bold text-white">minkhoi.dev@gmail.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-blue-200 font-semibold">ĐƠN VỊ:</span>
                  <span className="text-white">Khoa Công nghệ Thông tin · Trường Đại học Mở TP.HCM</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-blue-200 font-semibold">ĐỊA CHỈ:</span>
                  <span className="text-white">35 - 37 Hồ Hảo Hớn, Phường Cô Giang, Quận 1, TP. Hồ Chí Minh</span>
                </div>
              </div>
            </div>

            {/* Right Column: Lead Form */}
            <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-10 shadow-2xl">
              {isSubmitted ? (
                <div className="py-10 text-center space-y-3 animate-in fade-in-50 duration-300">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Đã Tiếp Nhận Yêu Cầu Thí Điểm</h3>
                  <p className="text-[14.5px] text-slate-600 leading-relaxed max-w-md mx-auto">
                    Ban phụ trách dự án Exam Guard sẽ liên hệ qua thư điện tử <strong>{formEmail}</strong> hoặc số điện thoại <strong>{formPhone}</strong> trong vòng 24 giờ làm việc để cung cấp tài liệu kỹ thuật và thống nhất kế hoạch triển khai.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Phiếu Đăng Ký Tư Vấn &amp; Thí Điểm</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Dành cho Ban Giám hiệu, Phòng Khảo thí, Phòng Đào tạo và Ban Chủ nhiệm các Khoa.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Họ tên cán bộ đại diện / Giảng viên *
                    </label>
                    <input
                      type="text"
                      placeholder="ThS. Nguyễn Văn A"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Email công vụ *
                      </label>
                      <input
                        type="email"
                        placeholder="canbo@ou.edu.vn"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Số điện thoại liên hệ *
                      </label>
                      <input
                        type="tel"
                        placeholder="09xx xxx xxx"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        required
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Cơ quan / Đơn vị đào tạo
                      </label>
                      <input
                        type="text"
                        placeholder="Trường / Khoa đào tạo"
                        value={formOrg}
                        onChange={(e) => setFormOrg(e.target.value)}
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Quy mô dự kiến
                      </label>
                      <input
                        type="text"
                        placeholder="VD: 01 học phần (200 sinh viên)"
                        value={formScale}
                        onChange={(e) => setFormScale(e.target.value)}
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 text-white text-[15px] font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/25 cursor-pointer mt-2"
                  >
                    Gửi Phiếu Đăng Ký Thí Điểm
                  </button>

                  <p className="text-[11.5px] text-slate-500 text-center">
                    Dữ liệu chỉ phục vụ mục đích nghiên cứu học thuật và trao đổi kế hoạch triển khai giải pháp.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER: BẢN QUYỀN HỌC THUẬT & PHÁP LÝ ĐỀ ÁN
      ========================================================================= */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1 */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center p-1.5 shadow-2xs">
                  <img src="/mark.png" alt="Exam Guard Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-[18px] font-bold text-white tracking-tight">EXAM GUARD</span>
              </div>
              <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-[420px]">
                Hệ thống giám sát thi cử trực tuyến và phòng máy thông minh. Đề án phát triển từ đồ án chuyên ngành Công nghệ thông tin, Trường Đại học Mở TP. Hồ Chí Minh.
              </p>
              <div className="mt-4 text-xs text-slate-500 font-mono">
                STEM 2026 · Nền tảng Edge AI &amp; LiveKit SFU Realtime
              </div>
            </div>

            {/* Col 2 */}
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Mục lục đề án
              </div>
              <div><a href="#tong-quan" className="hover:text-white transition-colors">Tổng quan &amp; Giá trị dự án</a></div>
              <div><a href="#demo" className="hover:text-white transition-colors">Video thực nghiệm hệ thống</a></div>
              <div><a href="#giai-phap" className="hover:text-white transition-colors">Kiến trúc kỹ thuật đa tầng</a></div>
              <div><a href="#tinh-nang" className="hover:text-white transition-colors">Tính năng giám sát AI</a></div>
              <div><a href="#so-sanh" className="hover:text-white transition-colors">Đánh giá tính cạnh tranh</a></div>
              <div><a href="#gia" className="hover:text-white transition-colors">Khung định mức kinh phí</a></div>
              <div><a href="#doi-ngu" className="hover:text-white transition-colors">Đội ngũ thực hiện đề án</a></div>
            </div>

            {/* Col 3 */}
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Thông tin liên hệ
              </div>
              <div>Thư điện tử: <a href="mailto:minkhoi.dev@gmail.com" className="hover:text-white text-slate-300">minkhoi.dev@gmail.com</a></div>
              <div>Điện thoại điều phối: <span className="text-slate-300">0387 291 237</span> (Trưởng nhóm)</div>
              <div>Địa chỉ: <span className="text-slate-300">35 - 37 Hồ Hảo Hớn, Q.1, TP.HCM</span></div>
              <div className="pt-2">
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-bold inline-block">
                  Truy cập Cổng Khảo thí →
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-mono">
            <span>© 2026 EXAM GUARD · TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH · STEM 2026</span>
            <span>PHÁT TRIỂN TẠI VIỆT NAM · BẢO MẬT DỮ LIỆU NỘI ĐỊA NGHỊ ĐỊNH 13</span>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          NÚT CUỘN LÊN ĐẦU TRANG (BACK TO TOP)
      ========================================================================= */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Cuộn lên đầu trang"
        title="Cuộn lên đầu trang"
        className={`fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl focus:outline-hidden flex items-center justify-center transition-all duration-300 cursor-pointer ${
          showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
}
