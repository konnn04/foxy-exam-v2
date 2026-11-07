import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import {
  ShieldCheck,
  Lock,
  Cpu,
  QrCode,
  FileCheck,
  Play,
  ChevronRight,
  CheckCircle2,
  Users,
  Smartphone,
  Bell,
  ArrowRight,
  Zap,
  Shield,
  Layers,
  Radio,
  Eye,
  Check,
  AlertTriangle,
} from 'lucide-react';

export default function Landing() {
  const [activeShield, setActiveShield] = useState<number>(0);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const shields = [
    {
      id: 0,
      title: 'Tầng 1 · Khóa Kiosk Hệ Điều Hành',
      subtitle: 'Bảo vệ máy tính thí sinh tuyệt đối',
      desc: 'Ứng dụng chạy trên Tauri v2 & Rust tự động vô hiệu hóa phím tắt hệ thống (Alt+Tab, Win Key), chặn đa màn hình, phát hiện máy ảo (VMware) và chặn hoàn toàn phần mềm điều khiển từ xa (UltraViewer, AnyDesk).',
      icon: Lock,
      badge: 'KIOSK ENGINE',
      specs: ['Chặn Alt+Tab, TaskManager', 'Chặn phần mềm điều khiển từ xa', 'Tự động lưu bài khi rớt mạng'],
    },
    {
      id: 1,
      title: 'Tầng 2 · Trí Tuệ Nhân Tạo Biên (Edge AI)',
      subtitle: 'Đối soát khuôn mặt & vật cấm thời gian thực',
      desc: 'Mô hình MobileFaceNet & YOLOX xử lý trực tiếp trên máy thí sinh với tốc độ 5–10 FPS mà không tốn GPU máy chủ. Phát hiện chính xác điện thoại, tài liệu, tai nghe và tự động làm mờ đề thi khi thí sinh quay mặt đi.',
      icon: Cpu,
      badge: 'EDGE AI 10 FPS',
      specs: ['Đối soát sinh trắc liên tục', 'Phát hiện điện thoại & tài liệu', 'Tự động làm mờ khi quay mặt'],
    },
    {
      id: 2,
      title: 'Tầng 3 · Camera Phụ 360° Ghép Đôi QR',
      subtitle: 'Bao quát toàn cảnh bàn thi & thao tác tay',
      desc: 'Thí sinh quét mã QR bằng điện thoại để kích hoạt luồng camera thứ hai. AI kiểm tra góc đặt hợp lệ trước khi cho phép mở đề thi. Hệ thống cảnh báo tức thì nếu điện thoại phụ bị xê dịch hoặc tắt màn hình.',
      icon: QrCode,
      badge: 'DUAL CAM WEBRTC',
      specs: ['Quét QR không cần cài app', 'Bao quát bàn phím & màn hình', 'Cảnh báo khi lệch góc máy'],
    },
    {
      id: 3,
      title: 'Tầng 4 · Bằng Chứng Số Toàn Vẹn SHA-256',
      subtitle: 'Căn cứ pháp lý giải quyết khiếu nại minh bạch',
      desc: 'Tự động cắt video 15–30 giây đồng thời từ cả 3 góc (Cam chính, Cam phụ, Màn hình) ngay tại thời điểm xảy ra sự cố. Gắn chữ ký số mã băm toàn vẹn chống chỉnh sửa và cung cấp link sharing cho Hội đồng thẩm định.',
      icon: FileCheck,
      badge: 'SHA-256 INTEGRITY',
      specs: ['Đồng bộ 3 góc (Cam/Màn/Phụ)', 'Mã băm SHA-256 bảo đảm toàn vẹn', 'Link chia sẻ phúc khảo bảo mật'],
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;
    setIsSubmitted(true);
  };

  return (
    <PublicLayout>
      <Head>
        <title>Exam Guard · Hệ thống Giám sát Thi cử Trực tuyến &amp; Phòng máy Thông minh</title>
        <meta
          name="description"
          content="Exam Guard: Nền tảng giám sát thi cử trực tuyến & phòng máy thế hệ mới. Khóa môi trường Kiosk, Edge AI nhận diện vi phạm ≤ 2 giây, dữ liệu lưu trữ nội địa theo Nghị định 13/2023/NĐ-CP."
        />
      </Head>

      {/* Floating Live System Indicators (Desktop Only) */}
      <div className="hidden xl:flex flex-col gap-2.5 fixed left-6 top-32 z-30 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md rounded-xl p-3 text-[11.5px] font-mono text-slate-700 pointer-events-auto max-w-[210px] space-y-1.5 animate-in fade-in-50 duration-500">
          <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>TRẠNG THÁI HỆ THỐNG</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Kiosk Engine:</span>
            <span className="text-emerald-600 font-bold">KHÓA</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Edge AI:</span>
            <span className="text-blue-600 font-bold">10 FPS</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>WebRTC SFU:</span>
            <span className="text-emerald-600 font-bold">≤ 1.4s</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Pháp chế:</span>
            <span className="text-slate-800 font-bold">NĐ 13/2023</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          HERO SECTION: SÚC TÍCH, TRỌNG TÂM, ENTERPRISE FEEL
      ========================================================================= */}
      <section className="pt-10 sm:pt-16 pb-16 sm:pb-20 bg-gradient-to-b from-blue-50/60 via-white to-slate-50/50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[12px] font-bold mb-5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>NỀN TẢNG KHẢO THÍ THẾ HỆ MỚI · KHOA CNTT · ĐH MỞ TP.HCM</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-slate-900 leading-[1.18] max-w-[960px] mx-auto">
            Giám Sát Thi Cử Trực Tuyến &amp; Phòng Máy Thông Minh
            <span className="block text-blue-600 mt-2 font-extrabold">Bảo đảm toàn vẹn với Edge AI hai tầng</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 sm:mt-5 text-[15.5px] sm:text-[17px] text-slate-600 max-w-[780px] mx-auto leading-relaxed">
            Exam Guard kết hợp ứng dụng khóa môi trường thi (<strong>Kiosk Lockdown</strong>) và trí tuệ nhân tạo (<strong>Edge AI</strong>). Tự động phát hiện bất thường trong <strong>≤ 2 giây</strong>, tiết kiệm <strong>85–90%</strong> chi phí khảo thí so với giải pháp quốc tế.
          </p>

          {/* Call To Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md sm:max-w-none mx-auto">
            <a
              href="#tu-van"
              className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 text-white text-[14.5px] font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 group"
            >
              <span>Đăng ký thí điểm miễn phí</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <Link
              href="/download"
              className="w-full sm:w-auto px-6 py-3.5 bg-white border border-slate-300 text-slate-800 text-[14.5px] font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 fill-blue-600" viewBox="0 0 88 88">
                <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L0 75.48v-29.35zm4.326-39.043L87.314 0v41.527l-47.318.376zm47.329 44.912l-.011 41.535-47.318-6.678-.041-35.195z"/>
              </svg>
              <span>Tải ứng dụng Windows</span>
            </Link>
          </div>

          {/* Key Metrics */}
          <div className="mt-12 pt-7 border-t border-slate-200/90 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-[980px] mx-auto">
            <div className="p-2">
              <div className="text-3xl sm:text-4xl font-black text-blue-600 font-mono">≤ 2 giây</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">Độ trễ cảnh báo vi phạm AI</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">1 : 80</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">Tỷ lệ giám thị / thí sinh</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">4.500 đ</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">Chi phí tối ưu / lượt thi</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">100%</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">Lưu trữ nội địa · NĐ 13/2023</div>
            </div>
          </div>

          {/* =========================================================================
              LIVE DASHBOARD MOCKUP
          ========================================================================= */}
          <div className="mt-12 max-w-[1060px] mx-auto bg-slate-950 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 text-left overflow-hidden">
            {/* Window Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="text-slate-400 font-mono text-[11px] ml-2 hidden sm:inline">
                  examguard.edu.vn/live/session-it2026
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE · 78/80 THÍ SINH
              </span>
            </div>

            {/* Content Tiles */}
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tile 1: Normal */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">Lê Minh Khoa</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                    99.4% KHỚP MẶT
                  </span>
                </div>
                <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center relative">
                  <Users className="w-8 h-8 text-slate-700" />
                  <span className="absolute bottom-1.5 right-1.5 text-[9.5px] font-mono text-emerald-400 bg-black/70 px-1 rounded">
                    CAM PHỤ: OK
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex justify-between">
                  <span>Kiosk: Đã khóa Alt+Tab</span>
                  <span className="text-emerald-400">Bình thường</span>
                </div>
              </div>

              {/* Tile 2: Phone Violation */}
              <div className="rounded-xl border-2 border-red-500 bg-red-950/20 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Trần Thị Mai
                  </span>
                  <span className="text-[10px] text-red-400 font-bold bg-red-950/80 border border-red-800 px-1.5 py-0.5 rounded">
                    VẬT CẤM
                  </span>
                </div>
                <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center relative border border-red-500/40">
                  <Users className="w-8 h-8 text-slate-700" />
                  <div className="absolute bottom-2 left-2 border-2 border-red-500 bg-red-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-red-400" /> cell phone 91%
                  </div>
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-mono text-white bg-red-600 px-1 rounded font-bold">
                    CLIP 15S SẴN SÀNG
                  </span>
                </div>
                <div className="mt-2 text-[11px] flex justify-between items-center text-red-300 font-medium">
                  <span>Phát hiện điện thoại</span>
                  <span className="text-blue-400 font-bold underline cursor-pointer">Xem 3 góc</span>
                </div>
              </div>

              {/* Incident Feed */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col justify-between text-xs font-mono">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-slate-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-blue-400" /> NHẬT KÝ TỰ ĐỘNG
                    </span>
                    <span className="text-[10px] text-slate-500">REALTIME</span>
                  </div>
                  <div className="space-y-2 text-[10.5px]">
                    <div className="p-2 bg-red-950/40 border border-red-900/50 rounded text-slate-200">
                      <span className="text-red-400 font-bold">14:22 · CẢNH BÁO:</span> Phát hiện điện thoại tại bàn SV Mai (91%).
                    </div>
                    <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded text-slate-300">
                      <span className="text-slate-400 font-bold">14:20 · THÀNH CÔNG:</span> 78 thí sinh hoàn tất pre-check đa camera.
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between text-[10px] text-slate-500">
                  <span>WebRTC SFU: 1.4s</span>
                  <span className="text-emerald-400 font-bold">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: SƠ ĐỒ 4 TẦNG KHIÊN BẢO VỆ (DEFENSE SHIELD ARCHITECTURE)
          (Trực quan, căn hàng khoa học, giải quyết triệt để vấn đề flex tự do xấu)
      ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-[12.5px] font-bold uppercase tracking-wider text-blue-600">
              Kiến Trúc Công Nghệ
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900">
              Sơ Đồ 4 Tầng Khiên Bảo Vệ Toàn Diện
            </h2>
            <p className="mt-2 text-[15px] text-slate-600">
              Cơ chế phòng thủ đa tầng loại bỏ hoàn toàn các kẽ hở gian lận trong khảo thí trực tuyến và phòng máy.
            </p>
          </div>

          {/* Interactive Shield Navigation */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {shields.map((s) => {
              const IconComp = s.icon;
              const isSelected = activeShield === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveShield(s.id)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-600 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {s.badge}
                    </span>
                    <IconComp className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <div className={`font-bold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                    {s.title.split('·')[1]?.trim() || s.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Active Shield View */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-bold font-mono uppercase mb-3">
                {shields[activeShield].badge}
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                {shields[activeShield].title}
              </h3>
              <p className="text-sm font-semibold text-blue-700 mt-1">
                {shields[activeShield].subtitle}
              </p>
              <p className="mt-3.5 text-[15px] text-slate-600 leading-relaxed">
                {shields[activeShield].desc}
              </p>
              <div className="mt-5 space-y-2">
                {shields[activeShield].specs.map((spec, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-slate-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{spec}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-3">
                MINH HỌA CƠ CHẾ HOẠT ĐỘNG
              </div>
              <div className="space-y-2.5 text-xs font-mono">
                {activeShield === 0 && (
                  <>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Low-Level Keyboard Hook:</span>
                      <span className="text-emerald-600 font-bold">CHẶN ALT+TAB</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Kiểm tra phần mềm từ xa:</span>
                      <span className="text-emerald-600 font-bold">0 TIẾN TRÌNH LẠ</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Môi trường máy ảo:</span>
                      <span className="text-emerald-600 font-bold">KHÔNG PHÁT HIỆN</span>
                    </div>
                  </>
                )}
                {activeShield === 1 && (
                  <>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>ArcFace Embedding:</span>
                      <span className="text-emerald-600 font-bold">COSINE 0.94 (CHÍNH CHỦ)</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>YOLOX Detector:</span>
                      <span className="text-blue-600 font-bold">10 FPS ON-DEVICE</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Độ trễ cảnh báo:</span>
                      <span className="text-emerald-600 font-bold">1.2 GIÂY</span>
                    </div>
                  </>
                )}
                {activeShield === 2 && (
                  <>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Ghép đôi mã QR:</span>
                      <span className="text-emerald-600 font-bold">WEBRTC SFU KẾT NỐI</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Góc máy thí sinh:</span>
                      <span className="text-emerald-600 font-bold">ĐẠT CHUẨN PRE-CHECK</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Bảo vệ tắt màn hình:</span>
                      <span className="text-emerald-600 font-bold">WAKELOCK ACTIVE</span>
                    </div>
                  </>
                )}
                {activeShield === 3 && (
                  <>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Đồng bộ 3 góc:</span>
                      <span className="text-emerald-600 font-bold">CAM + MÀN + PHỤ</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Chữ ký số toàn vẹn:</span>
                      <span className="text-blue-600 font-bold">SHA-256 HASH VERIFIED</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                      <span>Phúc khảo online:</span>
                      <span className="text-emerald-600 font-bold">LINK SHARING SẴN SÀNG</span>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <Link
                  href="/features"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  <span>Xem chi tiết tất cả tính năng công nghệ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: VIDEO THỰC NGHIỆM VẬN HÀNH
      ========================================================================= */}
      <section className="py-16 sm:py-20 bg-slate-50/70 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            SẢN PHẨM MẪU ĐÃ THỰC NGHIỆM THỰC TẾ
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Video Thực Nghiệm Vận Hành Hệ Thống
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-[680px] mx-auto">
            Xem thực tế quy trình ứng dụng khóa Kiosk trên máy thí sinh, AI phát hiện vật cấm và gửi cảnh báo về bảng điều khiển giám thị.
          </p>

          <div className="mt-7 max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-xl border border-slate-300 bg-black aspect-video">
            <iframe
              src="https://drive.google.com/file/d/1U-k20_mAvNmi8x24-qqgtex1-4MBj2zJ/preview"
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              title="Exam Guard System Demo Video"
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: LIÊN HỆ & ĐĂNG KÝ THÍ ĐIỂM (#tu-van)
      ========================================================================= */}
      <section id="tu-van" className="py-16 sm:py-24 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 text-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-full text-xs font-bold uppercase tracking-wider text-blue-100 mb-3">
                CHƯƠNG TRÌNH THÍ ĐIỂM
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Đăng Ký Tham Gia Thí Điểm Khảo Thí Miễn Phí
              </h2>
              <p className="mt-4 text-[15.5px] text-blue-100 leading-relaxed">
                Hỗ trợ các trường đại học, trường cao đẳng và trung tâm đào tạo tổ chức thi thử nghiệm (tối đa 200 lượt thi) vận hành song song với phương thức hiện hành.
              </p>

              <div className="mt-6 space-y-3 text-sm text-blue-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Miễn phí 100% kinh phí bản quyền và hạ tầng cho 01 học phần</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Cán bộ kỹ thuật trực song song hỗ trợ trong suốt ca thi</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Bàn giao báo cáo đánh giá toàn diện sau kỳ thi</span>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl">
              {isSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Đã tiếp nhận thông tin</h3>
                  <p className="text-sm text-slate-600">
                    Ban dự án Exam Guard sẽ liên hệ qua email <strong>{formEmail}</strong> trong 24 giờ làm việc.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <h3 className="text-xl font-bold text-slate-900">Phiếu Đăng Ký Thí Điểm</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Họ tên cán bộ đại diện / Giảng viên *
                    </label>
                    <input
                      type="text"
                      placeholder="ThS. Nguyễn Văn A"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Email công vụ *
                      </label>
                      <input
                        type="email"
                        placeholder="canbo@ou.edu.vn"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        required
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Số điện thoại *
                      </label>
                      <input
                        type="tel"
                        placeholder="09xx xxx xxx"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        required
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Trường / Đơn vị đào tạo
                    </label>
                    <input
                      type="text"
                      placeholder="Trường Đại học / Cao đẳng / Khoa"
                      value={formOrg}
                      onChange={(e) => setFormOrg(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-600"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer mt-2"
                  >
                    Gửi phiếu đăng ký
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
