import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { ShieldCheck, Laptop, Cpu, CheckCircle2, ChevronRight, AlertTriangle, Monitor, ExternalLink, Download } from 'lucide-react';

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
  // Billing cycle state: false = monthly, true = yearly
  const [isYearly, setIsYearly] = useState(false);

  // Contact form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formScale, setFormScale] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;
    setIsSubmitted(true);
  };

  const proPrice = isYearly ? '24.900.000đ' : '2.490.000đ';
  const proPriceNote = isYearly ? 'mỗi năm — tiết kiệm 2 tháng' : 'mỗi tháng, thanh toán hàng tháng';

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#F2EFE9] font-['Be_Vietnam_Pro',system-ui,sans-serif] selection:bg-[#FF5D23] selection:text-[#0B0B0C] overflow-x-hidden antialiased">
      <Head>
        <title>Foxy Exam · Nền tảng thi trực tuyến có giám sát AI &amp; Lockdown Browser</title>
        <meta
          name="description"
          content="Foxy Exam là phòng thi số có AI canh 24/7: nhận diện khuôn mặt, khóa máy tính bằng Lockdown và đọc tín hiệu hệ thống. Một giám thị coi được 200 thí sinh kèm bằng chứng vi phạm đầy đủ."
        />
      </Head>

      {/* =========================================================================
          HEADER (STICKY, BORDER BOTTTOM, TECHNICAL BRUTALIST)
      ========================================================================= */}
      <header className="sticky top-0 z-50 bg-[#0B0B0C]/90 backdrop-blur-md border-b border-[rgba(242,239,233,0.14)]">
        <div className="flex flex-wrap items-stretch justify-between gap-0 max-w-[1440px] mx-auto">
          {/* Brand Logo & Proctoring Tag */}
          <div className="flex items-center gap-3 px-6 py-4 border-r border-[rgba(242,239,233,0.14)] shrink-0">
            <div className="w-[30px] h-[30px] bg-[#FF5D23] flex items-center justify-center font-bold text-[#0B0B0C] text-sm">
              🦊
            </div>
            <span className="text-[17px] font-bold tracking-tight whitespace-nowrap">
              FOXY EXAM
            </span>
            <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] font-semibold tracking-wider text-[#FF5D23] border border-[#FF5D23]/50 px-1.5 py-0.5 whitespace-nowrap">
              PROCTORING
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-6 px-6 font-['IBM_Plex_Mono',monospace] text-[12px] font-medium tracking-wider uppercase text-[#B5B1A8] whitespace-nowrap shrink-0">
            <a href="#nang-luc" className="hover:text-[#F2EFE9] transition-colors">
              01 Năng lực
            </a>
            <a href="#van-hanh" className="hover:text-[#F2EFE9] transition-colors">
              02 Vận hành
            </a>
            <a href="#demo" className="hover:text-[#F2EFE9] transition-colors">
              03 Demo
            </a>
            <a href="#gia" className="hover:text-[#F2EFE9] transition-colors">
              04 Giá
            </a>
            <a href="/docs/api" target="_blank" rel="noreferrer" className="hover:text-[#FF5D23] transition-colors">
              API Docs
            </a>
          </nav>

          {/* Header Actions */}
          <div className="flex items-stretch shrink-0">
            <Link
              href="/login"
              className="flex items-center px-5 sm:px-6 border-l border-[rgba(242,239,233,0.14)] text-[14px] font-semibold text-[#F2EFE9] hover:bg-[#F2EFE9]/10 transition-colors whitespace-nowrap"
            >
              Đăng nhập
            </Link>
            <a
              href="#tai-app"
              className="flex items-center gap-2 px-5 sm:px-7 bg-[#FF5D23] text-[#0B0B0C] text-[14px] font-bold whitespace-nowrap hover:bg-[#F2EFE9] transition-colors"
            >
              Tải app Windows
            </a>
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION (SPLIT ASYMMETRIC GRID WITH SUPERVISOR DASHBOARD)
      ========================================================================= */}
      <section className="border-b border-[rgba(242,239,233,0.14)]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] max-w-[1440px] mx-auto">
          {/* Left Column: Heading & Value Proposition */}
          <div className="p-6 sm:p-12 lg:p-16 lg:border-r border-[rgba(242,239,233,0.14)] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider uppercase text-[#C5C1B6]">
                <span className="w-1.5 h-1.5 bg-[#FF5D23] rounded-full animate-[fxBlink_1.6s_steps(1)_infinite]" />
                Khởi nghiệp Sinh viên 2026 · Bản demo đang chạy
              </div>

              <h1 className="mt-7 text-5xl sm:text-7xl lg:text-8xl font-black leading-[0.96] tracking-[-0.04em] text-balance">
                Gian lận
                <br />
                <span className="text-[#FF5D23]">không còn</span>
                <br />
                chỗ trốn.
              </h1>

              <p className="mt-7 max-w-[490px] text-[17.5px] font-normal leading-[1.65] text-[#E0DCD3] text-pretty">
                Foxy Exam là phòng thi số có AI canh 24/7: nhận diện khuôn mặt, khóa máy tính bằng
                Lockdown và đọc tín hiệu hệ thống. Một giám thị coi được 200 thí sinh — và mọi vi
                phạm đều có bằng chứng kèm mốc thời gian.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-0 mt-9 border border-[rgba(242,239,233,0.25)] w-fit">
                <a
                  href="#tai-app"
                  className="px-6 sm:px-7 py-4 bg-[#FF5D23] text-[#0B0B0C] text-[15.5px] font-bold whitespace-nowrap hover:bg-[#F2EFE9] transition-colors"
                >
                  Dùng thử miễn phí
                </a>
                <a
                  href="#lien-he"
                  className="px-6 sm:px-7 py-4 text-[#F2EFE9] text-[15.5px] font-semibold border-l border-[rgba(242,239,233,0.25)] whitespace-nowrap hover:bg-[#F2EFE9]/10 transition-colors"
                >
                  Đặt demo 15 phút →
                </a>
              </div>

              <div className="mt-6 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider uppercase text-[#B5B1A8]">
                Không cần thẻ · Cài trong 2 phút · Windows 10/11
              </div>
            </div>
          </div>

          {/* Right Column: Supervisor Dashboard Realtime View */}
          <div className="bg-[#101012] grid grid-rows-[auto_1fr_auto] border-t lg:border-t-0 border-[rgba(242,239,233,0.14)]">
            {/* Live Indicator Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[rgba(242,239,233,0.14)] font-['IBM_Plex_Mono',monospace] text-[11px] tracking-wider uppercase text-[#8E8B85]">
              <span>Bảng điều khiển giám thị · KỲ THI #2431</span>
              <span className="text-[#FF5D23] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF5D23] animate-pulse" />
                LIVE STREAM
              </span>
            </div>

            {/* Simulated Live Supervisor Canvas */}
            <div className="relative min-h-[340px] p-6 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#141418] to-[#0D0D0F]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-['IBM_Plex_Mono',monospace] text-xs text-[#8E8B85]">
                    <Monitor className="w-4 h-4 text-[#FF5D23]" />
                    <span>PHÒNG THI A-204 (200 THÍ SINH)</span>
                  </div>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#FF5D23] border border-[#FF5D23]/30 px-2 py-0.5">
                    LOCKDOWN ACTIVE
                  </span>
                </div>

                {/* Candidate Feed Grid Preview */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <div className="border border-emerald-500/40 bg-[#0B0B0C] p-2 text-center rounded-[2px] relative">
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-emerald-400 block">TS-0001</span>
                    <span className="text-[9px] text-[#8E8B85]">Bình thường</span>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full absolute top-1.5 right-1.5" />
                  </div>
                  <div className="border border-[#FF5D23] bg-[#FF5D23]/10 p-2 text-center rounded-[2px] relative">
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#FF5D23] font-bold block">TS-0142</span>
                    <span className="text-[9px] text-[#FF5D23]">Rời webcam</span>
                    <div className="w-1.5 h-1.5 bg-[#FF5D23] rounded-full absolute top-1.5 right-1.5 animate-ping" />
                  </div>
                  <div className="border border-emerald-500/40 bg-[#0B0B0C] p-2 text-center rounded-[2px] relative">
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-emerald-400 block">TS-0035</span>
                    <span className="text-[9px] text-[#8E8B85]">Bình thường</span>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full absolute top-1.5 right-1.5" />
                  </div>
                  <div className="border border-rose-500 bg-rose-500/10 p-2 text-center rounded-[2px] relative">
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-rose-400 font-bold block">TS-0088</span>
                    <span className="text-[9px] text-rose-400">VMware detected</span>
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full absolute top-1.5 right-1.5 animate-ping" />
                  </div>
                </div>

                {/* Key Telemetry Visualizer */}
                <div className="mt-4 p-4 border border-[rgba(242,239,233,0.1)] bg-[#0B0B0C]/60 rounded-[2px] space-y-2 text-xs font-['IBM_Plex_Mono',monospace]">
                  <div className="flex justify-between text-[#8E8B85]">
                    <span>AI PROCTORING LATENCY</span>
                    <span className="text-emerald-400">14ms · Cloudflare Worker</span>
                  </div>
                  <div className="flex justify-between text-[#8E8B85]">
                    <span>KEYSTROKE FLIGHT RATIO</span>
                    <span className="text-emerald-400">Normal (0.84 ops/sec)</span>
                  </div>
                  <div className="flex justify-between text-[#8E8B85]">
                    <span>CLIPBOARD / PASTE DETECTOR</span>
                    <span className="text-[#FF5D23]">Locked · 0 paste attempts</span>
                  </div>
                </div>
              </div>

              <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#8E8B85] pt-4">
                Dữ liệu giám sát tự động mã hoá TLS 1.3 · Lưu trữ tại cụm máy chủ Việt Nam
              </div>
            </div>

            {/* Bottom 3 Status Pillars */}
            <div className="flex flex-wrap border-t border-[rgba(242,239,233,0.14)]">
              <div className="flex-1 min-w-[150px] p-4 sm:p-5 border-r border-[rgba(242,239,233,0.14)]">
                <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] tracking-wider text-[#9A968F]">
                  CẢNH BÁO
                </div>
                <div className="mt-1.5 text-[15px] font-semibold">Rời khỏi khung hình</div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#FF5D23] font-medium">
                  TS-0142 · 00:12:40
                </div>
              </div>

              <div className="flex-1 min-w-[150px] p-4 sm:p-5 border-r border-[rgba(242,239,233,0.14)]">
                <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] tracking-wider text-[#9A968F]">
                  CẢNH BÁO
                </div>
                <div className="mt-1.5 text-[15px] font-semibold">Phát hiện máy ảo</div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#FF5D23] font-medium">
                  TS-0088 · 00:31:05
                </div>
              </div>

              <div className="flex-1 min-w-[150px] p-4 sm:p-5">
                <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] tracking-wider text-[#9A968F]">
                  ĐANG THI
                </div>
                <div className="mt-1.5 text-[15px] font-semibold">198 / 200 bình thường</div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#8E8B85]">
                  Điểm rủi ro TB 0.07
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TICKER BAR (MARQUEE INFINITE)
      ========================================================================= */}
      <div className="overflow-hidden border-b border-[rgba(242,239,233,0.14)] bg-[#0B0B0C]">
        <div className="flex w-max animate-[fxTicker_38s_linear_infinite] hover:[animation-play-state:paused] font-['IBM_Plex_Mono',monospace] text-[12.5px] tracking-[0.14em] uppercase text-[#8E8B85]">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-10 py-3.5 px-5">
              <span>Nhận diện khuôn mặt</span>
              <span className="text-[#FF5D23]">✳</span>
              <span>Lockdown Browser</span>
              <span className="text-[#FF5D23]">✳</span>
              <span>Chống máy ảo &amp; Remote</span>
              <span className="text-[#FF5D23]">✳</span>
              <span>Camera phụ qua QR</span>
              <span className="text-[#FF5D23]">✳</span>
              <span>Điểm rủi ro theo thời gian thực</span>
              <span className="text-[#FF5D23]">✳</span>
              <span>Hồ sơ bằng chứng PDF/CSV</span>
              <span className="text-[#FF5D23]">✳</span>
              <span>Trộn đề tự động</span>
              <span className="text-[#FF5D23]">✳</span>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          REALITY CHECK SECTION (LIGHT BACKGROUND CONTRAST #F2EFE9, TEXT #0B0B0C)
      ========================================================================= */}
      <section className="bg-[#F2EFE9] text-[#0B0B0C]">
        <div className="grid grid-cols-1 md:grid-cols-2 max-w-[1440px] mx-auto">
          {/* Left Reality statement */}
          <div className="p-8 sm:p-14 lg:p-16 md:border-r border-[rgba(11,11,12,0.14)]">
            <div className="font-['IBM_Plex_Mono',monospace] text-[12px] font-bold tracking-wider uppercase text-[#A8380F]">
              Thực tế hiện nay
            </div>
            <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold leading-[1.04] tracking-[-0.035em] max-w-[460px] text-[#0B0B0C]">
              Zoom cộng Google Form không phải một kỳ thi.
            </h2>
            <p className="mt-5 max-w-[440px] text-[17px] font-normal leading-[1.7] text-[#26231F]">
              Giám thị nhìn 40 khung hình tí xíu, máy thí sinh là vùng tối hoàn toàn, và khi có
              khiếu nại thì không ai giữ được bằng chứng nào.
            </p>
          </div>

          {/* Right 3 Pain Points */}
          <div>
            <div className="p-8 border-b border-[rgba(11,11,12,0.14)] grid grid-cols-[54px_1fr] gap-4">
              <span className="font-['IBM_Plex_Mono',monospace] text-[14px] font-bold text-[#A8380F]">
                01
              </span>
              <div>
                <div className="text-[20px] font-bold tracking-tight text-[#0B0B0C]">
                  Một người, hai trăm webcam
                </div>
                <p className="mt-2 text-[15.5px] font-normal leading-relaxed text-[#26231F]">
                  Bỏ lọt vi phạm là mặc định, không phải ngoại lệ khi con người phải quan sát quá
                  nhiều camera cùng lúc.
                </p>
              </div>
            </div>

            <div className="p-8 border-b border-[rgba(11,11,12,0.14)] grid grid-cols-[54px_1fr] gap-4">
              <span className="font-['IBM_Plex_Mono',monospace] text-[14px] font-bold text-[#A8380F]">
                02
              </span>
              <div>
                <div className="text-[20px] font-bold tracking-tight text-[#0B0B0C]">
                  Trình duyệt không thấy gì
                </div>
                <p className="mt-2 text-[15.5px] font-normal leading-relaxed text-[#26231F]">
                  Máy ảo, phần mềm điều khiển từ xa UltraViewer/AnyDesk, tab tài liệu mở sẵn hoặc
                  ChatGPT cạnh bên — đều vô hình trên web thông thường.
                </p>
              </div>
            </div>

            <div className="p-8 grid grid-cols-[54px_1fr] gap-4">
              <span className="font-['IBM_Plex_Mono',monospace] text-[14px] font-bold text-[#A8380F]">
                03
              </span>
              <div>
                <div className="text-[20px] font-bold tracking-tight text-[#0B0B0C]">
                  Kết luận dựa vào cảm tính
                </div>
                <p className="mt-2 text-[15.5px] font-normal leading-relaxed text-[#26231F]">
                  Không log, không ảnh, không video bằng chứng mốc thời gian — uy tín kỳ thi và hội
                  đồng chấm bị đặt dấu hỏi lớn khi sinh viên khiếu nại.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 01: NĂNG LỰC (6 TÍN HIỆU, 1 ĐIỂM RỦI RO)
      ========================================================================= */}
      <section id="nang-luc" className="border-t border-[rgba(242,239,233,0.14)]">
        <div className="max-w-[1440px] mx-auto">
          <div className="p-8 sm:p-14 flex flex-wrap gap-6 items-end justify-between border-b border-[rgba(242,239,233,0.14)]">
            <div>
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-bold tracking-wider uppercase text-[#FF5D23]">
                01 — Năng lực
              </div>
              <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-[-0.035em] max-w-[560px]">
                Sáu tín hiệu, một điểm rủi ro
              </h2>
            </div>
            <p className="max-w-[400px] text-[16px] font-normal leading-relaxed text-[#D2CEC5]">
              Mọi lớp giám sát chạy song song và cùng đổ về một con số, nên giám thị chỉ xem những
              gì đáng xem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 01 */}
            <div className="p-8 border-r border-b border-[rgba(242,239,233,0.14)] hover:bg-[#121215] transition-colors">
              <div className="flex items-baseline justify-between gap-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider text-[#B5B1A8]">
                <span>F.01</span>
                <span className="text-[#FF5D23] font-bold">CAMERA</span>
              </div>
              <h3 className="mt-5 text-[21px] font-bold tracking-tight text-[#F2EFE9]">
                Nhận diện khuôn mặt liên tục
              </h3>
              <p className="mt-3 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Đối chiếu ảnh định danh, phát hiện vắng mặt, thay người thi hộ, nhiều người trong
                khung hình hoặc mắt rời màn hình quá lâu.
              </p>
            </div>

            {/* Feature 02 */}
            <div className="p-8 border-r border-b border-[rgba(242,239,233,0.14)] hover:bg-[#121215] transition-colors">
              <div className="flex items-baseline justify-between gap-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider text-[#B5B1A8]">
                <span>F.02</span>
                <span className="text-[#FF5D23] font-bold">HỆ ĐIỀU HÀNH</span>
              </div>
              <h3 className="mt-5 text-[21px] font-bold tracking-tight text-[#F2EFE9]">
                Lockdown Browser (Tauri)
              </h3>
              <p className="mt-3 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Khóa toàn màn hình, vô hiệu hóa phím tắt hệ thống (Alt+Tab, Windows key), chặn
                copy/paste và không cho mở ứng dụng khác trong lúc thi.
              </p>
            </div>

            {/* Feature 03 */}
            <div className="p-8 border-b border-[rgba(242,239,233,0.14)] hover:bg-[#121215] transition-colors">
              <div className="flex items-baseline justify-between gap-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider text-[#B5B1A8]">
                <span>F.03</span>
                <span className="text-[#FF5D23] font-bold">TELEMETRY</span>
              </div>
              <h3 className="mt-5 text-[21px] font-bold tracking-tight text-[#F2EFE9]">
                Chống máy ảo &amp; remote
              </h3>
              <p className="mt-3 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Đọc dấu vết phần cứng BIOS/MAC, IP/VPN, tiến trình đang chạy để phát hiện VMware,
                VirtualBox hay phần mềm điều khiển từ xa.
              </p>
            </div>

            {/* Feature 04 */}
            <div className="p-8 border-r border-b border-[rgba(242,239,233,0.14)] hover:bg-[#121215] transition-colors">
              <div className="flex items-baseline justify-between gap-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider text-[#B5B1A8]">
                <span>F.04</span>
                <span className="text-[#FF5D23] font-bold">GÓC QUAY 2</span>
              </div>
              <h3 className="mt-5 text-[21px] font-bold tracking-tight text-[#F2EFE9]">
                Camera phụ qua điện thoại
              </h3>
              <p className="mt-3 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Quét QR để biến điện thoại thành góc quay thứ hai: thấy tay, bàn phím, mặt bàn và
                toàn bộ không gian xung quanh thí sinh.
              </p>
            </div>

            {/* Feature 05 */}
            <div className="p-8 border-r border-b border-[rgba(242,239,233,0.14)] hover:bg-[#121215] transition-colors">
              <div className="flex items-baseline justify-between gap-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider text-[#B5B1A8]">
                <span>F.05</span>
                <span className="text-[#FF5D23] font-bold">BẰNG CHỨNG</span>
              </div>
              <h3 className="mt-5 text-[21px] font-bold tracking-tight text-[#F2EFE9]">
                Dòng thời gian vi phạm
              </h3>
              <p className="mt-3 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Mỗi thí sinh có timeline mốc thời gian kèm ảnh chụp và video tại đúng thời điểm nghi
                vấn, xuất PDF/CSV cho hội đồng xử lý.
              </p>
            </div>

            {/* Feature 06 */}
            <div className="p-8 border-b border-[rgba(242,239,233,0.14)] hover:bg-[#121215] transition-colors">
              <div className="flex items-baseline justify-between gap-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider text-[#B5B1A8]">
                <span>F.06</span>
                <span className="text-[#FF5D23] font-bold">QUẢN TRỊ</span>
              </div>
              <h3 className="mt-5 text-[21px] font-bold tracking-tight text-[#F2EFE9]">
                Tạo &amp; trộn đề trên web
              </h3>
              <p className="mt-3 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Nhập câu hỏi từ Excel hoặc soạn LeetCode đề bài, tự động trộn đề theo từng thí sinh,
                chọn mức giám sát Web hoặc Strict cho từng kỳ thi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02: VẬN HÀNH (4 BƯỚC)
      ========================================================================= */}
      <section id="van-hanh" className="border-b border-[rgba(242,239,233,0.14)]">
        <div className="max-w-[1440px] mx-auto">
          <div className="p-8 sm:p-14 border-b border-[rgba(242,239,233,0.14)]">
            <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-bold tracking-wider uppercase text-[#FF5D23]">
              02 — Vận hành
            </div>
            <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-[-0.035em] max-w-[500px]">
              Từ tạo đề đến báo cáo: bốn bước
            </h2>
            <p className="mt-4 max-w-[460px] text-[16px] font-normal leading-relaxed text-[#D2CEC5]">
              Giám thị không cần cài gì cả — mọi thứ diễn ra trên web. Thí sinh chỉ cài app một lần
              nhẹ nhàng.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 01 */}
            <div className="p-8 border-r border-b lg:border-b-0 border-[rgba(242,239,233,0.14)]">
              <div className="text-5xl font-black tracking-tight text-[#FF5D23] leading-none">
                01
              </div>
              <h3 className="mt-4 text-[19px] font-bold text-[#F2EFE9]">Tạo kỳ thi</h3>
              <p className="mt-2.5 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Nhập đề thi trắc nghiệm hoặc bài toán lập trình, đặt thời lượng, trộn câu hỏi và chọn
                mức giám sát phù hợp.
              </p>
            </div>

            {/* Step 02 */}
            <div className="p-8 border-r border-b lg:border-b-0 border-[rgba(242,239,233,0.14)]">
              <div className="text-5xl font-black tracking-tight text-[#FF5D23] leading-none">
                02
              </div>
              <h3 className="mt-4 text-[19px] font-bold text-[#F2EFE9]">Kiểm tra thiết bị</h3>
              <p className="mt-2.5 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                App tự động kiểm tra camera, mic, kết nối mạng, chụp ảnh định danh và quét mã QR cho
                camera phụ điện thoại.
              </p>
            </div>

            {/* Step 03 */}
            <div className="p-8 border-r border-b sm:border-b-0 border-[rgba(242,239,233,0.14)]">
              <div className="text-5xl font-black tracking-tight text-[#FF5D23] leading-none">
                03
              </div>
              <h3 className="mt-4 text-[19px] font-bold text-[#F2EFE9]">AI canh, người quyết</h3>
              <p className="mt-2.5 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Danh sách thí sinh tự động sắp xếp theo điểm rủi ro. Giám thị chỉ cần click nhắc nhở,
                chat riêng hoặc tạm dừng bài thi.
              </p>
            </div>

            {/* Step 04 */}
            <div className="p-8">
              <div className="text-5xl font-black tracking-tight text-[#FF5D23] leading-none">
                04
              </div>
              <h3 className="mt-4 text-[19px] font-bold text-[#F2EFE9]">Xuất hồ sơ</h3>
              <p className="mt-2.5 text-[15px] font-normal leading-[1.65] text-[#D8D4CA]">
                Điểm số, thống kê toàn kỳ thi và danh sách nghi vấn kèm bằng chứng mốc thời gian — xuất
                ngay dạng PDF hoặc CSV.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03: DEMO (SẢN PHẨM THẬT, CHỤP THẬT - LIGHT CONTRAST)
      ========================================================================= */}
      <section id="demo" className="bg-[#F2EFE9] text-[#0B0B0C]">
        <div className="max-w-[1440px] mx-auto">
          <div className="p-8 sm:p-14 flex flex-wrap gap-4 items-end justify-between border-b border-[rgba(11,11,12,0.14)]">
            <div>
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase text-[#7A5240]">
                03 — Demo
              </div>
              <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-[-0.035em]">
                Sản phẩm thật, chạy thật
              </h2>
            </div>
            <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase text-[#9A968F]">
              Kéo ngang để xem các giao diện →
            </div>
          </div>

          {/* Horizontal Snapshot Slider */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none snap-x snap-mandatory border-b border-[rgba(11,11,12,0.14)]">
            <figure className="m-0 shrink-0 w-[min(540px,85vw)] snap-start border-r border-[rgba(11,11,12,0.14)] p-6 bg-white">
              <div className="aspect-[16/10] bg-[#E4E0D8] flex items-center justify-center font-['IBM_Plex_Mono',monospace] text-xs text-[#7A5240] border border-[rgba(11,11,12,0.1)] p-4 text-center">
                Màn hình Dashboard Giám thị Realtime
              </div>
              <figcaption className="pt-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase text-[#4A463F]">
                01 / Dashboard giám thị trực quan
              </figcaption>
            </figure>

            <figure className="m-0 shrink-0 w-[min(540px,85vw)] snap-start border-r border-[rgba(11,11,12,0.14)] p-6 bg-white">
              <div className="aspect-[16/10] bg-[#E4E0D8] flex items-center justify-center font-['IBM_Plex_Mono',monospace] text-xs text-[#7A5240] border border-[rgba(11,11,12,0.1)] p-4 text-center">
                Cảnh báo AI: Nhận diện khuôn mặt &amp; vật cấm
              </div>
              <figcaption className="pt-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase text-[#4A463F]">
                02 / Cảnh báo AI thời gian thực
              </figcaption>
            </figure>

            <figure className="m-0 shrink-0 w-[min(540px,85vw)] snap-start border-r border-[rgba(11,11,12,0.14)] p-6 bg-white">
              <div className="aspect-[16/10] bg-[#E4E0D8] flex items-center justify-center font-['IBM_Plex_Mono',monospace] text-xs text-[#7A5240] border border-[rgba(11,11,12,0.1)] p-4 text-center">
                FoxyClient Desktop App Chế độ Lockdown
              </div>
              <figcaption className="pt-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase text-[#4A463F]">
                03 / App thi chế độ Lockdown
              </figcaption>
            </figure>

            <figure className="m-0 shrink-0 w-[min(540px,85vw)] snap-start p-6 bg-white">
              <div className="aspect-[16/10] bg-[#E4E0D8] flex items-center justify-center font-['IBM_Plex_Mono',monospace] text-xs text-[#7A5240] border border-[rgba(11,11,12,0.1)] p-4 text-center">
                Báo cáo &amp; Dòng thời gian bằng chứng
              </div>
              <figcaption className="pt-3 font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase text-[#4A463F]">
                04 / Báo cáo &amp; hồ sơ bằng chứng
              </figcaption>
            </figure>
          </div>

          {/* Two Comparison Modes: Web vs Desktop Strict */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Mode 1: Web */}
            <div className="p-8 sm:p-12 md:border-r border-[rgba(11,11,12,0.14)]">
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-bold tracking-wider uppercase text-[#7A3516]">
                Chế độ Web · Không cài đặt
              </div>
              <h3 className="mt-3 text-[27px] font-extrabold tracking-tight text-[#0B0B0C]">
                Thi trên trình duyệt
              </h3>
              <div className="mt-6 space-y-0 text-[15.5px]">
                <div className="flex gap-3 py-3 border-t border-[rgba(11,11,12,0.12)] text-[#24211D] font-normal">
                  <span className="text-[#A8380F] font-bold">✓</span> Mở bằng link trên mọi trình duyệt
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(11,11,12,0.12)] text-[#24211D] font-normal">
                  <span className="text-[#A8380F] font-bold">✓</span> AI nhận diện khuôn mặt qua webcam
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(11,11,12,0.12)] text-[#24211D] font-normal">
                  <span className="text-[#A8380F] font-bold">✓</span> Ghi nhận chuyển tab, thoát toàn màn hình
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(11,11,12,0.12)] text-[#6B6862] font-normal">
                  <span className="font-bold">✕</span> Không khóa được hệ điều hành
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(11,11,12,0.12)] text-[#6B6862] font-normal">
                  <span className="font-bold">✕</span> Không phát hiện phần mềm cấm / máy ảo
                </div>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center mt-7 px-6 py-3.5 border border-[rgba(11,11,12,0.3)] text-[#0B0B0C] text-[15px] font-bold hover:bg-[#0B0B0C] hover:text-[#F2EFE9] transition-colors"
              >
                Mở trang thi Web →
              </Link>
            </div>

            {/* Mode 2: Strict Desktop (Dark High Contrast Card) */}
            <div className="p-8 sm:p-12 bg-[#0B0B0C] text-[#F2EFE9]">
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-bold tracking-wider uppercase text-[#FF5D23]">
                Chế độ Strict · Khuyến nghị
              </div>
              <h3 className="mt-3 text-[27px] font-extrabold tracking-tight text-[#F2EFE9]">
                Thi qua app desktop
              </h3>
              <div className="mt-6 space-y-0 text-[15.5px]">
                <div className="flex gap-3 py-3 border-t border-[rgba(242,239,233,0.14)] text-[#E8E4DA] font-normal">
                  <span className="text-[#FF5D23] font-bold">✓</span> Lockdown khóa toàn bộ máy tính
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(242,239,233,0.14)] text-[#E8E4DA] font-normal">
                  <span className="text-[#FF5D23] font-bold">✓</span> Phát hiện phần mềm cấm, máy ảo, remote
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(242,239,233,0.14)] text-[#E8E4DA] font-normal">
                  <span className="text-[#FF5D23] font-bold">✓</span> Chặn phím tắt &amp; chia sẻ màn hình
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(242,239,233,0.14)] text-[#E8E4DA] font-normal">
                  <span className="text-[#FF5D23] font-bold">✓</span> Ghi hình liên tục + camera phụ QR
                </div>
                <div className="flex gap-3 py-3 border-t border-[rgba(242,239,233,0.14)] text-[#E8E4DA] font-normal">
                  <span className="text-[#FF5D23] font-bold">✓</span> Hồ sơ bằng chứng đầy đủ cho hội đồng
                </div>
              </div>
              <a
                href="#tai-app"
                className="inline-flex items-center mt-7 px-6 py-3.5 bg-[#FF5D23] text-[#0B0B0C] text-[15px] font-bold hover:bg-[#F2EFE9] transition-colors"
              >
                Tải app desktop →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: TẢI VỀ APP CLIENT (#tai-app)
      ========================================================================= */}
      <section id="tai-app" className="border-b border-[rgba(242,239,233,0.14)]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] max-w-[1440px] mx-auto">
          {/* Left spec info */}
          <div className="p-8 sm:p-14 lg:border-r border-[rgba(242,239,233,0.14)]">
            <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-bold tracking-wider uppercase text-[#FF5D23]">
              Tải về
            </div>
            <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-[-0.035em] max-w-[380px]">
              Foxy Exam Client
            </h2>
            <p className="mt-4 max-w-[380px] text-[16px] font-normal leading-relaxed text-[#D2CEC5]">
              Cài một lần, dùng cho mọi kỳ thi chế độ Strict. Nhẹ, tự cập nhật, không cần quyền admin.
            </p>
            <div className="mt-6 font-['IBM_Plex_Mono',monospace] text-[12px] font-medium leading-loose text-[#B5B1A8]">
              <div>PHIÊN BẢN &nbsp;1.4.2</div>
              <div>DUNG LƯỢNG &nbsp;86 MB (Tauri v2 + Rust)</div>
              <div>CẬP NHẬT &nbsp;09 / 2026</div>
            </div>
          </div>

          {/* Right Download Boxes */}
          <div>
            {/* Windows Box */}
            <div className="p-8 sm:p-10 border-b border-[rgba(242,239,233,0.14)] flex flex-wrap gap-5 items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-extrabold tracking-tight text-[#F2EFE9]">Windows</h3>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] tracking-wider px-2 py-1 bg-[#FF5D23] text-[#0B0B0C] font-bold">
                    CÓ SẴN
                  </span>
                </div>
                <p className="mt-2 text-[15px] font-normal leading-relaxed text-[#D8D4CA]">
                  Windows 10 &amp; 11 · 64-bit · Khóa phím tắt OS, chống máy ảo
                </p>
              </div>
              <a
                href="#lien-he"
                className="px-7 py-3.5 bg-[#FF5D23] text-[#0B0B0C] text-[15px] font-bold whitespace-nowrap hover:bg-[#F2EFE9] transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Tải .exe
              </a>
            </div>

            {/* macOS Box */}
            <div className="p-8 sm:p-10 border-b border-[rgba(242,239,233,0.14)] flex flex-wrap gap-5 items-center justify-between bg-[#121215]">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-extrabold tracking-tight text-[#A8A5A0]">macOS</h3>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] tracking-wider px-2 py-1 border border-[rgba(242,239,233,0.28)] text-[#D8D4CA] font-semibold">
                    SẮP RA MẮT
                  </span>
                </div>
                <p className="mt-2 text-[15px] font-normal leading-relaxed text-[#B5B1A8]">
                  Intel &amp; Apple Silicon · Dự kiến Q4/2026 · Hiện dùng chế độ Web
                </p>
              </div>
              <a
                href="#lien-he"
                className="px-7 py-3.5 border border-[rgba(242,239,233,0.28)] text-[#F2EFE9] text-[15px] font-semibold whitespace-nowrap hover:bg-[#F2EFE9]/10 transition-colors"
              >
                Nhận thông báo
              </a>
            </div>

            <div className="p-6 text-[14.5px] font-normal text-[#C2BEB4]">
              Cần bản cài theo phòng máy trường học (.msi) hoặc mã nguồn kiểm thử?{' '}
              <a href="#lien-he" className="text-[#FF5D23] font-bold underline underline-offset-4">
                Liên hệ đội ngũ Foxy Exam →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 04: BẢNG GIÁ SAAS (#gia) (KẾT NỐI PROPS DATABASE)
      ========================================================================= */}
      <section id="gia" className="border-b border-[rgba(242,239,233,0.14)]">
        <div className="max-w-[1440px] mx-auto">
          <div className="p-8 sm:p-14 border-b border-[rgba(242,239,233,0.14)] flex flex-wrap gap-6 items-end justify-between">
            <div>
              <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase text-[#FF5D23]">
                04 — Giá
              </div>
              <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-[-0.035em]">
                Trả theo quy mô kỳ thi
              </h2>
            </div>

            {/* Toggle Monthly / Yearly */}
            <div className="flex border border-[rgba(242,239,233,0.22)]">
              <button
                type="button"
                onClick={() => setIsYearly(false)}
                className={`px-5 py-3 font-['IBM_Plex_Mono',monospace] text-[12px] tracking-wider uppercase font-semibold transition-colors ${
                  !isYearly
                    ? 'bg-[#FF5D23] text-[#0B0B0C]'
                    : 'bg-transparent text-[#8E8B85] hover:text-[#F2EFE9]'
                }`}
              >
                Theo tháng
              </button>
              <button
                type="button"
                onClick={() => setIsYearly(true)}
                className={`px-5 py-3 font-['IBM_Plex_Mono',monospace] text-[12px] tracking-wider uppercase font-semibold transition-colors ${
                  isYearly
                    ? 'bg-[#FF5D23] text-[#0B0B0C]'
                    : 'bg-transparent text-[#B5B1A8] hover:text-[#F2EFE9]'
                }`}
              >
                Theo năm −17%
              </button>
            </div>
          </div>

          {/* Pricing 3 Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* Tier 01: Free / Trial */}
            <div className="p-8 sm:p-10 border-r border-b md:border-b-0 border-[rgba(242,239,233,0.14)] flex flex-col justify-between">
              <div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider uppercase text-[#B5B1A8]">
                  Gói 01 · Dùng thử
                </div>
                <div className="mt-5 text-5xl font-black tracking-[-0.04em] leading-none text-[#F2EFE9]">
                  0đ
                </div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[12px] font-medium text-[#C5C1B6] mt-2">
                  Miễn phí vĩnh viễn
                </div>
                <div className="mt-7 space-y-0 text-[15px]">
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> 1 kỳ thi, tối đa 30 thí sinh
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> Chế độ Web + AI khuôn mặt
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> Báo cáo cơ bản, lưu 7 ngày
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> Đầy đủ trình chấm mã nguồn cơ bản
                  </div>
                </div>
              </div>
              <Link
                href="/login"
                className="inline-flex mt-8 px-6 py-3.5 border border-[rgba(242,239,233,0.28)] text-[#F2EFE9] text-[15px] font-bold hover:bg-[#F2EFE9]/10 transition-colors justify-center text-center"
              >
                Bắt đầu miễn phí
              </Link>
            </div>

            {/* Tier 02: Pro (Center Light Contrast Highlighting) */}
            <div className="p-8 sm:p-10 border-r border-b md:border-b-0 border-[rgba(242,239,233,0.14)] bg-[#F2EFE9] text-[#0B0B0C] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-bold tracking-wider uppercase text-[#8B3A18]">
                    Gói 02 · Trường &amp; trung tâm
                  </div>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] tracking-wider px-2 py-1 bg-[#FF5D23] text-[#0B0B0C] font-bold">
                    PHỔ BIẾN
                  </span>
                </div>
                <div className="mt-5 text-5xl font-black tracking-[-0.04em] leading-none text-[#0B0B0C]">
                  {proPrice}
                </div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[12px] font-semibold text-[#38342F] mt-2">
                  {proPriceNote}
                </div>
                <div className="mt-7 space-y-0 text-[15px]">
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(11,11,12,0.14)] text-[#1C1A17] font-normal">
                    <span className="text-[#A8380F] font-bold">✓</span> 1.000 lượt thi mỗi tháng
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(11,11,12,0.14)] text-[#1C1A17] font-normal">
                    <span className="text-[#A8380F] font-bold">✓</span> App Lockdown + chống máy ảo &amp; remote
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(11,11,12,0.14)] text-[#1C1A17] font-normal">
                    <span className="text-[#A8380F] font-bold">✓</span> Camera phụ QR, ghi hình toàn kỳ thi
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(11,11,12,0.14)] text-[#1C1A17] font-normal">
                    <span className="text-[#A8380F] font-bold">✓</span> Hồ sơ bằng chứng, xuất PDF/CSV
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(11,11,12,0.14)] text-[#1C1A17] font-normal">
                    <span className="text-[#A8380F] font-bold">✓</span> Giám thị không giới hạn · Hỗ trợ kỹ thuật 24h
                  </div>
                </div>
              </div>
              <Link
                href="/login"
                className="inline-flex mt-8 px-6 py-3.5 bg-[#0B0B0C] text-[#F2EFE9] text-[15px] font-bold hover:bg-[#FF5D23] hover:text-[#0B0B0C] transition-colors justify-center text-center"
              >
                Dùng thử 14 ngày
              </Link>
            </div>

            {/* Tier 03: Enterprise */}
            <div className="p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider uppercase text-[#B5B1A8]">
                  Gói 03 · Đại học &amp; doanh nghiệp
                </div>
                <div className="mt-5 text-5xl font-black tracking-[-0.04em] leading-none text-[#F2EFE9]">
                  Liên hệ
                </div>
                <div className="font-['IBM_Plex_Mono',monospace] text-[12px] font-medium text-[#C5C1B6] mt-2">
                  Báo giá theo số lượt thi hoặc trường
                </div>
                <div className="mt-7 space-y-0 text-[15px]">
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> Không giới hạn lượt thi &amp; kỳ thi song song
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> SSO, tích hợp hệ thống LMS qua REST API
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> On-premise, dữ liệu máy chủ lưu tại Việt Nam
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> Giao diện tùy biến theo thương hiệu nhà trường
                  </div>
                  <div className="flex gap-3 py-2.5 border-t border-[rgba(242,239,233,0.12)] text-[#E2DFD6] font-normal">
                    <span className="text-[#FF5D23] font-bold">✓</span> Cam kết SLA &amp; kỹ sư trực thi riêng
                  </div>
                </div>
              </div>
              <a
                href="#lien-he"
                className="inline-flex mt-8 px-6 py-3.5 border border-[rgba(242,239,233,0.28)] text-[#F2EFE9] text-[15px] font-bold hover:bg-[#F2EFE9]/10 transition-colors justify-center text-center"
              >
                Nhận báo giá
              </a>
            </div>
          </div>

          <div className="p-5 sm:px-8 font-['IBM_Plex_Mono',monospace] text-[11.5px] font-medium tracking-wider uppercase text-[#B5B1A8] border-t border-[rgba(242,239,233,0.14)]">
            Giá chưa gồm VAT · Ưu đãi 30% cho trường công lập và tổ chức giáo dục phi lợi nhuận
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ SECTION (ACCORDION QUESTIONS)
      ========================================================================= */}
      <section className="border-b border-[rgba(242,239,233,0.14)]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] max-w-[1440px] mx-auto">
          {/* Left Title */}
          <div className="p-8 sm:p-14 lg:border-r border-[rgba(242,239,233,0.14)]">
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-[-0.035em] max-w-[360px]">
              Câu hỏi thường gặp
            </h2>
            <p className="mt-4 max-w-[340px] text-[16px] font-normal leading-relaxed text-[#D2CEC5]">
              Còn thắc mắc khác? Nhắn cho chúng tôi ở form bên dưới, đội ngũ phản hồi trong 24 giờ.
            </p>
          </div>

          {/* Right Accordions */}
          <div>
            <details className="group p-6 sm:p-8 border-b border-[rgba(242,239,233,0.14)] cursor-pointer">
              <summary className="text-[17.5px] font-bold flex items-center justify-between list-none">
                <span>Thí sinh có cần máy cấu hình cao?</span>
                <span className="font-mono text-[#FF5D23] transition-transform group-open:rotate-90">→</span>
              </summary>
              <p className="mt-3 text-[15.5px] font-normal leading-[1.65] text-[#D8D4CA]">
                Không. Máy tính chạy Windows 10 trở lên, 4GB RAM và một webcam thông thường là đủ. Toàn
                bộ quá trình xử lý AI nặng được tính toán song song trên máy chủ hoặc cụm GPU worker.
              </p>
            </details>

            <details className="group p-6 sm:p-8 border-b border-[rgba(242,239,233,0.14)] cursor-pointer">
              <summary className="text-[17.5px] font-bold flex items-center justify-between list-none">
                <span>Mất mạng giữa bài thi thì sao?</span>
                <span className="font-mono text-[#FF5D23] transition-transform group-open:rotate-90">→</span>
              </summary>
              <p className="mt-3 text-[15.5px] font-normal leading-[1.65] text-[#D8D4CA]">
                Câu trả lời và mã code được lưu trữ cục bộ có mã hóa và tự động đồng bộ lại khi kết nối
                mạng phục hồi. Khoảng thời gian mất kết nối được ghi chính xác vào nhật ký giám thị.
              </p>
            </details>

            <details className="group p-6 sm:p-8 border-b border-[rgba(242,239,233,0.14)] cursor-pointer">
              <summary className="text-[17.5px] font-bold flex items-center justify-between list-none">
                <span>Dữ liệu camera lưu ở đâu, bao lâu?</span>
                <span className="font-mono text-[#FF5D23] transition-transform group-open:rotate-90">→</span>
              </summary>
              <p className="mt-3 text-[15.5px] font-normal leading-[1.65] text-[#D8D4CA]">
                Hạ tầng lưu trữ đặt tại Việt Nam, dữ liệu được mã hóa cả khi truyền (TLS 1.3) và khi
                lưu. Mặc định hệ thống lưu 90 ngày phục vụ đối soát, sau đó tự hủy theo cấu hình nhà trường.
              </p>
            </details>

            <details className="group p-6 sm:p-8 border-b border-[rgba(242,239,233,0.14)] cursor-pointer">
              <summary className="text-[17.5px] font-bold flex items-center justify-between list-none">
                <span>AI có tự ý đánh trượt thí sinh?</span>
                <span className="font-mono text-[#FF5D23] transition-transform group-open:rotate-90">→</span>
              </summary>
              <p className="mt-3 text-[15.5px] font-normal leading-[1.65] text-[#D8D4CA]">
                Không. AI chỉ đóng vai trò trợ lý gắn cờ cảnh báo và tính điểm rủi ro vi phạm. Quyết định
                xử lý kỷ luật cuối cùng luôn thuộc về giám thị coi thi và hội đồng khảo thí.
              </p>
            </details>

            <details className="group p-6 sm:p-8 cursor-pointer">
              <summary className="text-[17.5px] font-bold flex items-center justify-between list-none">
                <span>Tích hợp được với hệ thống LMS của trường?</span>
                <span className="font-mono text-[#FF5D23] transition-transform group-open:rotate-90">→</span>
              </summary>
              <p className="mt-3 text-[15.5px] font-normal leading-[1.65] text-[#D8D4CA]">
                Có. Gói Enterprise cung cấp đầy đủ chuẩn REST API và SSO để đồng bộ danh sách lớp học,
                thí sinh, môn thi và trả kết quả điểm thi về hệ thống quản lý sẵn có của nhà trường.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION: BẮT ĐẦU / LIÊN HỆ (#lien-he) (SPLIT BRIGHT ORANGE & OBSIDIAN)
      ========================================================================= */}
      <section id="lien-he" className="grid grid-cols-1 lg:grid-cols-2 bg-[#FF5D23] text-[#0B0B0C]">
        {/* Left Orange Column */}
        <div className="p-8 sm:p-14 lg:p-18 max-w-[720px] ml-auto w-full">
          <div className="font-['IBM_Plex_Mono',monospace] text-[11.5px] tracking-wider uppercase font-bold text-[#0B0B0C]">
            Bắt đầu
          </div>
          <h2 className="mt-5 text-4xl sm:text-6xl font-black leading-[0.98] tracking-[-0.04em] max-w-[440px]">
            Chúng tôi dựng kỳ thi mẫu bằng đề của bạn.
          </h2>
          <p className="mt-5 max-w-[440px] text-[17px] font-normal leading-relaxed text-[#0B0B0C]">
            Để lại thông tin, trong 15 phút demo bạn sẽ thấy đúng kỳ thi của trường mình chạy hoàn hảo
            trên Foxy Exam.
          </p>

          <div className="mt-9 space-y-0 font-['IBM_Plex_Mono',monospace] text-[13.5px] font-medium">
            <div className="flex gap-4 py-3 border-t border-[#0B0B0C]/25">
              <span className="w-20 font-bold opacity-75">EMAIL</span> hello@foxyexam.vn
            </div>
            <div className="flex gap-4 py-3 border-t border-[#0B0B0C]/25">
              <span className="w-20 font-bold opacity-75">HOTLINE</span> 0900 000 000
            </div>
            <div className="flex gap-4 py-3 border-t border-b border-[#0B0B0C]/25">
              <span className="w-20 font-bold opacity-75">ĐỊA CHỈ</span> TP. Hồ Chí Minh · Hà Nội
            </div>
          </div>
        </div>

        {/* Right Obsidian Form Column */}
        <div className="p-8 sm:p-14 lg:p-18 bg-[#0B0B0C] text-[#F2EFE9] max-w-[720px] mr-auto w-full flex flex-col justify-center">
          {isSubmitted ? (
            <div className="py-12 space-y-3">
              <div className="text-2xl font-bold text-[#FF5D23] flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                Đã nhận thông tin của bạn.
              </div>
              <p className="text-[15.5px] font-normal leading-relaxed text-[#D8D4CA]">
                Đội ngũ chuyên viên giải pháp Foxy Exam sẽ liên hệ qua email <strong>{formEmail}</strong>{' '}
                trong vòng một ngày làm việc để gửi tài liệu và bố trí lịch demo.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-5">
              <label className="grid gap-2 font-['IBM_Plex_Mono',monospace] text-[11px] font-medium tracking-wider uppercase text-[#B5B1A8]">
                Họ và tên *
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="h-12 px-1 border-b border-[rgba(242,239,233,0.28)] bg-transparent text-[#F2EFE9] text-[16px] font-['Be_Vietnam_Pro',sans-serif] font-normal outline-none focus:border-[#FF5D23] transition-colors placeholder:text-[#66645E]"
                />
              </label>

              <label className="grid gap-2 font-['IBM_Plex_Mono',monospace] text-[11px] font-medium tracking-wider uppercase text-[#B5B1A8]">
                Email công việc *
                <input
                  type="email"
                  placeholder="ten@truong.edu.vn"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="h-12 px-1 border-b border-[rgba(242,239,233,0.28)] bg-transparent text-[#F2EFE9] text-[16px] font-['Be_Vietnam_Pro',sans-serif] font-normal outline-none focus:border-[#FF5D23] transition-colors placeholder:text-[#66645E]"
                />
              </label>

              <label className="grid gap-2 font-['IBM_Plex_Mono',monospace] text-[11px] font-medium tracking-wider uppercase text-[#B5B1A8]">
                Đơn vị / Trường học
                <input
                  type="text"
                  placeholder="Trường / Khoa CNTT / Doanh nghiệp"
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  className="h-12 px-1 border-b border-[rgba(242,239,233,0.28)] bg-transparent text-[#F2EFE9] text-[16px] font-['Be_Vietnam_Pro',sans-serif] font-normal outline-none focus:border-[#FF5D23] transition-colors placeholder:text-[#66645E]"
                />
              </label>

              <label className="grid gap-2 font-['IBM_Plex_Mono',monospace] text-[11px] font-medium tracking-wider uppercase text-[#B5B1A8]">
                Quy mô kỳ thi
                <input
                  type="text"
                  placeholder="Ví dụ: 600 thí sinh / học kỳ"
                  value={formScale}
                  onChange={(e) => setFormScale(e.target.value)}
                  className="h-12 px-1 border-b border-[rgba(242,239,233,0.28)] bg-transparent text-[#F2EFE9] text-[16px] font-['Be_Vietnam_Pro',sans-serif] font-normal outline-none focus:border-[#FF5D23] transition-colors placeholder:text-[#66645E]"
                />
              </label>

              <button
                type="submit"
                className="mt-3 py-4 px-6 bg-[#FF5D23] text-[#0B0B0C] text-[15.5px] font-bold font-['Be_Vietnam_Pro',sans-serif] hover:bg-[#F2EFE9] transition-colors cursor-pointer"
              >
                Gửi yêu cầu demo
              </button>

              <p className="font-['IBM_Plex_Mono',monospace] text-[11px] font-medium tracking-wide text-[#B5B1A8]">
                Thông tin chỉ dùng để liên hệ tư vấn giải pháp thi Foxy Exam.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* =========================================================================
          FOOTER (TECHNICAL METADATA & COPYRIGHT)
      ========================================================================= */}
      <footer className="border-t border-[rgba(242,239,233,0.14)] bg-[#0B0B0C]">
        <div className="grid grid-cols-1 sm:grid-cols-3 max-w-[1440px] mx-auto">
          {/* Col 1 */}
          <div className="p-8 sm:p-10 border-b sm:border-b-0 sm:border-r border-[rgba(242,239,233,0.14)]">
            <div className="flex items-center gap-3">
              <div className="w-[30px] h-[30px] bg-[#FF5D23] flex items-center justify-center font-bold text-[#0B0B0C] text-sm">
                🦊
              </div>
              <span className="text-[16px] font-bold tracking-tight">FOXY EXAM</span>
            </div>
            <p className="mt-4 max-w-[320px] text-[14px] font-normal leading-relaxed text-[#C5C1B6]">
              Nền tảng thi trực tuyến có giám sát AI, phát triển tại Việt Nam cho những kỳ thi cần
              tính toàn vẹn cao.
            </p>
          </div>

          {/* Col 2 */}
          <div className="p-8 sm:p-10 border-b sm:border-b-0 sm:border-r border-[rgba(242,239,233,0.14)] grid gap-2.5 text-[14px]">
            <div className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold tracking-wider uppercase text-[#B5B1A8]">
              Sản phẩm
            </div>
            <a href="#nang-luc" className="text-[#D8D4CA] font-normal hover:text-[#F2EFE9] transition-colors">
              Năng lực giám sát
            </a>
            <a href="#van-hanh" className="text-[#D8D4CA] font-normal hover:text-[#F2EFE9] transition-colors">
              Quy trình vận hành
            </a>
            <a href="#tai-app" className="text-[#D8D4CA] font-normal hover:text-[#F2EFE9] transition-colors">
              Tải ứng dụng FoxyClient
            </a>
            <a href="#gia" className="text-[#D8D4CA] font-normal hover:text-[#F2EFE9] transition-colors">
              Bảng giá dịch vụ
            </a>
          </div>

          {/* Col 3 */}
          <div className="p-8 sm:p-10 grid gap-2.5 text-[14px]">
            <div className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold tracking-wider uppercase text-[#B5B1A8]">
              Liên hệ
            </div>
            <a href="#lien-he" className="text-[#D8D4CA] font-normal hover:text-[#F2EFE9] transition-colors">
              Đặt lịch demo trực tuyến
            </a>
            <a href="#lien-he" className="text-[#D8D4CA] font-normal hover:text-[#F2EFE9] transition-colors">
              hello@foxyexam.vn
            </a>
            <Link href="/login" className="text-[#FF5D23] font-bold hover:underline">
              Cổng Giảng viên &amp; Admin →
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="p-5 sm:px-8 border-t border-[rgba(242,239,233,0.14)] max-w-[1440px] mx-auto flex flex-wrap gap-3.5 justify-between font-['IBM_Plex_Mono',monospace] text-[11px] font-medium tracking-wider text-[#B5B1A8]">
          <span>© 2026 FOXY EXAM · ĐỒ ÁN KHÓA LUẬN TỐT NGHIỆP · BẢN DEMO HỌC THUẬT, CHƯA THƯƠNG MẠI</span>
          <span>MADE IN VIETNAM</span>
        </div>
      </footer>
    </div>
  );
}
