import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import PageHero from '@/components/public/PageHero';
import { useLanguage } from '@/contexts/LanguageContext';
import { CtaBand, Mockup, type MockKind } from '@/components/public/blocks';

// default screenshot per feature card; each can be replaced by media.feature.N in the site settings
const FEATURE_SHOTS: MockKind[] = ['kiosk', 'dashboard', 'phone', 'report', 'kiosk', 'operator'];
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
      <PageHero icon={Layers} eyebrow={t.features.badge} title={t.features.heroTitle} desc={t.features.heroDesc} />

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
                    <Mockup kind={FEATURE_SHOTS[idx] ?? 'operator'} srcKey={`media.feature.${idx + 1}`} caption={false} className="mb-6" />
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

      <CtaBand
        title={t.features.ctaTitle}
        desc={t.features.ctaDesc}
        primary={{ label: t.features.pricingBtn, href: '/pricing' }}
        secondary={{ label: t.features.downloadBtn, href: '/download' }}
      />
    </PublicLayout>
  );
}
