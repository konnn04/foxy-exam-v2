import React from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
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
} from 'lucide-react';

export default function Features() {
  const deepFeatures = [
    {
      badge: 'Tầng 1 · Hệ điều hành',
      title: 'Khóa Kiosk OS-Level (Chặn Phím Tắt & Sandbox)',
      icon: Lock,
      color: 'blue',
      desc: 'Sử dụng Windows Low-Level Hook (SetWindowsHookEx) và cơ chế khóa tiến trình cấp Kernel-user boundary, vô hiệu hóa hoàn toàn các hành vi gian lận trên máy tính thí sinh.',
      highlights: [
        'Chặn phím tắt hệ thống: Alt+Tab, Win Key, Ctrl+Esc, Alt+F4, PrtScn.',
        'Ngăn chặn chạy trong máy ảo (VMware, VirtualBox, Sandboxie, Hyper-V).',
        'Phát hiện và khóa chế độ đa màn hình (Dual-monitor / HDMI capture card).',
        'Cấm phần mềm điều khiển từ xa: TeamViewer, UltraViewer, AnyDesk, Chrome Remote.',
      ],
      spec: 'Thời gian phản ứng: < 50ms | Mức tiêu tốn RAM: ~45MB',
    },
    {
      badge: 'Tầng 2 · Trí tuệ nhân tạo biên',
      title: 'Edge AI Hai Tầng (Inference Trực Tiếp Trên CPU)',
      icon: Cpu,
      color: 'emerald',
      desc: 'Mô hình Computer Vision được tối ưu lượng tử hóa (Quantized INT8) chạy hoàn toàn trên CPU của thí sinh thông qua ONNX Runtime, không phụ thuộc máy chủ GPU đắt đỏ.',
      highlights: [
        'Theo dõi hướng nhìn (Gaze Tracking) và góc nghiêng đầu (Head Pose 3D).',
        'Phát hiện vắng mặt hoặc xuất hiện từ 2 khuôn mặt trở lên trong khung hình.',
        'Nhận diện vật thể cấm: Điện thoại di động, tai nghe Bluetooth, tài liệu in.',
        'Cảnh báo tức thì lên màn hình thí sinh và đồng bộ về máy giám thị.',
      ],
      spec: 'Tốc độ: 10 - 15 FPS | CPU tiêu hao: 4 - 8% (Core i3 thế hệ 8 trở lên)',
    },
    {
      badge: 'Tầng 3 · Đa góc nhìn',
      title: 'Camera Phụ 360° Ghép Đôi Siêu Tốc Bằng QR',
      icon: Smartphone,
      color: 'indigo',
      desc: 'Biến điện thoại của thí sinh thành camera giám sát góc nghiêng 45° bao quát bàn tay, màn hình laptop và không gian xung quanh mà không cần cài đặt thêm app native.',
      highlights: [
        'Ghép đôi bằng mã QR mã hóa token một lần (One-time secure token).',
        'Luồng video WebRTC SFU sub-second với độ trễ siêu thấp (≤ 1.4 giây).',
        'Tự động hướng dẫn kiểm tra góc đặt điện thoại đạt chuẩn (Pre-check).',
        'Báo động ngay lập tức nếu điện thoại bị tắt màn hình, xoay góc hoặc mất kết nối.',
      ],
      spec: 'Giao thức: WebRTC / WSS | Băng thông: ~250 Kbps / luồng video',
    },
    {
      badge: 'Tầng 4 · Bằng chứng số',
      title: 'Hồ Sơ Vi phạm & Chuỗi Băm Toàn Vẹn SHA-256',
      icon: FileCheck2,
      color: 'amber',
      desc: 'Mọi thời điểm nghi vấn đều được hệ thống chụp lại bằng chứng kèm chuỗi mã băm SHA-256 đối soát, loại bỏ hoàn toàn tranh cãi giữa thí sinh và hội đồng khảo thí.',
      highlights: [
        'Cắt video tự động trước và sau thời điểm vi phạm (±10 giây buffer).',
        'Đồng bộ thời gian chính xác giữa Camera chính, Camera phụ và Màn hình.',
        'Xuất bản liên kết tra cứu biên bản trực tuyến có mật mã hoặc hết hạn.',
        'Hội đồng chấm thi có thể tải báo cáo PDF kèm chữ ký điện tử xác thực.',
      ],
      spec: 'Định dạng: MP4 H.264 + Báo cáo Audit Trail chuẩn giáo dục',
    },
    {
      badge: 'Đặc tính bổ sung',
      title: 'Bộ Đệm Ngoại Tuyến (Offline Buffer & Anti-Tamper)',
      icon: WifiOff,
      color: 'rose',
      desc: 'Nếu mạng Internet của thí sinh chập chờn hoặc rớt kết nối đột ngột, bài thi và dữ liệu giám sát vẫn được bảo toàn trong vùng nhớ đệm mã hóa AES-256.',
      highlights: [
        'Tự động lưu trữ cục bộ các thao tác gõ và hình ảnh giám sát tạm thời.',
        'Tự động truyền bù lên server ngay khi kết nối Internet phục hồi.',
        'Bắt buộc thí sinh phải trải qua quy trình Pre-check lại trước khi tái nhập phòng.',
        'Phát hiện gian lận cố tình ngắt mạng để tra cứu tài liệu.',
      ],
      spec: 'Dung lượng đệm: Tối đa 60 phút offline | Khóa AES-256 cục bộ',
    },
    {
      badge: 'Giám sát điều hành',
      title: 'Bảng Điều Khiển Giám Thị Thời Gian Thực & Can Thiệp Từ Xa',
      icon: Eye,
      color: 'purple',
      desc: 'Giao diện trực quan cho phép 1 giám thị theo dõi đồng thời 50-100 thí sinh với bộ lọc thông minh tự động đẩy thí sinh có nguy cơ cao lên đầu danh sách.',
      highlights: [
        'Ma trận video đa khung hình tự điều chỉnh độ phân giải theo băng thông.',
        'Cảnh báo bằng âm thanh và bảng thông báo sự kiện (Event stream) tức thì.',
        'Tính năng can thiệp từ xa: Gửi nhắc nhở riêng, đình chỉ thi hoặc ép nộp bài.',
        'Lập biên bản vi phạm điện tử chỉ với 1 cú click chuột.',
      ],
      spec: 'Độ trễ tín hiệu: ≤ 1.4s | Hỗ trợ: Desktop, Tablet cho giám thị',
    },
  ];

  return (
    <PublicLayout>
      <Head title="Tính Năng Chuyên Sâu - Exam Guard" />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.08),rgba(255,255,255,0))]" />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <Layers className="w-3.5 h-3.5" />
            Kiến Trúc Kỹ Thuật Đề Án STEM 2026
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Tính Năng Giám Sát Chuyên Sâu & Công Nghệ
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            Exam Guard kết hợp giữa công nghệ khóa hệ điều hành (Low-level OS Kiosk) và mô hình AI biên (Edge AI On-device) nhằm mang lại sự công bằng tuyệt đối mà không gây gánh nặng hạ tầng.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
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
                      <span className="text-[11.5px] font-bold tracking-wider text-blue-600 uppercase bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                        {feat.badge}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2.5 group-hover:text-blue-600 transition-colors">
                      {feat.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                      {feat.desc}
                    </p>

                    <div className="space-y-2.5 mb-6">
                      {feat.highlights.map((item, hIdx) => (
                        <div key={hIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs text-slate-500 font-mono">
                    <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Thông số kỹ thuật:
                    </span>
                    <span className="truncate ml-2 text-right">{feat.spec}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture Overview Diagram */}
      <section className="py-14 sm:py-16 bg-slate-900 text-white border-y border-slate-800">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
              Luồng Dữ Liệu Bảo Mật Toàn Trình (End-to-End Pipeline)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Kiến trúc phân tán giảm 85% tải máy chủ trung tâm bằng cách xử lý thị giác máy tính ngay tại thiết bị thí sinh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <h3 className="font-bold text-white text-base">Máy Thí Sinh (Client)</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Ứng dụng Kiosk chặn hệ điều hành. Mô hình AI ONNX Runtime phân tích hình ảnh từ Webcam và micro liên tục. Chỉ gửi metadata cảnh báo và khung hình vi phạm lên máy chủ.
                </p>
              </div>
              <div className="text-[11px] font-mono text-blue-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700">
                Tauri / Rust + ONNX Runtime (CPU)
              </div>
            </div>

            <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h3 className="font-bold text-white text-base">Camera Điện Thoại Phụ</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Thí sinh quét QR từ trình duyệt Safari/Chrome. Kết nối WebRTC trực tiếp tới cổng SFU, truyền luồng video giám sát góc nghiêng và báo trạng thái pin/màn hình.
                </p>
              </div>
              <div className="text-[11px] font-mono text-indigo-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700">
                WebRTC P2P / SFU Media Server
              </div>
            </div>

            <div className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <h3 className="font-bold text-white text-base">Cổng Giám Thị & Khảo Thí</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Giám thị quan sát toàn bộ phòng thi qua bảng điều khiển thời gian thực. Tự động tổng hợp hồ sơ vi phạm, đối soát mã SHA-256 và lưu trữ biên bản bảo đảm pháp lý.
                </p>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700">
                Laravel 11 + Inertia.js + Redis
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="py-14 bg-white text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
            Sẵn sàng nâng cao tính minh bạch cho kỳ thi của bạn?
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Trải nghiệm trực tiếp công nghệ Exam Guard với tài khoản thử nghiệm dành riêng cho giảng viên và nhà trường.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20"
            >
              Xem biểu phí & Báo giá
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/download"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-colors border border-slate-300"
            >
              Tải ứng dụng Windows
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
