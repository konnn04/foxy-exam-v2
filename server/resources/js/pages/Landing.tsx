import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
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
  Image as ImageIcon,
} from 'lucide-react';

export default function Landing() {
  const { lang, t } = useLanguage();
  const [activeShield, setActiveShield] = useState<number>(0);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [dashboardImgError, setDashboardImgError] = useState(false);

  const shieldsVi = [
    {
      id: 0,
      title: 'Khóa toàn diện máy tính thí sinh',
      subtitle: 'Ngăn chặn tra cứu tài liệu và chia sẻ màn hình',
      desc: 'Ứng dụng tự động vô hiệu hóa các **phím tắt hệ thống** (Alt+Tab, Windows), ngăn kết nối **màn hình phụ**, phát hiện môi trường **máy ảo** và chặn hoàn toàn các phần mềm **điều khiển từ xa** như UltraViewer hay AnyDesk.',
      icon: Lock,
      badge: 'BẢO VỆ MÁY TÍNH',
      specs: [
        'Vô hiệu hóa Alt+Tab, Task Manager và phím tắt',
        'Chặn mọi ứng dụng điều khiển máy từ xa',
        'Tự động lưu bài khi rớt mạng Internet',
      ],
    },
    {
      id: 1,
      title: 'Trí tuệ nhân tạo phát hiện bất thường',
      subtitle: 'Tự động nhận diện hành vi gian lận và vật dụng cấm',
      desc: 'Mô hình học máy chạy trực tiếp trên **vi xử lý của thí sinh** với tốc độ cao mà không tốn chi phí máy chủ đắt đỏ. Tự động nhận diện khi có **người thứ hai xuất hiện**, phát hiện **điện thoại, tài liệu** và lập tức cảnh báo khi thí sinh quay mặt đi.',
      icon: Cpu,
      badge: 'TRÍ TUỆ NHÂN TẠO',
      specs: [
        'Đối soát khuôn mặt thí sinh liên tục',
        'Phát hiện điện thoại di động và tài liệu cấm',
        'Cảnh báo ngay khi thí sinh rời mắt khỏi bài thi',
      ],
    },
    {
      id: 2,
      title: 'Camera phụ góc nghiêng toàn cảnh',
      subtitle: 'Bao quát không gian bàn thi và thao tác tay của thí sinh',
      desc: 'Thí sinh chỉ cần dùng **điện thoại quét mã QR** để kích hoạt góc quay thứ hai mà **không cần cài đặt thêm ứng dụng**. Hệ thống tự động kiểm tra góc đặt điện thoại đạt chuẩn trước khi phát đề và báo động ngay nếu điện thoại bị tắt hoặc xê dịch.',
      icon: QrCode,
      badge: 'CAMERA ĐIỆN THOẠI',
      specs: [
        'Kết nối tức thì qua mã QR từ trình duyệt web',
        'Bao quát trọn vẹn bàn phím, màn hình và tay làm bài',
        'Báo động lập tức nếu điện thoại bị tắt màn hình',
      ],
    },
    {
      id: 3,
      title: 'Bằng chứng vi phạm minh bạch',
      subtitle: 'Hồ sơ đối soát đa góc phục vụ hội đồng kỷ luật',
      desc: 'Tự động trích xuất đoạn **video 15–30 giây đồng bộ** từ cả ba góc (camera trước, camera phụ và màn hình) tại đúng thời điểm nghi vấn. Dữ liệu được đính kèm **mã băm toàn vẹn** chống chỉnh sửa và cung cấp liên kết chia sẻ bảo mật cho hội đồng chấm thi.',
      icon: FileCheck,
      badge: 'BẰNG CHỨNG ĐỐI SOÁT',
      specs: [
        'Ghi nhận đồng bộ cả 3 góc quay tại thời điểm vi phạm',
        'Mã băm toàn vẹn bảo đảm tính pháp lý trước hội đồng',
        'Xuất bản liên kết tra cứu biên bản trực tuyến an toàn',
      ],
    },
  ];

  const shieldsEn = [
    {
      id: 0,
      title: 'Candidate computer lockdown',
      subtitle: 'Block unauthorized browsing and screen sharing',
      desc: 'Automatically disables **system hotkeys** (Alt+Tab, Win Key), prevents **secondary displays**, detects **virtual machines**, and completely blocks **remote desktop software** like AnyDesk or UltraViewer.',
      icon: Lock,
      badge: 'DESKTOP LOCKDOWN',
      specs: [
        'Disable Alt+Tab, Task Manager, and shortcuts',
        'Block all remote desktop and capture software',
        'Local encrypted buffer during network dropouts',
      ],
    },
    {
      id: 1,
      title: 'On-device AI anomaly detection',
      subtitle: 'Autonomous detection of physical cheating and prohibited items',
      desc: 'Lightweight neural networks run directly on the **candidate CPU** with low overhead. Instantly flags **secondary faces**, **mobile devices, notes**, and alerts proctors when candidates look away.',
      icon: Cpu,
      badge: 'EDGE ARTIFICIAL INTELLIGENCE',
      specs: [
        'Continuous biometric identity verification',
        'Detect cell phones, notes, and bluetooth earphones',
        'Immediate alert upon gaze aversion or disappearance',
      ],
    },
    {
      id: 2,
      title: 'Secondary 360° pan-tilt phone camera',
      subtitle: 'Overviews desk workspace, keyboard, and physical surroundings',
      desc: 'Students simply scan an on-screen **QR code using their smartphone** to establish a zero-install WebRTC feed. Precheck ensures proper 45-degree angle before the exam unlocks.',
      icon: QrCode,
      badge: 'MOBILE WEBRTC CAMERA',
      specs: [
        'Instant pairing via QR code on mobile browser',
        'Full coverage of desk, hands, keyboard, and screen',
        'Instant alert if phone screen locks or turns away',
      ],
    },
    {
      id: 3,
      title: 'Verifiable digital violation evidence',
      subtitle: 'Synchronous 3-angle audit clips for dispute resolution',
      desc: 'Automatically extracts a **15–30s synchronized video clip** from webcam, phone camera, and screen recording at the exact moment of anomaly, verified by **SHA-256 integrity hash**.',
      icon: FileCheck,
      badge: 'INTEGRITY EVIDENCE',
      specs: [
        'Synchronous 3-angle capture at the moment of incident',
        'SHA-256 hash chains ensure legal non-repudiation',
        'Secure shareable public links for faculty committees',
      ],
    },
  ];

  const shields = lang === 'en' ? shieldsEn : shieldsVi;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;
    setIsSubmitted(true);
  };

  return (
    <PublicLayout>
      <Head>
        <title>{t.landing.metaTitle}</title>
        <meta name="description" content={t.landing.heroDesc} />
      </Head>

      {/* =========================================================================
          HERO SECTION
      ========================================================================= */}
      <section className="pt-10 sm:pt-16 pb-16 sm:pb-20 bg-gradient-to-b from-blue-50/60 via-white to-slate-50/50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[12px] font-bold mb-5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{t.landing.badge}</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-black tracking-tight text-slate-900 leading-[1.18] max-w-[980px] mx-auto">
            {t.landing.heroTitle}
            <span className="block text-blue-600 mt-2 font-extrabold">{t.landing.heroTitleHighlight}</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 sm:mt-5 text-[15.5px] sm:text-[17px] text-slate-600 max-w-[800px] mx-auto leading-relaxed">
            {t.landing.heroDesc}
          </p>

          {/* Call To Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md sm:max-w-none mx-auto">
            <a
              href="#tu-van"
              className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 text-white text-[14.5px] font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>{t.landing.registerPilotCta}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <Link
              href="/download"
              className="w-full sm:w-auto px-6 py-3.5 bg-white border border-slate-300 text-slate-800 text-[14.5px] font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 fill-blue-600" viewBox="0 0 88 88">
                <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L0 75.48v-29.35zm4.326-39.043L87.314 0v41.527l-47.318.376zm47.329 44.912l-.011 41.535-47.318-6.678-.041-35.195z"/>
              </svg>
              <span>{t.landing.downloadWinCta}</span>
            </Link>
          </div>

          {/* Key Metrics */}
          <div className="mt-12 pt-7 border-t border-slate-200/90 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-[980px] mx-auto">
            <div className="p-2">
              <div className="text-3xl sm:text-4xl font-black text-blue-600 font-mono">{t.landing.metrics.latencyNum}</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">{t.landing.metrics.latencyLabel}</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">{t.landing.metrics.ratioNum}</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">{t.landing.metrics.ratioLabel}</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">{t.landing.metrics.costNum}</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">{t.landing.metrics.costLabel}</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">{t.landing.metrics.dataNum}</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">{t.landing.metrics.dataLabel}</div>
            </div>
          </div>

          {/* =========================================================================
              MOCKUP KHUNG HÌNH BẢNG ĐIỀU KHIỂN GIÁM THỊ
          ========================================================================= */}
          <div className="mt-12 max-w-[1060px] mx-auto bg-slate-950 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 text-left overflow-hidden">
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
                {t.landing.mockup.liveBadge}
              </span>
            </div>

            {!dashboardImgError ? (
              <div className="relative">
                <img
                  src="/images/mockups/dashboard-proctor.png"
                  alt="Giao diện giám sát phòng thi trực tiếp"
                  className="w-full h-auto block"
                  onError={() => setDashboardImgError(true)}
                />
              </div>
            ) : null}

            {dashboardImgError && (
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ô thí sinh 1: Bình thường */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-white">Lê Minh Khoa</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                      {t.landing.mockup.faceMatch}
                    </span>
                  </div>
                  <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center relative">
                    <Users className="w-8 h-8 text-slate-700" />
                    <span className="absolute bottom-1.5 right-1.5 text-[9.5px] font-mono text-emerald-400 bg-black/70 px-1 rounded">
                      {t.landing.mockup.secondCamOk}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex justify-between">
                    <span>{t.landing.mockup.kioskLocked}</span>
                    <span className="text-emerald-400">{t.landing.mockup.normalStatus}</span>
                  </div>
                </div>

                {/* Ô thí sinh 2: Báo động vật cấm */}
                <div className="rounded-xl border-2 border-red-500 bg-red-950/20 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Trần Thị Mai
                    </span>
                    <span className="text-[10px] text-red-400 font-bold bg-red-950/80 border border-red-800 px-1.5 py-0.5 rounded">
                      {t.landing.mockup.bannedObject}
                    </span>
                  </div>
                  <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center relative border border-red-500/40">
                    <Users className="w-8 h-8 text-slate-700" />
                    <div className="absolute bottom-2 left-2 border-2 border-red-500 bg-red-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-red-400" /> {t.landing.mockup.phoneDetected}
                    </div>
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-mono text-white bg-red-600 px-1 rounded font-bold">
                      {t.landing.mockup.videoReady}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] flex justify-between items-center text-red-300 font-medium">
                    <span>{t.landing.mockup.phoneDetected}</span>
                    <span className="text-blue-400 font-bold underline cursor-pointer">{t.landing.mockup.viewAngles}</span>
                  </div>
                </div>

                {/* Nhật ký sự kiện */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col justify-between text-xs font-mono">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-slate-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-blue-400" /> {t.landing.mockup.autoLogTitle}
                      </span>
                      <span className="text-[10px] text-slate-500">{t.landing.mockup.realtimeBadge}</span>
                    </div>
                    <div className="space-y-2 text-[10.5px]">
                      <div className="p-2 bg-red-950/40 border border-red-900/50 rounded text-slate-200">
                        {t.landing.mockup.log1}
                      </div>
                      <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded text-slate-300">
                        {t.landing.mockup.log2}
                      </div>
                      <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded text-slate-300">
                        {t.landing.mockup.log3}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[10.5px] text-slate-400 flex items-center justify-between">
                    <span>{t.landing.mockup.roomStatusLabel}</span>
                    <span className="text-emerald-400 font-bold">{t.landing.mockup.roomStatusGood}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SƠ ĐỒ 4 TẦNG KHIÊN BẢO VỆ
      ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Layers className="w-3.5 h-3.5" />
              {t.landing.shieldsSection.badge}
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {t.landing.shieldsSection.title}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              {t.landing.shieldsSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Cột chọn tầng khiên */}
            <div className="lg:col-span-5 space-y-3">
              {shields.map((s, idx) => {
                const Icon = s.icon;
                const isSelected = activeShield === idx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveShield(idx)}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20 ring-2 ring-blue-600/30'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                            isSelected
                              ? 'bg-white/20 text-blue-100'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {s.badge}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-semibold text-blue-100 flex items-center gap-1">
                            {t.landing.shieldsSection.viewing} <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <h3
                        className={`text-base font-bold mt-2 truncate ${
                          isSelected ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {s.title}
                      </h3>
                      <p
                        className={`text-xs mt-1 line-clamp-1 ${
                          isSelected ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        {s.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Chi tiết tầng khiên */}
            <div className="lg:col-span-7 bg-slate-900 text-white rounded-3xl p-6 sm:p-9 border border-slate-800 shadow-xl relative overflow-hidden min-h-[380px] flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 text-xs font-bold font-mono tracking-wider text-blue-400 uppercase mb-3">
                  <Shield className="w-4 h-4" />
                  <span>{shields[activeShield].badge}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
                  {shields[activeShield].title}
                </h3>
                <p className="text-sm text-blue-200 font-medium mb-5">
                  {shields[activeShield].subtitle}
                </p>

                <div className="text-sm sm:text-[15px] text-slate-300 leading-relaxed mb-6">
                  {shields[activeShield].desc.split('**').map((chunk, cIdx) =>
                    cIdx % 2 === 1 ? (
                      <strong key={cIdx} className="text-white font-semibold">
                        {chunk}
                      </strong>
                    ) : (
                      chunk
                    )
                  )}
                </div>

                <div className="space-y-2.5 pt-5 border-t border-slate-800">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t.landing.shieldsSection.benefitsLabel}
                  </div>
                  {shields[activeShield].specs.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 relative z-10">
                <span>{t.landing.shieldsSection.footerNote}</span>
                <Link
                  href="/features"
                  className="text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1.5"
                >
                  {t.landing.shieldsSection.viewMoreFeatures} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          VIDEO DEMO
      ========================================================================= */}
      <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1060px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Play className="w-3.5 h-3.5 fill-blue-700" />
            {t.landing.videoSection.badge}
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {t.landing.videoSection.title}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            {t.landing.videoSection.desc}
          </p>

          <div className="mt-8 rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-black aspect-video max-w-4xl mx-auto">
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
          LIÊN HỆ & ĐĂNG KÝ THÍ ĐIỂM (#tu-van)
      ========================================================================= */}
      <section id="tu-van" className="py-16 sm:py-24 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 text-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-full text-xs font-bold uppercase tracking-wider text-blue-100 mb-3">
                {t.landing.pilotForm.badge}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                {t.landing.pilotForm.title}
              </h2>
              <p className="mt-4 text-[15.5px] text-blue-100 leading-relaxed">
                {t.landing.pilotForm.desc}
              </p>

              <div className="mt-6 space-y-3 text-sm text-blue-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t.landing.pilotForm.bullet1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t.landing.pilotForm.bullet2}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t.landing.pilotForm.bullet3}</span>
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
                  <h3 className="text-xl font-bold text-slate-900">{t.landing.pilotForm.successTitle}</h3>
                  <p className="text-sm text-slate-600">
                    {t.landing.pilotForm.successDesc}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <h3 className="text-xl font-bold text-slate-900">{t.landing.pilotForm.formTitle}</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      {t.landing.pilotForm.nameLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === 'vi' ? 'ThS. Nguyễn Văn A' : 'Dr. John Doe'}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        {t.landing.pilotForm.emailLabel}
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
                        {t.landing.pilotForm.phoneLabel}
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
                      {t.landing.pilotForm.orgLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === 'vi' ? 'Trường Đại học / Cao đẳng / Khoa' : 'University / College / Faculty'}
                      value={formOrg}
                      onChange={(e) => setFormOrg(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-600"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer mt-2"
                  >
                    {t.landing.pilotForm.submitBtn}
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
