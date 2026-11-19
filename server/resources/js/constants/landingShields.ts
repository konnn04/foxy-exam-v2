import { Lock, Cpu, QrCode, FileCheck } from 'lucide-react';

export const shieldsVi = [
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

export const shieldsEn = [
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
