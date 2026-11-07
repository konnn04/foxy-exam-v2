import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Shield,
  Cpu,
  Smartphone,
  Eye,
  WifiOff,
  FileCheck2,
  Lock,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Zap,
  Terminal,
  Laptop,
} from 'lucide-react';

export default function Features() {
  const { lang, t } = useLanguage();
  const [kioskImgError, setKioskImgError] = useState(false);
  const [camImgError, setCamImgError] = useState(false);

  const deepFeaturesVi = [
    {
      badge: 'BẢO VỆ MÁY TÍNH',
      title: 'Khóa màn hình và môi trường thi',
      icon: Lock,
      desc: 'Ứng dụng tự động khóa máy tính thí sinh ngay khi bắt đầu làm bài. Vô hiệu hóa toàn bộ **phím tắt hệ thống**, ngăn mở tab trình duyệt mới, phát hiện **máy ảo** và chặn đứng các công cụ **chia sẻ màn hình hoặc điều khiển từ xa**.',
      highlights: [
        'Vô hiệu hóa Alt+Tab, Windows, Task Manager và phím chụp màn hình',
        'Tự động nhận diện và chặn máy ảo hoặc màn hình phụ kết nối ngoài',
        'Chặn hoàn toàn TeamViewer, UltraViewer, AnyDesk và Chrome Remote',
      ],
      benefit: 'Ngăn chặn 100% việc mở tài liệu hoặc nhờ người khác điều khiển máy từ xa.',
    },
    {
      badge: 'TRÍ TUỆ NHÂN TẠO',
      title: 'Trí tuệ nhân tạo giám sát tự động',
      icon: Cpu,
      desc: 'Mô hình thị giác máy tính được tối ưu hóa để chạy trực tiếp trên **CPU máy tính của thí sinh**. Hệ thống tự động phân tích hướng mắt, phát hiện **người lạ trợ giúp** hoặc nhận diện **vật dụng cấm** như điện thoại, tai nghe giấu kín.',
      highlights: [
        'Nhận diện khuôn mặt và cảnh báo ngay khi thí sinh rời mắt khỏi bài thi',
        'Báo động lập tức khi có người thứ hai xuất hiện trong khung hình',
        'Phát hiện đồ vật nghi vấn: Điện thoại di động, tài liệu in, tai nghe Bluetooth',
      ],
      benefit: 'Nhà trường không cần đầu tư máy chủ GPU đắt tiền, tiết kiệm tối đa ngân sách.',
    },
    {
      badge: 'CAMERA PHỤ',
      title: 'Camera phụ toàn cảnh bàn thi',
      icon: Smartphone,
      desc: 'Thí sinh chỉ cần dùng điện thoại cá nhân **quét mã QR** để kích hoạt góc quay thứ hai bao quát toàn cảnh bàn thi, bàn phím và màn hình máy tính mà **không cần cài đặt thêm phần mềm**.',
      highlights: [
        'Thao tác kết nối đơn giản chỉ trong 10 giây qua trình duyệt web trên điện thoại',
        'Độ trễ truyền hình ảnh cực thấp, giám thị theo dõi mượt mà như xem trực tiếp',
        'Hệ thống tự động nhắc nhở và báo động nếu góc máy bị xê dịch hoặc điện thoại tắt',
      ],
      benefit: 'Xóa bỏ hoàn toàn điểm mù góc quay dưới bàn tay mà webcam laptop không thấy được.',
    },
    {
      badge: 'ĐỐI SOÁT MINH BẠCH',
      title: 'Bằng chứng vi phạm minh bạch',
      icon: FileCheck2,
      desc: 'Mỗi khi có dấu hiệu bất thường, hệ thống tự động ghi lại đoạn **video ngắn và ảnh chụp sắc nét** đồng bộ từ cả 3 góc quan sát. Dữ liệu được gán **mã băm toàn vẹn** để phục vụ hội đồng khảo thí khi có khiếu nại.',
      highlights: [
        'Tự động ghi hình trước và sau thời điểm nghi vấn để làm rõ bối cảnh',
        'Đồng bộ chính xác mốc thời gian giữa camera trước, camera phụ và màn hình',
        'Hỗ trợ xuất bản liên kết biên bản trực tuyến an toàn hoặc xuất tệp hồ sơ lưu trữ',
      ],
      benefit: 'Có đầy đủ căn cứ xác thực, loại bỏ tranh cãi giữa thí sinh và hội đồng coi thi.',
    },
    {
      badge: 'BẢO TOÀN DỮ LIỆU',
      title: 'Bảo toàn bài thi khi mất mạng',
      icon: WifiOff,
      desc: 'Nếu mạng Internet của thí sinh bị chập chờn hoặc ngắt kết nối đột ngột, toàn bộ bài làm và dữ liệu giám sát sẽ được **mã hóa an toàn và lưu vào bộ đệm máy**. Ngay khi có mạng trở lại, hệ thống sẽ tự động đồng bộ bù.',
      highlights: [
        'Bài làm không bị mất một câu chữ nào kể cả khi rớt mạng đột ngột',
        'Thí sinh bắt buộc phải xác thực lại camera trước khi được phép tiếp tục làm bài',
        'Cơ chế thông minh phân biệt rõ mất mạng thật và hành vi cố tình rút dây mạng',
      ],
      benefit: 'Đảm bảo kỳ thi diễn ra thông suốt, không gián đoạn tâm lý làm bài của thí sinh.',
    },
    {
      badge: 'BẢNG ĐIỀU KHIỂN',
      title: 'Bảng điều khiển giám sát trực tiếp',
      icon: Eye,
      desc: 'Giao diện trực quan được thiết kế để một cán bộ khảo thí có thể **theo dõi đồng thời từ 50 đến 100 thí sinh**. Trí tuệ nhân tạo tự động đẩy các thí sinh có nguy cơ cao lên đầu màn hình để giám thị tập trung xử lý.',
      highlights: [
        'Hiển thị trực quan toàn bộ phòng thi với cảnh báo màu sắc rõ ràng',
        'Cung cấp công cụ can thiệp từ xa: Nhắc nhở riêng, cảnh cáo hoặc đình chỉ thi',
        'Lập biên bản kỷ luật điện tử ngay trên hệ thống chỉ với một cú nhấp chuột',
      ],
      benefit: 'Giảm 80% số lượng cán bộ cần huy động cho một hội đồng thi trực tuyến.',
    },
  ];

  const deepFeaturesEn = [
    {
      badge: 'DESKTOP LOCKDOWN',
      title: 'Computer lockdown & secure kiosk',
      icon: Lock,
      desc: 'The app automatically locks the candidate workstation upon test launch. It disables all **system hotkeys**, prevents new browser tabs, detects **virtual machines**, and completely blocks **screen sharing or remote control tools**.',
      highlights: [
        'Disable Alt+Tab, Windows Key, Task Manager, and screenshot shortcuts',
        'Autodetect and block virtual machines or external secondary monitors',
        'Completely block TeamViewer, UltraViewer, AnyDesk, and Chrome Remote',
      ],
      benefit: 'Prevents 100% of unauthorized notes access or remote proxy test-taking.',
    },
    {
      badge: 'ON-DEVICE AI',
      title: 'Autonomous artificial intelligence proctoring',
      icon: Cpu,
      desc: 'Optimized computer vision models run directly on the **candidate laptop CPU**. The system tracks gaze direction, detects **unauthorized helpers**, and identifies **prohibited items** like cell phones or hidden earphones.',
      highlights: [
        'Continuous facial verification and immediate gaze-aversion alerts',
        'Instant alarm if a second face appears in the camera frame',
        'Anomaly detection: Smartphones, printed study sheets, Bluetooth buds',
      ],
      benefit: 'Institutions do not need expensive GPU servers, maximizing cost savings.',
    },
    {
      badge: 'SECONDARY CAMERA',
      title: '360° secondary smartphone camera',
      icon: Smartphone,
      desc: 'Students simply **scan a QR code** with their personal smartphone to activate an angled secondary camera covering the desk, keyboard, and screen **without installing any app**.',
      highlights: [
        'Frictionless 10-second setup directly via the smartphone web browser',
        'Sub-second live video latency via WebRTC SFU for smooth proctor view',
        'Automated alerts if the smartphone is moved, covered, or powered off',
      ],
      benefit: 'Completely eliminates blind spots beneath hands that laptops cannot capture.',
    },
    {
      badge: 'TAMPER-PROOF AUDIT',
      title: 'Transparent violation evidence & SHA-256',
      icon: FileCheck2,
      desc: 'Whenever an anomaly is flagged, the system captures **synced video clips and crisp snapshots** across all 3 angles. Data is sealed with a **cryptographic hash** to support the academic disciplinary board.',
      highlights: [
        'Auto-records pre/post buffer frames around incidents for full context',
        'Exact millisecond synchronization between webcam, phone cam, and screen',
        'Generates secure shareable online audit links and verifiable PDF reports',
      ],
      benefit: 'Irrefutable digital proof, eliminating disputes between students and proctors.',
    },
    {
      badge: 'DATA RESILIENCE',
      title: 'Offline buffer & network recovery',
      icon: WifiOff,
      desc: 'If candidate Internet fluctuates or drops, all answers and audit telemetry are **locally encrypted and safely buffered**. Once the connection is re-established, the app auto-resyncs seamlessly.',
      highlights: [
        'Zero answer loss during unexpected local network disruptions',
        'Candidate must re-authenticate camera precheck before resuming test',
        'Smart heuristics distinguish genuine network loss from intentional unplugging',
      ],
      benefit: 'Ensures test integrity without stressing students over transient network drops.',
    },
    {
      badge: 'PROCTOR DASHBOARD',
      title: 'Realtime proctoring console & remote triage',
      icon: Eye,
      desc: 'An intuitive command center engineered for a single proctor to **supervise 50 to 100 students simultaneously**. Artificial intelligence bubbles up high-risk anomalies to the top for swift intervention.',
      highlights: [
        'Live room grid visualization with high-contrast color-coded alerts',
        'Remote intervention tools: Private audio ping, written warning, or termination',
        'One-click electronic incident report drafting straight from the dashboard',
      ],
      benefit: 'Reduces required proctoring staff by 80% for large-scale online cohorts.',
    },
  ];

  const deepFeatures = lang === 'vi' ? deepFeaturesVi : deepFeaturesEn;

  return (
    <PublicLayout>
      <Head title={t.features.metaTitle} />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.08),rgba(255,255,255,0))]" />
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <Layers className="w-3.5 h-3.5" />
            {t.features.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.features.heroTitle}
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            {t.features.heroDesc}
          </p>
        </div>
      </section>

      {/* Grid 6 tính năng chính */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {deepFeatures.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group hover:border-blue-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                        {feat.badge}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2.5 group-hover:text-blue-600 transition-colors">
                      {feat.title}
                    </h2>

                    {/* Nội dung mô tả có in đậm từ khóa */}
                    <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                      {feat.desc.split('**').map((chunk, cIdx) =>
                        cIdx % 2 === 1 ? (
                          <strong key={cIdx} className="text-slate-900 font-semibold">
                            {chunk}
                          </strong>
                        ) : (
                          chunk
                        )
                      )}
                    </div>

                    <div className="space-y-2.5 mb-6">
                      {feat.highlights.map((item, hIdx) => (
                        <div key={hIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Phần giá trị thiết thực */}
                  <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-blue-700 bg-blue-50/50 p-3 rounded-xl border border-blue-100/80">
                    <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-medium">{feat.benefit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          MOCKUP MINH HỌA TRỰC QUAN GIAO DIỆN ỨNG DỤNG
      ========================================================================= */}
      <section className="py-14 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2.5 py-1 rounded-md">
              {t.features.mockupSectionBadge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 mb-3">
              {t.features.mockupSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {t.features.mockupSectionDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Mockup 1: Ứng dụng thí sinh */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-xs font-semibold text-slate-700 ml-1.5">
                    {t.features.candidateScreenTitle}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {t.features.candidateScreenBadge}
                </span>
              </div>

              <div className="p-5 flex-1 flex items-center justify-center bg-slate-900/5 min-h-[220px]">
                {!kioskImgError ? (
                  <img
                    src="/images/mockups/kiosk-candidate.png"
                    alt={t.features.candidateScreenTitle}
                    className="w-full h-auto rounded-lg shadow-sm"
                    onError={() => setKioskImgError(true)}
                  />
                ) : null}

                {kioskImgError && (
                  <div className="text-center p-6 space-y-2">
                    <Laptop className="w-10 h-10 text-slate-400 mx-auto" />
                    <div className="text-xs font-semibold text-slate-700">
                      {lang === 'vi' ? 'Giao diện làm bài toàn màn hình' : 'Fullscreen Candidate Exam Interface'}
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      {lang === 'vi'
                        ? 'Tự động ẩn mọi thanh công cụ Windows, chỉ hiển thị đề thi và khung hình camera đối soát góc phải màn hình.'
                        : 'Automatically suppresses Windows taskbar, presenting only the secure exam view and corner biometric camera.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
                {t.features.candidateScreenDesc}
              </div>
            </div>

            {/* Mockup 2: Giao diện giám thị */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-xs font-semibold text-slate-700 ml-1.5">
                    {t.features.mobileCamTitle}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {t.features.mobileCamBadge}
                </span>
              </div>

              <div className="p-5 flex-1 flex items-center justify-center bg-slate-900/5 min-h-[220px]">
                {!camImgError ? (
                  <img
                    src="/images/mockups/operator-view.png"
                    alt={t.features.mobileCamTitle}
                    className="w-full h-auto rounded-lg shadow-sm"
                    onError={() => setCamImgError(true)}
                  />
                ) : null}

                {camImgError && (
                  <div className="text-center p-6 space-y-2">
                    <Smartphone className="w-10 h-10 text-slate-400 mx-auto" />
                    <div className="text-xs font-semibold text-slate-700">
                      {lang === 'vi' ? 'Giao diện giám sát trực tiếp' : 'Realtime Proctoring Interface'}
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs">
                      {lang === 'vi'
                        ? 'Giám thị có thể theo dõi đồng thời nhiều thí sinh, nhận cảnh báo tự động khi phát hiện hành vi đáng ngờ và can thiệp từ xa.'
                        : 'Proctors supervise multiple candidates concurrently, receiving automated alerts with instant remote intervention.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-600">
                {t.features.mobileCamDesc}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="py-14 bg-white text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
            {t.features.ctaTitle}
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            {t.features.ctaDesc}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20"
            >
              {t.features.pricingBtn}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/download"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-colors border border-slate-300"
            >
              {t.features.downloadBtn}
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
