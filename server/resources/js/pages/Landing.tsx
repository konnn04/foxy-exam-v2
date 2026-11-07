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
    <div className="min-h-screen bg-white text-slate-900 font-['Be_Vietnam_Pro',system-ui,sans-serif] selection:bg-blue-600 selection:text-white antialiased">
      <Head>
        <title>Exam Guard · Hệ thống Giám sát Thi cử Trực tuyến Thông minh</title>
        <meta
          name="description"
          content="Exam Guard là nền tảng giám sát thi cử thế hệ mới tích hợp AI đa tầng trên thiết bị (Edge AI) và ứng dụng Kiosk Lockdown, tối ưu cho thi trực tuyến, thi tại phòng máy và thi kết hợp. Cảnh báo thời gian thực trong 2 giây, dữ liệu lưu trữ tại Việt Nam tuân thủ Nghị định 13/2023/NĐ-CP."
        />
      </Head>

      {/* =========================================================================
          TOP BANNER: TRANG TRỌNG - TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH
      ========================================================================= */}
      <div className="bg-slate-900 text-slate-200 border-b border-slate-800 py-2 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2 text-[11px] sm:text-[12px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span className="font-bold text-white tracking-wide truncate">TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH</span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="text-slate-300 hidden md:inline truncate">CUỘC THI “SINH VIÊN VỚI Ý TƯỞNG SÁNG TẠO &amp; KHỞI NGHIỆP” NĂM 2026</span>
          </div>
          <div className="text-slate-400 hidden lg:flex items-center gap-3 shrink-0 text-[11.5px] font-['IBM_Plex_Mono',monospace]">
            <span>LĨNH VỰC: STEM</span>
            <span>·</span>
            <span>ĐỒ ÁN CNTT</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          HEADER (STICKY CHUẨN, KHÔNG RỚT DÒNG NÚT, HỖ TRỢ MENU MOBILE)
      ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[70px]">
          {/* Brand Logo & Proctoring Tag */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs flex items-center justify-center p-1.5 shrink-0 transition-transform group-hover:scale-105">
              <img src="/mark.png" alt="Exam Guard Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[16px] sm:text-[19px] font-black tracking-tight text-slate-900 leading-none whitespace-nowrap group-hover:text-blue-700 transition-colors">
                  EXAM GUARD
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-bold tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                  STEM 2026
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 hidden sm:block truncate max-w-[230px] md:max-w-none mt-0.5">
                Hệ thống Giám sát Thi cử Trực tuyến · ĐH Mở TP.HCM
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-4 2xl:gap-6 text-[13.5px] font-medium text-slate-700 whitespace-nowrap">
            <a href="#tong-quan" className="hover:text-blue-600 transition-colors">
              Tổng quan
            </a>
            <a href="#demo" className="text-blue-700 font-bold hover:text-blue-800 transition-colors flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              Video Demo
            </a>
            <a href="#nang-luc" className="hover:text-blue-600 transition-colors">
              Công nghệ
            </a>
            <a href="#so-sanh" className="hover:text-blue-600 transition-colors">
              Cạnh tranh
            </a>
            <a href="#van-hanh" className="hover:text-blue-600 transition-colors">
              Quy trình
            </a>
            <a href="#gia" className="hover:text-blue-600 transition-colors">
              Biểu phí
            </a>
            <a href="#doi-ngu" className="hover:text-blue-600 transition-colors">
              Đội ngũ
            </a>
            <a href="/docs/api" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 font-semibold">
              API <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </nav>

          {/* Header Actions (Never wraps onto a second row) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <Link
              href="/login"
              className="px-2.5 sm:px-3.5 py-2 border border-slate-300 text-slate-700 rounded-lg text-[12.5px] sm:text-[13.5px] font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Cổng Khảo thí
            </Link>
            <a
              href="#tai-app"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 lg:px-4 py-2 bg-blue-600 text-white text-[13px] lg:text-[13.5px] font-semibold rounded-lg hover:bg-blue-700 shadow-xs transition-all whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Tải Client</span>
              <span className="hidden lg:inline">(.exe)</span>
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Mở danh mục điều hướng"
              className="xl:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 shadow-lg">
            <div className="grid grid-cols-2 gap-1.5 text-[14px] font-medium text-slate-700">
              <a href="#tong-quan" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-slate-100">
                Tổng quan đề án
              </a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg text-blue-700 font-bold bg-blue-50/70 hover:bg-blue-100/70 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                Video Demo
              </a>
              <a href="#nang-luc" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-slate-100">
                Trụ cột công nghệ
              </a>
              <a href="#so-sanh" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-slate-100">
                Tính cạnh tranh
              </a>
              <a href="#van-hanh" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-slate-100">
                Quy trình tổ chức
              </a>
              <a href="#gia" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-slate-100">
                Biểu phí đề xuất
              </a>
              <a href="#doi-ngu" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-slate-100">
                Đội ngũ thực hiện
              </a>
              <a href="/docs/api" target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg text-blue-600 font-semibold hover:bg-slate-100 flex items-center gap-1">
                API Docs <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <a
                href="#tai-app"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-[14px] font-semibold rounded-lg hover:bg-blue-700 shadow-xs"
              >
                <Download className="w-4 h-4" />
                Tải Exam Guard Client (.exe / .msi)
              </a>
              <a
                href="#lien-he"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 flex items-center justify-center py-2.5 border border-slate-300 text-slate-700 text-[14px] font-semibold rounded-lg hover:bg-slate-50"
              >
                Đăng ký thí điểm
              </a>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          HERO SECTION (TRANG TRỌNG, HỌC THUẬT, CHUẨN THUYẾT MINH ĐỀ TÀI)
      ========================================================================= */}
      <section id="tong-quan" className="pt-12 pb-16 sm:pt-16 sm:pb-20 bg-gradient-to-b from-blue-50/40 via-white to-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] sm:text-[12.5px] font-bold mb-6 shadow-2xs max-w-full">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate sm:whitespace-normal">ĐỀ ÁN KHỞI NGHIỆP SINH VIÊN 2026 · KHOA CNTT · ĐH MỞ TP.HCM</span>
          </div>

          {/* Clean Academic Headline */}
          <h1 className="text-2xl sm:text-5xl lg:text-[50px] font-black tracking-tight text-slate-900 leading-[1.22] max-w-[980px] mx-auto text-balance">
            Hệ Thống Giám Sát Thi Cử Trực Tuyến Thông Minh
            <span className="block text-blue-700 mt-1">Bảo đảm tính toàn vẹn và công bằng trong khảo thí</span>
          </h1>

          {/* Subtitle - Academic Tone */}
          <p className="mt-4 sm:mt-5 text-[15px] sm:text-[17px] text-slate-700 max-w-[820px] mx-auto leading-relaxed text-pretty">
            Exam Guard tích hợp ứng dụng kiểm soát môi trường thi (Lockdown Kiosk) và mô hình trí tuệ nhân tạo phân tích đa tầng trên thiết bị (Edge AI). Hệ thống tự động cảnh báo hành vi bất thường kèm trích xuất đoạn video bằng chứng trong vòng <strong>2 giây</strong>, hỗ trợ cơ sở đào tạo tối ưu hóa 85–90% chi phí vận hành khảo thí.
          </p>

          {/* Action Buttons */}
          <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
            <a
              href="#lien-he"
              className="px-6 sm:px-8 py-3.5 bg-blue-600 text-white text-[14.5px] sm:text-[15px] font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 text-center whitespace-nowrap"
            >
              Đăng ký chương trình thí điểm
            </a>
            <a
              href="#gia"
              className="px-6 sm:px-8 py-3.5 bg-white border border-slate-300 text-slate-700 text-[14.5px] sm:text-[15px] font-semibold rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs text-center whitespace-nowrap"
            >
              Khung định mức kinh phí
            </a>
          </div>

          {/* 3 Core Highlight Numbers */}
          <div className="mt-12 pt-8 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-[900px] mx-auto">
            <div className="p-2">
              <div className="text-3xl font-black text-blue-700">≤ 2 giây</div>
              <div className="text-[13.5px] font-medium text-slate-600 mt-1">Độ trễ cảnh báo vi phạm kèm video đối soát</div>
            </div>
            <div className="p-2 sm:border-x border-slate-200">
              <div className="text-3xl font-black text-slate-900">4.500 – 7.500 đ</div>
              <div className="text-[13.5px] font-medium text-slate-600 mt-1">Định mức chi phí trên mỗi lượt thi sinh viên</div>
            </div>
            <div className="p-2">
              <div className="text-3xl font-black text-slate-900">1 : 80 Thí sinh</div>
              <div className="text-[13.5px] font-medium text-slate-600 mt-1">Năng lực giám sát đồng thời của một cán bộ coi thi</div>
            </div>
          </div>

          {/* Clean Preview Card */}
          <div className="mt-12 max-w-[920px] mx-auto bg-slate-900 text-slate-100 rounded-2xl p-5 sm:p-7 shadow-xl border border-slate-800 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-semibold text-sm text-slate-200">
                  Giao diện Giám sát Khảo thí Trực tuyến · Phòng thi 80 Thí sinh (Khoa CNTT - ĐH Mở TP.HCM)
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
                ● WEBRTC SFU STREAM
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">TRẠNG THÁI CA THI</div>
                <div className="text-lg font-bold text-white mt-1">78 / 80 Thí sinh đang kết nối</div>
                <div className="text-xs text-emerald-400 mt-1">Khóa môi trường Kiosk kích hoạt</div>
              </div>
              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">PHÁT HIỆN SỰ CỐ AI</div>
                <div className="text-lg font-bold text-amber-400 mt-1">02 Cảnh báo tự động</div>
                <div className="text-xs text-slate-300 mt-1">Đã trích xuất đoạn video đối soát</div>
              </div>
              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">AN TOÀN DỮ LIỆU</div>
                <div className="text-lg font-bold text-blue-400 mt-1">Mã hóa AES-256</div>
                <div className="text-xs text-slate-300 mt-1">Lưu trữ nội địa (Nghị định 13/2023/NĐ-CP)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TICKER BAR: CÁC ĐẶC TÍNH KỸ THUẬT CHUẨN XÁC
      ========================================================================= */}
      <div className="overflow-hidden border-b border-blue-200 bg-blue-50/80 py-3 text-blue-900 font-semibold text-[13px] tracking-wide">
        <div className="flex w-max animate-[fxTicker_38s_linear_infinite] hover:[animation-play-state:paused]">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-10 px-5 items-center">
              <span>Ứng dụng Lockdown Kiosk Mode</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Xác thực khuôn mặt MobileFaceNet</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Phát hiện vật cấm thị giác YOLOX</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Độ trễ cảnh báo thời gian thực ≤ 2 giây</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Trích xuất video bằng chứng xác thực toàn vẹn</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Camera phụ góc rộng liên kết qua mã QR</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Tuân thủ Nghị định số 13/2023/NĐ-CP</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Cơ chế bộ đệm ngoại tuyến (Offline Cache)</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Tối ưu hóa kinh phí từ 4.500 đ/lượt</span>
              <span className="text-blue-500 font-bold">●</span>
              <span>Tích hợp hệ thống quản lý học tập Moodle LMS</span>
              <span className="text-blue-500 font-bold">●</span>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          SECTION: VIDEO THỰC NGHIỆM VẬN HÀNH (#demo)
      ========================================================================= */}
      <section id="demo" className="py-14 sm:py-20 bg-slate-50/70 border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/90 border border-blue-200 text-blue-900 text-[12.5px] font-bold mb-4 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            SẢN PHẨM MẪU ĐÃ VẬN HÀNH THỰC TẾ · KHOA CÔNG NGHỆ THÔNG TIN - ĐH MỞ TP.HCM
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Video Thực Nghiệm Vận Hành Hệ Thống Exam Guard
          </h2>
          <p className="mt-3 text-[15.5px] text-slate-600 max-w-[800px] mx-auto leading-relaxed">
            Minh họa quy trình giám sát thực nghiệm: ứng dụng Exam Guard Client khóa môi trường thi trên phần cứng phổ thông, mô hình AI phát hiện vật cấm và sự cố bất thường, truyền dữ liệu thời gian thực về bảng điều khiển giám thị với độ trễ ≤ 2 giây.
          </p>

          <div className="mt-8 max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-slate-300 bg-black aspect-video">
            <iframe
              src="https://drive.google.com/file/d/1U-k20_mAvNmi8x24-qqgtex1-4MBj2zJ/preview"
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              title="Exam Guard System Demo Video"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-700 font-medium">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Khóa môi trường Kiosk Mode trên hệ điều hành
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Mô hình AI hai tầng: Edge AI phân tán &amp; Server AI
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Bảng điều khiển giám thị thời gian thực (≤ 2 giây)
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Tự động trích đoạn video đối soát có mã băm toàn vẹn
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 01: THỰC TRẠNG KHẢO THÍ & TÍNH CẤP THIẾT CỦA ĐỀ TÀI
      ========================================================================= */}
      <section className="py-14 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
                01 — Thực trạng &amp; Tính cấp thiết của đề tài
              </div>
              <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                Những hạn chế cốt lõi trong phương thức coi thi trực tuyến truyền thống
              </h2>
              <p className="mt-4 text-[15.5px] text-slate-700 leading-relaxed">
                Thực tế tại các cơ sở đào tạo, việc phối hợp các phần mềm hội nghị trực tuyến (Zoom, MS Teams, Google Meet) với hệ thống thi trắc nghiệm tồn tại nhiều bất cập nghiêm trọng về an ninh học thuật, gây áp lực kiểm soát thị giác và thiếu căn cứ pháp lý giải quyết khiếu nại.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 border border-slate-200 bg-slate-50/60 rounded-xl flex gap-4 items-start">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  01
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Quá tải giám sát thị giác và rủi ro bỏ sót vi phạm</h3>
                  <p className="text-[14.5px] text-slate-600 mt-1 leading-relaxed">
                    Một cán bộ coi thi phải quan sát đồng thời 25–40 luồng video trong 90–120 phút. Giới hạn nhận thức thị giác và mệt mỏi thể chất dẫn đến nguy cơ bỏ sót các hành vi vi phạm như tráo đổi người thi, tra cứu tài liệu ngoài khung hình hoặc sử dụng thiết bị phụ trợ.
                  </p>
                </div>
              </div>

              <div className="p-5 border border-slate-200 bg-slate-50/60 rounded-xl flex gap-4 items-start">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  02
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Môi trường máy tính của thí sinh không được kiểm soát</h3>
                  <p className="text-[14.5px] text-slate-600 mt-1 leading-relaxed">
                    Trình duyệt web thông thường không thể can thiệp khóa hệ điều hành, không vô hiệu hóa được phần mềm điều khiển từ xa (AnyDesk, UltraViewer), môi trường máy ảo (VMware) hay thao tác tương tác với công cụ trí tuệ nhân tạo tạo sinh.
                  </p>
                </div>
              </div>

              <div className="p-5 border border-slate-200 bg-slate-50/60 rounded-xl flex gap-4 items-start">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  03
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Thiếu căn cứ dữ liệu số có giá trị pháp lý khi xử lý khiếu nại</h3>
                  <p className="text-[14.5px] text-slate-600 mt-1 leading-relaxed">
                    Việc lưu trữ toàn bộ phiên thi video gây lãng phí dung lượng và tốn kém thời gian hậu kiểm. Khi phát sinh khiếu nại, nhà trường thiếu các đoạn trích xuất chính xác thời điểm xảy ra sự cố kèm chữ ký số xác thực tính toàn vẹn của dữ liệu.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02: 6 TRỤ CỘT CÔNG NGHỆ CỐT LÕI (CHUẨN THUYẾT MINH)
      ========================================================================= */}
      <section id="nang-luc" className="py-16 sm:py-20 bg-slate-50/50 border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="flex flex-wrap gap-4 items-end justify-between border-b border-slate-200 pb-8">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
                02 — Kiến trúc giải pháp kỹ thuật
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Hệ sinh thái Exam Guard: 6 giải pháp kỹ thuật tích hợp
              </h2>
            </div>
            <p className="max-w-[540px] text-[15px] text-slate-600 leading-relaxed">
              Kiến trúc phân tán kết hợp xử lý AI tại biên (Edge AI) và máy chủ truyền thông WebRTC SFU (LiveKit), vận hành ổn định trên máy tính phổ thông và hạ tầng máy chủ tiêu chuẩn, không đòi hỏi phần cứng GPU đắt đỏ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {/* Pillar 01 */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-5">
                <Lock className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">T.01 · HOÀN THÀNH</div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">Ứng dụng kiểm soát môi trường (Lockdown Kiosk)</h3>
              <p className="text-[14.5px] text-slate-600 mt-3 leading-relaxed">
                Xây dựng trên nền tảng Tauri v2 và Rust. Khóa giao diện toàn màn hình, vô hiệu hóa các tổ hợp phím hệ thống (Alt+Tab, Windows Key), ngăn chặn đa nhiệm, phát hiện môi trường máy ảo và các tiến trình điều khiển từ xa.
              </p>
            </div>

            {/* Pillar 02 */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-5">
                <Users className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">T.02 · HOÀN THÀNH</div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">Xác thực khuôn mặt &amp; Chống thi hộ</h3>
              <p className="text-[14.5px] text-slate-600 mt-3 leading-relaxed">
                Xác minh danh tính thí sinh khi nhập phòng; liên tục đối soát sinh trắc trong suốt thời gian làm bài; tự động phát hiện tình trạng vắng mặt hoặc sự xuất hiện của đối tượng thứ hai trước ống kính (mô hình MobileFaceNet tối ưu hóa).
              </p>
            </div>

            {/* Pillar 03 */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-5">
                <Cpu className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">T.03 · HOÀN THÀNH</div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">Nhận diện thiết bị cấm &amp; Bất thường hành vi</h3>
              <p className="text-[14.5px] text-slate-600 mt-3 leading-relaxed">
                Phát hiện điện thoại di động, tai nghe và tài liệu không được phép thông qua mô hình thị giác máy tính YOLOX; phân tích hướng nhìn và cảnh báo khi thí sinh quay đầu hoặc rời mắt khỏi màn hình quá ngưỡng quy định.
              </p>
            </div>

            {/* Pillar 04 */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-5">
                <Monitor className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">T.04 · HOÀN THÀNH</div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">Bảng điều khiển giám thị thời gian thực (≤ 2s)</h3>
              <p className="text-[14.5px] text-slate-600 mt-3 leading-relaxed">
                Truyền tải trạng thái phòng thi và luồng giám sát qua giao thức WebRTC SFU / WebSocket với độ trễ thấp; tự động phân loại mức độ rủi ro, nâng cao năng lực quản lý của một giám thị lên đến 80 thí sinh đồng thời.
              </p>
            </div>

            {/* Pillar 05 */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-5">
                <FileCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">T.05 · HOÀN THÀNH</div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">Trích xuất dữ liệu bằng chứng bảo đảm toàn vẹn</h3>
              <p className="text-[14.5px] text-slate-600 mt-3 leading-relaxed">
                Hệ thống tự động ghi lại đoạn video ngắn ngay tại thời điểm ghi nhận bất thường; dữ liệu được gắn mã băm toàn vẹn (Integrity Hash), phục vụ công tác thanh tra và giải quyết khiếu nại học thuật minh bạch.
              </p>
            </div>

            {/* Pillar 06 */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs hover:border-blue-400 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-5">
                <QrCode className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">T.06 · HOÀN THÀNH</div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">Camera phụ góc rộng liên kết qua mã QR</h3>
              <p className="text-[14.5px] text-slate-600 mt-3 leading-relaxed">
                Thí sinh sử dụng thiết bị di động quét mã QR để thiết lập luồng camera thứ hai quan sát bàn phím, thao tác tay và không gian xung quanh; hoạt động trực tiếp trên nền web di động, không yêu cầu cài đặt ứng dụng bổ sung.
              </p>
            </div>
          </div>

          {/* Lộ trình tiếp theo */}
          <div className="mt-8 p-5 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-700 text-white text-xs font-bold rounded">
                ĐỊNH HƯỚNG MỞ RỘNG (2026 – 2027)
              </span>
              <span className="text-[14px] text-blue-950 font-medium leading-relaxed">
                Giám sát đồng bộ thi phòng máy và thi kết hợp (Hybrid) · Phân tích nhịp gõ phím và nhật ký clipboard phát hiện can thiệp của AI tạo sinh · Tích hợp Moodle LMS theo chuẩn LTI 1.3.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03: ĐÁNH GIÁ TÍNH CẠNH TRANH & HIỆU QUẢ KINH TẾ
      ========================================================================= */}
      <section id="so-sanh" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="flex flex-wrap gap-4 items-end justify-between border-b border-slate-200 pb-8">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
                03 — Đánh giá tính cạnh tranh &amp; Lợi thế công nghệ
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                So sánh các chỉ số kỹ thuật và hiệu quả kinh tế
              </h2>
            </div>
            <p className="max-w-[520px] text-[15px] text-slate-600 leading-relaxed">
              Exam Guard giúp các cơ sở giáo dục tiết kiệm 85–90% kinh phí bản quyền so với giải pháp quốc tế, đồng thời bảo đảm tuân thủ quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full min-w-[740px] text-left border-collapse text-[14px] sm:text-[15px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-[13.5px] font-bold border-b border-slate-200">
                  <th className="p-4 sm:p-5 w-1/4">Chỉ tiêu đánh giá</th>
                  <th className="p-4 sm:p-5 w-1/4">Giải pháp Quốc tế<br /><span className="text-xs text-slate-500 font-normal">(Proctorio, Honorlock, ProctorU)</span></th>
                  <th className="p-4 sm:p-5 w-1/4">Giải pháp Nội địa truyền thống<br /><span className="text-xs text-slate-500 font-normal">(Azota; Safe Exam Browser + Zoom)</span></th>
                  <th className="p-4 sm:p-5 bg-blue-100/70 text-blue-900 w-1/4 border-l-2 border-r-2 border-blue-500">Exam Guard (ĐH Mở TP.HCM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Định mức chi phí trên mỗi lượt thi</td>
                  <td className="p-4 sm:p-5 text-slate-600">78.000 – 130.000 đ (tự động); lên tới 340.000 đ (có người giám sát)</td>
                  <td className="p-4 sm:p-5 text-slate-600">Miễn phí cơ bản hoặc thuê bao cá nhân theo giảng viên</td>
                  <td className="p-4 sm:p-5 bg-blue-50/50 font-bold text-blue-900 border-l-2 border-r-2 border-blue-500">
                    4.500 – 7.500 đ / lượt<br />
                    <span className="text-xs font-semibold text-emerald-700">Tiết kiệm 85–90% so với giải pháp ngoại nhập</span>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Kiến trúc xử lý &amp; Cơ chế giám sát</td>
                  <td className="p-4 sm:p-5 text-slate-600">Xử lý tập trung trên đám mây quốc tế, tiêu tốn băng thông đường truyền lớn</td>
                  <td className="p-4 sm:p-5 text-slate-600">Giới hạn ở mức kiểm tra chuyển tab trình duyệt, xử lý sau ca thi</td>
                  <td className="p-4 sm:p-5 bg-blue-50/50 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    Mô hình AI hai tầng trên thiết bị (Edge AI); cảnh báo thời gian thực với độ trễ ≤ 2 giây
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Lưu trữ dữ liệu &amp; Cơ sở pháp lý</td>
                  <td className="p-4 sm:p-5 text-slate-600">Dữ liệu lưu trữ máy chủ nước ngoài; thủ tục chuyển giao dữ liệu phức tạp</td>
                  <td className="p-4 sm:p-5 text-slate-600">Phụ thuộc hoàn toàn vào hạ tầng đám mây công cộng của bên thứ ba</td>
                  <td className="p-4 sm:p-5 bg-blue-50/50 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    Dữ liệu lưu trữ nội địa tại Việt Nam; tuân thủ Nghị định 13/2023/NĐ-CP; chỉ lưu đoạn trích xuất vi phạm
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Phương thức hỗ trợ kỹ thuật</td>
                  <td className="p-4 sm:p-5 text-slate-600">Ngôn ngữ tiếng Anh; chênh lệch múi giờ; không có nhân sự hỗ trợ ca thi</td>
                  <td className="p-4 sm:p-5 text-slate-600">Tự vận hành nội bộ; cán bộ coi thi phải kiêm nhiệm xử lý sự cố thiết bị</td>
                  <td className="p-4 sm:p-5 bg-blue-50/50 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    Hỗ trợ tiếng Việt; bố trí nhân sự kỹ thuật trực song song xử lý sự cố trong suốt ca thi
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="p-4 sm:p-5 font-bold text-slate-900">Phạm vi hình thức tổ chức thi</td>
                  <td className="p-4 sm:p-5 text-slate-600">Chuyên biệt cho hình thức thi trực tuyến từ xa</td>
                  <td className="p-4 sm:p-5 text-slate-600">Phân tách rời rạc giữa thi trực tuyến và phần mềm phòng máy tính</td>
                  <td className="p-4 sm:p-5 bg-blue-50/50 font-semibold text-slate-900 border-l-2 border-r-2 border-blue-500">
                    Nền tảng hợp nhất dùng chung cho thi trực tuyến, thi tại phòng máy và thi kết hợp (Hybrid)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 04: QUY TRÌNH TỔ CHỨC KHẢO THÍ CHUẨN HÓA
      ========================================================================= */}
      <section id="van-hanh" className="py-16 sm:py-20 bg-slate-50/60 border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="border-b border-slate-200 pb-8">
            <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
              04 — Quy trình tổ chức khảo thí
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
              Quy trình 4 giai đoạn chuẩn hóa trong tổ chức kỳ thi
            </h2>
            <p className="mt-3 max-w-[620px] text-[15.5px] text-slate-600 leading-relaxed">
              Hội đồng Khảo thí và cán bộ coi thi thực hiện toàn bộ nghiệp vụ quản trị trên giao diện Web. Thí sinh sử dụng ứng dụng Exam Guard Client đóng gói sẵn, vận hành độc lập không đòi hỏi quyền quản trị hệ thống (Admin).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            {/* Step 01 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="text-4xl font-black text-blue-600 font-mono">01</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Khởi tạo đề thi &amp; Thiết lập tham số</h3>
              <p className="text-[14px] text-slate-600 mt-2 leading-relaxed">
                Cán bộ khảo thí nhập ngân hàng câu hỏi (trắc nghiệm, tự luận hoặc lập trình), cấu hình xáo trộn đề ngẫu nhiên theo từng mã thí sinh và ấn định các mốc thời gian làm bài.
              </p>
            </div>

            {/* Step 02 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="text-4xl font-black text-blue-600 font-mono">02</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Kiểm tra thiết bị &amp; Đối soát sinh trắc</h3>
              <p className="text-[14px] text-slate-600 mt-2 leading-relaxed">
                Thí sinh khởi chạy ứng dụng Exam Guard Client; hệ thống tự động kiểm tra phần cứng camera, micro, tính toàn vẹn hệ điều hành, đối soát khuôn mặt và liên kết camera phụ.
              </p>
            </div>

            {/* Step 03 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="text-4xl font-black text-blue-600 font-mono">03</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Giám sát trực tuyến &amp; Phân tích rủi ro</h3>
              <p className="text-[14px] text-slate-600 mt-2 leading-relaxed">
                Mô hình Edge AI phân tích hành vi trực tiếp trên máy thí sinh. Giám thị nhận cảnh báo kèm hình ảnh và video trong ≤ 2 giây để chủ động nhắc nhở hoặc lập biên bản sự cố.
              </p>
            </div>

            {/* Step 04 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="text-4xl font-black text-blue-600 font-mono">04</div>
              <h3 className="text-lg font-bold text-slate-900 mt-3">Tổng hợp hồ sơ &amp; Nghiệm thu kết quả</h3>
              <p className="text-[14px] text-slate-600 mt-2 leading-relaxed">
                Hệ thống tự động kết xuất hồ sơ ca thi gồm bảng điểm, nhật ký sự cố chi tiết và các tệp video bằng chứng có mã băm toàn vẹn, sẵn sàng xuất báo cáo chuẩn PDF/Excel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 05: KHUNG ĐỊNH MỨC KINH PHÍ DỊCH VỤ DỰ KIẾN
      ========================================================================= */}
      <section id="gia" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="flex flex-wrap gap-6 items-end justify-between border-b border-slate-200 pb-8">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
                05 — Khung định mức kinh phí dự kiến
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Khung Định Mức Kinh Phí Dịch Vụ Exam Guard
              </h2>
              <p className="mt-3 max-w-[660px] text-[15.5px] text-slate-600 leading-relaxed">
                Định mức tài chính được xây dựng trên cơ sở biến phí vận hành thực tế (~3.000 đ/lượt thi). Quy mô các gói học kỳ đều dưới 100 triệu đồng, phù hợp quy định áp dụng hình thức chỉ định thầu rút gọn theo Nghị định 214/2025/NĐ-CP và Luật Đấu thầu số 22/2023/QH15.
              </p>
            </div>

            {/* Tab Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full lg:w-auto gap-1">
              <button
                type="button"
                onClick={() => setPricingTab('semester')}
                className={`px-3.5 sm:px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap ${
                  pricingTab === 'semester'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gói Học kỳ (Quy mô cơ sở)
              </button>
              <button
                type="button"
                onClick={() => setPricingTab('per_exam')}
                className={`px-3.5 sm:px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap ${
                  pricingTab === 'per_exam'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gói Ca thi độc lập
              </button>
              <button
                type="button"
                onClick={() => setPricingTab('on_premise')}
                className={`px-3.5 sm:px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap ${
                  pricingTab === 'on_premise'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cài đặt tại chỗ (On-Premise)
              </button>
            </div>
          </div>

          {/* TAB 1: GÓI HỌC KỲ (SEMESTER) */}
          {pricingTab === 'semester' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10">
              {/* Pilot */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    GÓI THÍ ĐIỂM (PILOT)
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3">0 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Áp dụng đơn vị triển khai thử nghiệm</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Hạn mức tối đa 200 lượt thi</strong> (01 học phần thực tế)</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Đầy đủ tính năng AI giám sát và ứng dụng Lockdown Kiosk</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Nhân sự kỹ thuật hỗ trợ trực tiếp trong suốt ca thi</span>
                    </div>
                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                      Yêu cầu bàn giao: Biên bản nghiệm thu và phiếu đánh giá chuyên môn
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-lg hover:bg-slate-200 transition-colors text-center block"
                >
                  Đăng ký tham gia thí điểm
                </a>
              </div>

              {/* Semester S */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">
                    HỌC KỲ S · CẤP KHOA
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3">15.000.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một học kỳ chính quy</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>20 lớp học phần</strong> (≤ 100 SV/lớp)</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Hạn mức: Tương đương 2.000 lượt thi/học kỳ (7.500 đ/lượt)</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Toàn quyền khai thác mô hình AI và bảng điều khiển giám thị</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Chi phí phát sinh vượt hạn mức: 7.000 đ/lượt thi</span>
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-lg hover:bg-slate-200 transition-colors text-center block"
                >
                  Lựa chọn Gói Học kỳ S
                </a>
              </div>

              {/* Semester M (Featured / Recommended) */}
              <div className="bg-blue-50/50 border-2 border-blue-600 rounded-xl p-6 shadow-md flex flex-col justify-between relative">
                <div className="absolute -top-3 right-4 bg-blue-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  KHUYÊN DÙNG
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-800 font-mono">
                    HỌC KỲ M · KHOA LỚN / TRƯỜNG VỪA
                  </div>
                  <div className="text-3xl font-black text-blue-900 mt-3">32.500.000 đ</div>
                  <div className="text-xs text-blue-700 font-semibold mt-1">Một học kỳ chính quy</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span><strong>50 lớp học phần</strong> (≤ 100 SV/lớp)</span>
                    </div>
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>Hạn mức: Tương đương 5.000 lượt thi/học kỳ (6.500 đ/lượt)</span>
                    </div>
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>Bố trí nhân sự kỹ thuật trực song song hỗ trợ ca thi</span>
                    </div>
                    <div className="text-slate-800 flex items-start gap-2">
                      <Check className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <span>Chi phí phát sinh vượt hạn mức ưu đãi: 6.500 đ/lượt thi</span>
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-blue-600 text-white text-[14px] font-bold rounded-lg hover:bg-blue-700 transition-colors text-center block shadow-sm"
                >
                  Lựa chọn Gói Học kỳ M
                </a>
              </div>

              {/* Semester L */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    HỌC KỲ L · TOÀN TRƯỜNG
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3">60.000.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một học kỳ chính quy</div>
                  <div className="mt-6 space-y-2.5 text-[14px]">
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>10.000 lượt thi/học kỳ</strong> (đơn giá 6.000 đ/lượt)</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Chi phí phát sinh vượt hạn mức ưu đãi: 5.500 đ/lượt thi</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Chương trình tập huấn nghiệp vụ cán bộ khảo thí &amp; giám thị</span>
                    </div>
                    <div className="text-slate-700 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Cam kết chất lượng dịch vụ (SLA) tiếp nhận sự cố &lt; 5 phút</span>
                    </div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-lg hover:bg-slate-200 transition-colors text-center block"
                >
                  Lựa chọn Gói Học kỳ L
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: GÓI CA LẺ */}
          {pricingTab === 'per_exam' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    CA THI · QUY MÔ NHỎ
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3">300.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một ca thi độc lập (≤ 50 thí sinh)</div>
                  <div className="mt-6 space-y-2.5 text-[14px] text-slate-700">
                    <div>✓ Đơn giá quy đổi: 6.000 đ/lượt thí sinh</div>
                    <div>✓ Hỗ trợ kỹ thuật giám sát trực tuyến trong ca thi</div>
                    <div>✓ Lưu trữ hồ sơ bằng chứng số trong 12 tháng</div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-lg hover:bg-slate-200 transition-colors text-center block"
                >
                  Đăng ký ca thi 50 SV
                </a>
              </div>

              <div className="bg-blue-50/40 border-2 border-blue-600 rounded-xl p-7 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">
                    CA THI · TIÊU CHUẨN
                  </div>
                  <div className="text-3xl font-black text-blue-900 mt-3">500.000 đ</div>
                  <div className="text-xs text-blue-700 font-semibold mt-1">Một ca thi độc lập (≤ 100 thí sinh)</div>
                  <div className="mt-6 space-y-2.5 text-[14px] text-slate-800">
                    <div>✓ Đơn giá quy đổi: 5.000 đ/lượt thí sinh</div>
                    <div>✓ Tích hợp đầy đủ mô hình AI đối soát khuôn mặt và vật cấm</div>
                    <div>✓ Nhân sự kỹ thuật trực tuyến phối hợp giám sát</div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-blue-600 text-white text-[14px] font-bold rounded-lg hover:bg-blue-700 transition-colors text-center block"
                >
                  Đăng ký ca thi 100 SV
                </a>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    CA THI · QUY MÔ LỚN
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-3">1.350.000 đ</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Một ca thi độc lập (≤ 300 thí sinh)</div>
                  <div className="mt-6 space-y-2.5 text-[14px] text-slate-700">
                    <div>✓ Đơn giá ưu đãi: 4.500 đ/lượt thí sinh</div>
                    <div>✓ Cơ chế phân luồng đa phòng thi song song</div>
                    <div>✓ Kết xuất hồ sơ tổng hợp &amp; trích xuất video bằng chứng</div>
                  </div>
                </div>
                <a
                  href="#lien-he"
                  className="mt-8 px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-lg hover:bg-slate-200 transition-colors text-center block"
                >
                  Đăng ký ca thi 300 SV
                </a>
              </div>
            </div>
          )}

          {/* TAB 3: ON-PREMISE */}
          {pricingTab === 'on_premise' && (
            <div className="mt-10 p-8 sm:p-12 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="max-w-[840px]">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">
                  MÔ HÌNH TRIỂN KHAI TRÊN HẠ TẦNG MÁY CHỦ NỘI BỘ (ON-PREMISE)
                </div>
                <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Exam Guard On-Premise Private Deployment
                </h3>
                <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
                  Chuyển giao và cài đặt trực tiếp trên hệ thống máy chủ nội bộ của nhà trường hoặc cơ quan khảo thí. Toàn bộ luồng truyền phát video, hình ảnh và cơ sở dữ liệu sinh trắc học được lưu trữ và quản lý khép kín trong mạng nội bộ, đáp ứng tiêu chuẩn an toàn thông tin cấp độ cao.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 my-7">
                  <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <div className="text-xs text-slate-500 font-mono uppercase">PHÍ TRIỂN KHAI &amp; THIẾT LẬP BAN ĐẦU</div>
                    <div className="text-2xl font-black text-blue-700 mt-2">30.000.000 đ</div>
                    <p className="text-xs text-slate-500 mt-1">Chi phí thu một lần: Khảo sát, cài đặt hệ thống, kiểm thử tải và chuyển giao kỹ thuật.</p>
                  </div>
                  <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <div className="text-xs text-slate-500 font-mono uppercase">PHÍ DUY TRÌ &amp; BẢO TRÌ HÀNG NĂM</div>
                    <div className="text-2xl font-black text-slate-900 mt-2">70.000.000 đ / năm</div>
                    <p className="text-xs text-slate-500 mt-1">Cập nhật thuật toán Edge AI, rà soát lỗ hổng an ninh và hỗ trợ kỹ thuật chuyên trách.</p>
                  </div>
                </div>

                <a
                  href="#lien-he"
                  className="inline-flex px-7 py-3 bg-blue-600 text-white text-[14.5px] font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Yêu cầu khảo sát kỹ thuật On-premise →
                </a>
              </div>
            </div>
          )}

          {/* Add-ons & Policy Banner */}
          <div className="mt-8 p-6 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-900">
                TIỆN ÍCH MỞ RỘNG &amp; CHÍNH SÁCH ĐỐI TÁC BAN ĐẦU
              </div>
              <p className="text-[14px] text-slate-700">
                <strong>Dịch vụ bổ sung:</strong> 3.000.000 đ/gói/năm (Gia hạn thời gian lưu trữ video bằng chứng 24 tháng hoặc mô-đun tích hợp Moodle LMS chuẩn LTI 1.3).
              </p>
              <p className="text-[14px] text-emerald-800 font-semibold">
                ★ <strong>Chính sách đối tác sáng lập:</strong> Giảm 30% tổng chi phí năm đầu tiên cho 03 đơn vị tiên phong ký kết thỏa thuận hợp tác thương mại.
              </p>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Căn cứ pháp lý: Nghị định số 214/2025/NĐ-CP · Luật Đấu thầu số 22/2023/QH15
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: ỨNG DỤNG KHẢO THÍ DÀNH CHO THÍ SINH (#tai-app)
      ========================================================================= */}
      <section id="tai-app" className="py-16 sm:py-20 bg-slate-50/60 border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-10 items-center">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
                Ứng dụng khảo thí dành cho thí sinh
              </div>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
                Exam Guard Client
              </h2>
              <p className="mt-3 text-[15.5px] text-slate-600 leading-relaxed">
                Ứng dụng chuyên dụng khóa môi trường thi (Lockdown Kiosk Mode). Cơ chế vận hành độc lập, tự động đồng bộ khi xảy ra gián đoạn kết nối mạng và không đòi hỏi quyền quản trị hệ thống (Admin).
              </p>
              <div className="mt-6 space-y-1.5 text-xs text-slate-600 font-mono">
                <div>• KIẾN TRÚC: Nền tảng Tauri v2 kết hợp Rust (Tối ưu hóa tài nguyên phần cứng)</div>
                <div>• CẤU HÌNH PHẦN CỨNG: Tương thích máy tính phổ thông (RAM ≥ 4GB, Webcam tích hợp)</div>
                <div>• HỆ ĐIỀU HÀNH HỖ TRỢ: Microsoft Windows 10 / 11 (phiên bản 64-bit)</div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Windows Exe */}
              <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Gói cài đặt độc lập (.exe)</h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded whitespace-nowrap">
                      BẢN THÍ SINH
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Dành cho thí sinh tham dự kỳ thi cá nhân · Tự động vô hiệu hóa phím tắt hệ thống và ngăn chặn đa nhiệm
                  </p>
                </div>
                <a
                  href="#lien-he"
                  className="px-5 py-2.5 bg-blue-600 text-white text-[14px] font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
                >
                  <Download className="w-4 h-4 shrink-0" /> Tải bản .exe
                </a>
              </div>

              {/* Room MSI */}
              <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Gói triển khai phòng máy tập trung (.msi)</h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded whitespace-nowrap">
                      CHO PHÒNG MÁY
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Hỗ trợ cài đặt đồng loạt qua chính sách nhóm Active Directory (GPO) hoặc mạng nội bộ (LAN)
                  </p>
                </div>
                <a
                  href="#lien-he"
                  className="px-5 py-2.5 bg-slate-100 border border-slate-300 text-slate-800 text-[14px] font-semibold rounded-lg hover:bg-slate-200 transition-colors text-center shrink-0 whitespace-nowrap"
                >
                  Yêu cầu gói phân phối .msi
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 06: ĐỘI NGŨ THỰC HIỆN ĐỀ ÁN (#doi-ngu)
      ========================================================================= */}
      <section id="doi-ngu" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="flex flex-wrap gap-4 items-end justify-between border-b border-slate-200 pb-8">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
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

          {/* Members Grid (5 Members) */}
          <div className="mt-10">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono mb-4">
              DANH SÁCH THÀNH VIÊN NHÓM THỰC HIỆN (KHOA CÔNG NGHỆ THÔNG TIN)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Khôi */}
              <div className="p-5 bg-white border-2 border-blue-500 rounded-xl shadow-xs relative">
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase">
                  Trưởng nhóm
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Lê Minh Khôi</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2351050084</div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Điều phối tổng thể đề án, phụ trách quy trình vận hành kỳ thi và phối hợp phát triển mô hình AI.
                </p>
                <div className="text-xs font-bold text-blue-800 mt-3 pt-2 border-t border-slate-100">
                  0387 291 237
                </div>
              </div>

              {/* Triều */}
              <div className="p-5 bg-slate-50/60 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Kỹ thuật &amp; Hạ tầng
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Nguyễn Thanh Triều</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2251052127</div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Phát triển ứng dụng Client, máy chủ backend, kiểm thử tải và tích hợp Edge AI.
                </p>
                <div className="text-xs text-slate-600 mt-3 pt-2 border-t border-slate-200">
                  0772 816 986
                </div>
              </div>

              {/* Kiều */}
              <div className="p-5 bg-slate-50/60 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Tài chính &amp; Quản trị rủi ro
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Phạm Thị Diễm Kiều</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2551050116</div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Xây dựng mô hình tài chính, định mức kinh phí và hồ sơ đánh giá tác động dữ liệu (DPIA).
                </p>
                <div className="text-xs text-slate-600 mt-3 pt-2 border-t border-slate-200">
                  0387 631 476
                </div>
              </div>

              {/* Trân */}
              <div className="p-5 bg-slate-50/60 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Pháp chế &amp; Bảo mật
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Cao Đỗ Huyền Trân</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2454050030</div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Xây dựng khung tuân thủ Nghị định 13/2023/NĐ-CP và thỏa thuận xử lý dữ liệu (DPA).
                </p>
                <div className="text-xs text-slate-600 mt-3 pt-2 border-t border-slate-200">
                  2454050030tran@ou.edu.vn
                </div>
              </div>

              {/* Trang */}
              <div className="p-5 bg-slate-50/60 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded uppercase">
                  Thị trường &amp; Đối tác
                </span>
                <div className="font-bold text-[16px] text-slate-900 mt-2">Lê Phan Huyền Trang</div>
                <div className="text-xs font-mono text-slate-500">MSSV: 2454052084</div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Phụ trách liên kết hợp tác B2B, khảo sát nhu cầu thí điểm tại các cơ sở đào tạo.
                </p>
                <div className="text-xs text-slate-600 mt-3 pt-2 border-t border-slate-200">
                  0868 772 951
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ SECTION: HỎI ĐÁP CHUYÊN MÔN
      ========================================================================= */}
      <section className="py-16 sm:py-20 bg-slate-50/50 border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-10">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-blue-700">
                Hỏi đáp chuyên môn
              </div>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900 leading-tight">
                Giải đáp các nội dung trọng tâm từ Hội đồng Khảo thí
              </h2>
              <p className="mt-3 text-[15px] text-slate-600 leading-relaxed">
                Thông tin chi tiết về cơ sở kỹ thuật, an toàn dữ liệu và phương thức triển khai thực nghiệm.
              </p>
            </div>

            <div className="space-y-3">
              <details className="group p-5 bg-white border border-slate-200 rounded-xl cursor-pointer">
                <summary className="text-[16px] font-bold text-slate-900 flex items-center justify-between list-none">
                  <span>Nhà trường có cần đầu tư máy chủ chuyên dụng GPU để vận hành hệ thống không?</span>
                  <span className="font-bold text-blue-600 transition-transform group-open:rotate-90">→</span>
                </summary>
                <p className="mt-3 text-[14.5px] text-slate-600 leading-relaxed">
                  Không. Giải pháp kỹ thuật của Exam Guard là phân bổ các mô hình nhận diện thị giác máy tính (YOLOX, MobileFaceNet) xử lý trực tiếp tại thiết bị của thí sinh (Edge AI). Máy chủ của nhà trường hoặc đám mây chỉ làm nhiệm vụ điều phối tín hiệu WebRTC và tiếp nhận dữ liệu nhật ký, do đó hoàn toàn không đòi hỏi hạ tầng máy chủ GPU đắt đỏ.
                </p>
              </details>

              <details className="group p-5 bg-white border border-slate-200 rounded-xl cursor-pointer">
                <summary className="text-[16px] font-bold text-slate-900 flex items-center justify-between list-none">
                  <span>Phương án xử lý kỹ thuật khi thí sinh gặp sự cố gián đoạn kết nối Internet trong lúc làm bài?</span>
                  <span className="font-bold text-blue-600 transition-transform group-open:rotate-90">→</span>
                </summary>
                <p className="mt-3 text-[14.5px] text-slate-600 leading-relaxed">
                  Ứng dụng Exam Guard Client tích hợp cơ chế bộ đệm ngoại tuyến (Offline Cache) có gắn mã kiểm tra toàn vẹn (Checksum). Khi xảy ra mất kết nối mạng đột ngột trong khoảng 3–5 phút, phiên thi vẫn được duy trì an toàn; thí sinh tiếp tục làm bài và hệ thống tự động đồng bộ đầy đủ bài thi ngay khi kết nối được khôi phục.
                </p>
              </details>

              <details className="group p-5 bg-white border border-slate-200 rounded-xl cursor-pointer">
                <summary className="text-[16px] font-bold text-slate-900 flex items-center justify-between list-none">
                  <span>Hệ thống bảo đảm an toàn dữ liệu sinh trắc học và tuân thủ pháp lý như thế nào?</span>
                  <span className="font-bold text-blue-600 transition-transform group-open:rotate-90">→</span>
                </summary>
                <p className="mt-3 text-[14.5px] text-slate-600 leading-relaxed">
                  Đề án thiết kế tuân thủ nguyên tắc "Tối thiểu hóa dữ liệu" (Data Minimization) theo quy định của Nghị định số 13/2023/NĐ-CP: Hệ thống chỉ lưu lại các đoạn video ngắn (15–30 giây) khi phát hiện sự cố bất thường, không lưu trữ tràn lan luồng video toàn phiên. Dữ liệu được mã hóa chuẩn AES-256, lưu trữ hoàn toàn trên hệ thống máy chủ đặt tại Việt Nam và tự động hủy sau 12 tháng.
                </p>
              </details>

              <details className="group p-5 bg-white border border-slate-200 rounded-xl cursor-pointer">
                <summary className="text-[16px] font-bold text-slate-900 flex items-center justify-between list-none">
                  <span>Mô hình trí tuệ nhân tạo (AI) có quyền tự động đình chỉ hay hủy bài thi của thí sinh không?</span>
                  <span className="font-bold text-blue-600 transition-transform group-open:rotate-90">→</span>
                </summary>
                <p className="mt-3 text-[14.5px] text-slate-600 leading-relaxed">
                  Không. Trí tuệ nhân tạo chỉ đóng vai trò hỗ trợ phân loại mức độ rủi ro và gửi cảnh báo kèm đoạn video bằng chứng đến bảng điều khiển của giám thị. Toàn bộ thẩm quyền quyết định nhắc nhở, lập biên bản vi phạm hoặc đình chỉ thi thuộc về cán bộ coi thi và Hội đồng Khảo thí của nhà trường.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: ĐĂNG KÝ THÍ ĐIỂM / LIÊN HỆ HỢP TÁC (#lien-he)
      ========================================================================= */}
      <section id="lien-he" className="py-16 sm:py-20 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div>
              <div className="inline-block px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-full text-xs font-bold uppercase tracking-wider text-blue-100">
                HỢP TÁC &amp; TRIỂN KHAI THÍ ĐIỂM
              </div>
              <h2 className="mt-4 text-3xl sm:text-5xl font-black leading-tight text-white">
                Đăng ký tham gia chương trình thí điểm khảo thí
              </h2>
              <p className="mt-4 text-[16px] text-blue-100 leading-relaxed max-w-[520px]">
                Ban điều hành dự án Exam Guard hỗ trợ các đơn vị giáo dục tổ chức thi thử nghiệm (quy mô tối đa 200 lượt thi) vận hành song song với phương thức hiện hành, nhằm thẩm định khách quan độ chính xác của mô hình và tính tối ưu hóa nhân lực coi thi.
              </p>

              <div className="mt-8 space-y-3 text-[14px]">
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

            {/* Right Column: Clean White Card Form */}
            <div className="bg-white text-slate-900 rounded-2xl p-8 sm:p-10 shadow-2xl">
              {isSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Đã tiếp nhận yêu cầu từ Quý đơn vị</h3>
                  <p className="text-[14.5px] text-slate-600 leading-relaxed">
                    Ban phụ trách dự án Exam Guard sẽ liên hệ qua thư điện tử <strong>{formEmail}</strong> hoặc điện thoại trong vòng 24 giờ làm việc để cung cấp tài liệu kỹ thuật và thống nhất kế hoạch triển khai.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900">Phiếu Đăng Ký Thí Điểm Khảo Thí</h3>
                  <p className="text-xs text-slate-500">Dành cho Ban Giám hiệu, Phòng Khảo thí, Phòng Đào tạo và Ban Chủ nhiệm các Khoa.</p>

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
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Thư điện tử công vụ *
                      </label>
                      <input
                        type="email"
                        placeholder="canbo@ou.edu.vn"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
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
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
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
                        placeholder="Trường / Khoa"
                        value={formOrg}
                        onChange={(e) => setFormOrg(e.target.value)}
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Quy mô dự kiến
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: 01 học phần (200 sinh viên)"
                        value={formScale}
                        onChange={(e) => setFormScale(e.target.value)}
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 text-white text-[15px] font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 cursor-pointer mt-2"
                  >
                    Gửi Phiếu Đăng Ký Thí Điểm
                  </button>

                  <p className="text-[11.5px] text-slate-500 text-center">
                    Dữ liệu cung cấp chỉ phục vụ công tác trao đổi học thuật và nghiên cứu triển khai giải pháp.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER (BẢN QUYỀN HỌC THUẬT & PHÁP LÝ ĐỀ ÁN)
      ========================================================================= */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Col 1 */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center p-1.5 shadow-2xs">
                  <img src="/mark.png" alt="Exam Guard Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-[17px] font-bold text-white tracking-tight">EXAM GUARD</span>
              </div>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-[320px]">
                Hệ thống giám sát thi cử trực tuyến thông minh. Đề án phát triển từ đồ án chuyên ngành Công nghệ thông tin, Trường Đại học Mở TP. Hồ Chí Minh.
              </p>
            </div>

            {/* Col 2 */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Mục lục đề án
              </div>
              <div><a href="#tong-quan" className="hover:text-white transition-colors">Tổng quan &amp; Giá trị dự án</a></div>
              <div><a href="#demo" className="hover:text-white transition-colors">Video thực nghiệm hệ thống</a></div>
              <div><a href="#nang-luc" className="hover:text-white transition-colors">Kiến trúc kỹ thuật &amp; Edge AI</a></div>
              <div><a href="#so-sanh" className="hover:text-white transition-colors">Đánh giá tính cạnh tranh</a></div>
              <div><a href="#gia" className="hover:text-white transition-colors">Khung định mức kinh phí</a></div>
              <div><a href="#doi-ngu" className="hover:text-white transition-colors">Đội ngũ thực hiện đề án</a></div>
            </div>

            {/* Col 3 */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Thông tin liên hệ
              </div>
              <div>Thư điện tử: <a href="mailto:minkhoi.dev@gmail.com" className="hover:text-white">minkhoi.dev@gmail.com</a></div>
              <div>Điện thoại điều phối: 0387 291 237 (Trưởng nhóm)</div>
              <div>
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-bold inline-block pt-1">
                  Truy cập Cổng Khảo thí →
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-mono">
            <span>© 2026 EXAM GUARD · TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH · STEM 2026</span>
            <span>PHÁT TRIỂN TẠI VIỆT NAM · BẢO MẬT DỮ LIỆU NỘI ĐỊA</span>
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
