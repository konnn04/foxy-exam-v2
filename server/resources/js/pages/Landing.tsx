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
  Image as ImageIcon,
} from 'lucide-react';

export default function Landing() {
  const [activeShield, setActiveShield] = useState<number>(0);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [dashboardImgError, setDashboardImgError] = useState(false);

  const shields = [
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;
    setIsSubmitted(true);
  };

  return (
    <PublicLayout>
      <Head>
        <title>Exam Guard · Hệ thống giám sát thi cử trực tuyến và phòng máy thông minh</title>
        <meta
          name="description"
          content="Exam Guard: Nền tảng giám sát thi cử trực tuyến và phòng máy thế hệ mới. Khóa môi trường thi, AI nhận diện bất thường tức thì, dữ liệu lưu trữ nội địa tuân thủ Nghị định 13/2023/NĐ-CP."
        />
      </Head>

      {/* =========================================================================
          HERO SECTION: SÚC TÍCH, TRỌNG TÂM, HƯỚNG VỀ LỢI ÍCH KHÁCH HÀNG
      ========================================================================= */}
      <section className="pt-10 sm:pt-16 pb-16 sm:pb-20 bg-gradient-to-b from-blue-50/60 via-white to-slate-50/50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[12px] font-bold mb-5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>ĐỀ ÁN KHẢO THÍ SỐ · KHOA CNTT · TRƯỜNG ĐH MỞ TP.HCM</span>
          </div>

          {/* Heading - chuẩn Sentence Case tiếng Việt */}
          <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-black tracking-tight text-slate-900 leading-[1.18] max-w-[980px] mx-auto">
            Giám sát thi cử trực tuyến và phòng máy thông minh
            <span className="block text-blue-600 mt-2 font-extrabold">Bảo đảm toàn vẹn và công bằng với trí tuệ nhân tạo</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 sm:mt-5 text-[15.5px] sm:text-[17px] text-slate-600 max-w-[800px] mx-auto leading-relaxed">
            Exam Guard kết hợp ứng dụng khóa màn hình chống gian lận và trí tuệ nhân tạo giám sát tự động. Phát hiện vi phạm chỉ trong <strong>≤ 2 giây</strong>, tiết kiệm <strong>85% chi phí tổ chức</strong> và giảm thiểu tối đa gánh nặng cho cán bộ coi thi.
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
              <div className="text-[13px] font-medium text-slate-600 mt-1">Phát hiện bất thường tức thì</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">1 : 80</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">Một giám thị bao quát 80 thí sinh</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">4.500 đ</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">Chi phí tối ưu cho mỗi lượt thi</div>
            </div>
            <div className="p-2 md:border-l border-slate-200">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">100%</div>
              <div className="text-[13px] font-medium text-slate-600 mt-1">Lưu trữ máy chủ tại Việt Nam</div>
            </div>
          </div>

          {/* =========================================================================
              MOCKUP KHUNG HÌNH BẢNG ĐIỀU KHIỂN GIÁM THỊ (HỖ TRỢ THAY ẢNH DỄ DÀNG)
          ========================================================================= */}
          <div className="mt-12 max-w-[1060px] mx-auto bg-slate-950 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 text-left overflow-hidden">
            {/* Header thanh cửa sổ */}
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
                TRỰC TIẾP · 78/80 THÍ SINH
              </span>
            </div>

            {/* Khung nội dung ảnh: tự động ưu tiên ảnh thật nếu có tại public/images/mockups/dashboard-proctor.png */}
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

            {/* Giao diện mô phỏng mặc định khi chưa có tệp ảnh */}
            {dashboardImgError && (
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ô thí sinh 1: Bình thường */}
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
                      CAM PHỤ: HỢP LỆ
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex justify-between">
                    <span>Môi trường: Đã khóa an toàn</span>
                    <span className="text-emerald-400">Bình thường</span>
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
                      VẬT CẤM
                    </span>
                  </div>
                  <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center relative border border-red-500/40">
                    <Users className="w-8 h-8 text-slate-700" />
                    <div className="absolute bottom-2 left-2 border-2 border-red-500 bg-red-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-red-400" /> Phát hiện điện thoại 91%
                    </div>
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-mono text-white bg-red-600 px-1 rounded font-bold">
                      VIDEO ĐỐI SOÁT ĐÃ SẴN SÀNG
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] flex justify-between items-center text-red-300 font-medium">
                    <span>Phát hiện sử dụng điện thoại</span>
                    <span className="text-blue-400 font-bold underline cursor-pointer">Xem 3 góc</span>
                  </div>
                </div>

                {/* Nhật ký sự kiện thời gian thực */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col justify-between text-xs font-mono">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-slate-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-blue-400" /> NHẬT KÝ TỰ ĐỘNG
                      </span>
                      <span className="text-[10px] text-slate-500">THỜI GIAN THỰC</span>
                    </div>
                    <div className="space-y-2 text-[10.5px]">
                      <div className="p-2 bg-red-950/40 border border-red-900/50 rounded text-slate-200">
                        <span className="text-red-400 font-bold">14:22 · CẢNH BÁO:</span> Phát hiện điện thoại tại bàn thi Mai (91%).
                      </div>
                      <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded text-slate-300">
                        <span className="text-slate-400 font-bold">14:20 · THÔNG BÁO:</span> 78 thí sinh đã hoàn tất kiểm tra camera phụ.
                      </div>
                      <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded text-slate-300">
                        <span className="text-emerald-400 font-bold">14:15 · BẮT ĐẦU:</span> Đề thi đã được mở khóa đồng bộ trên toàn phòng.
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 text-[10.5px] text-slate-400 flex items-center justify-between">
                    <span>Trạng thái phòng thi:</span>
                    <span className="text-emerald-400 font-bold">Đang kiểm soát tốt</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SƠ ĐỒ 4 TẦNG KHIÊN BẢO VỆ (KHÔNG NGOẶC ĐƠN, GỌN GÀNG, IN ĐẬM KEYWORD)
      ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
              <Layers className="w-3.5 h-3.5" />
              Kiến trúc phòng thủ đa tầng
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Sơ đồ 4 tầng bảo vệ toàn diện kỳ thi
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Ngăn ngừa mọi hình thức gian lận từ phần cứng, hệ điều hành đến hành vi thực tế trong suốt quá trình làm bài.
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
                            Đang xem <ArrowRight className="w-3.5 h-3.5" />
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

            {/* Chi tiết tầng khiên đang chọn */}
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

                {/* Mô tả có in đậm từ khóa */}
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
                    Lợi ích vận hành thực tế:
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
                <span>Giải pháp thiết kế riêng cho trường đại học và viện đào tạo</span>
                <Link
                  href="/features"
                  className="text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1.5"
                >
                  Xem chi tiết tính năng <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          VIDEO DEMO SECTION
      ========================================================================= */}
      <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1060px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Play className="w-3.5 h-3.5 fill-blue-700" />
            Video trải nghiệm thực tế
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Quy trình tổ chức một kỳ thi trực tuyến
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            Xem video thực tế quá trình thí sinh quét mã QR vào phòng, ứng dụng tự động khóa màn hình và giám thị theo dõi trực tiếp.
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
                CHƯƠNG TRÌNH THÍ ĐIỂM
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Đăng ký tham gia thí điểm khảo thí miễn phí
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
                  <span>Bàn giao báo cáo đối soát toàn diện sau kỳ thi</span>
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
                  <h3 className="text-xl font-bold text-slate-900">Phiếu đăng ký thí điểm</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Họ tên cán bộ đại diện hoặc giảng viên *
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
                      Trường hoặc đơn vị đào tạo
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
