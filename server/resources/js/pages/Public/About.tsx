import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import {
  GraduationCap,
  Users,
  ShieldCheck,
  Award,
  ChevronDown,
  Mail,
  MapPin,
  ExternalLink,
  Target,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export default function About() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const teamMembers = [
    {
      name: 'Nguyễn Thành Luân',
      role: 'Trưởng nhóm & Kiến trúc sư hệ thống',
      desc: 'Phụ trách tổng thể kiến trúc phần mềm, cơ chế khóa Kiosk OS-level và thiết kế giao thức bảo mật.',
      badge: 'Architecture',
    },
    {
      name: 'Trần Minh Quân',
      role: 'Kỹ sư AI & Thị giác máy tính',
      desc: 'Nghiên cứu và lượng tử hóa mô hình Computer Vision (MediaPipe, YOLO) tối ưu hóa cho Edge CPU.',
      badge: 'Edge AI',
    },
    {
      name: 'Lê Hoàng Khang',
      role: 'Kỹ sư Kiosk Client (Tauri / Rust)',
      desc: 'Phát triển tầng Windows hook native, chống quay màn hình lén và phát hiện can thiệp tiến trình.',
      badge: 'Native Systems',
    },
    {
      name: 'Phạm Thu Thảo',
      role: 'Kỹ sư WebRTC & Hạ tầng thời gian thực',
      desc: 'Thiết kế kênh truyền luồng video SFU sub-second, bộ đệm ngoại tuyến và cơ chế đối soát SHA-256.',
      badge: 'Realtime Backend',
    },
    {
      name: 'Đỗ Quốc Bảo',
      role: 'Kỹ sư UI/UX & Khảo sát khảo thí',
      desc: 'Nghiên cứu trải nghiệm người dùng phòng thi, quy chuẩn khả dụng và khảo sát thực nghiệm tại các trường.',
      badge: 'Product & QA',
    },
  ];

  const faqs = [
    {
      q: 'Máy tính của sinh viên cấu hình yếu (Core i3, RAM 4GB) có chạy nổi không?',
      a: 'Hoàn toàn mượt mà. Exam Guard được biên dịch bằng Tauri/Rust siêu nhẹ (bộ nhớ tiêu thụ < 150MB). Toàn bộ mô hình thị giác AI được lượng tử hóa INT8 chạy đa luồng trên CPU với mức tải chỉ 5-8%, không cần máy tính có card đồ họa rời GPU.',
    },
    {
      q: 'Nếu đang thi mà mạng Internet của sinh viên bị rớt thì bài làm có bị mất không?',
      a: 'Không hề bị mất. Ứng dụng tích hợp bộ đệm ngoại tuyến (Offline Ring Buffer). Toàn bộ thao tác làm bài và trạng thái giám sát được mã hóa cục bộ AES-256. Khi có mạng trở lại, hệ thống tự động đồng bộ bù. Sinh viên phải thực hiện lại bước Pre-check góc máy để tiếp tục thi.',
    },
    {
      q: 'Camera điện thoại phụ có tự ý ghi hình ngoài giờ thi làm ảnh hưởng quyền riêng tư không?',
      a: 'Tuyệt đối không. Luồng giám sát điện thoại hoạt động trực tiếp qua nền tảng WebRTC trên trình duyệt web, không bắt buộc cài ứng dụng có quyền ngầm. Kênh truyền chỉ mở khi thí sinh quét mã QR bắt đầu làm bài và bị hủy hoàn toàn ngay khi nhấn Nộp bài.',
    },
    {
      q: 'Nhà trường có phải đầu tư dàn máy chủ GPU đắt tiền để triển khai không?',
      a: 'Không cần. Khác với các giải pháp AI truyền thống đẩy hàng nghìn luồng video về trung tâm để xử lý gây quá tải và chi phí GPU đắt đỏ, Exam Guard phân tán toàn bộ gánh nặng AI xuống máy thí sinh. Máy chủ trung tâm của trường chỉ cần cấu hình web server cơ bản để nhận metadata và quản lý phòng thi.',
    },
    {
      q: 'Hệ thống có phát hiện được tai nghe siêu nhỏ hoặc màn hình thứ hai không?',
      a: 'Có. Cơ chế Kiosk quét định kỳ các thiết bị ngoại vi và cổng xuất hình ảnh (Display Ports/HDMI). Màn hình thứ hai hoặc thiết bị capture card sẽ bị vô hiệu hóa ngay lập tức. Đồng thời, mô hình Edge AI phân tích liên tục góc nghiêng vùng tai thí sinh để cảnh báo các cử chỉ đáng ngờ.',
    },
    {
      q: 'Bằng chứng vi phạm được lưu trữ thế nào để không bị thí sinh khiếu nại?',
      a: 'Mỗi bằng chứng vi phạm bao gồm 1 chuỗi ảnh chụp độ nét cao, video cắt ±10 giây xung quanh sự kiện cùng thời điểm chính xác theo đồng hồ máy chủ. Mỗi tệp bằng chứng được sinh mã băm SHA-256 đối soát toàn vẹn, bảo đảm tính pháp lý tuyệt đối trước hội đồng kỷ luật.',
    },
  ];

  return (
    <PublicLayout>
      <Head title="Về Chúng Tôi & Đội Ngũ Nghiên Cứu - Exam Guard" />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <GraduationCap className="w-3.5 h-3.5" />
            Trường Đại Học Mở TP. Hồ Chí Minh
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Đề Án Nghiên Cứu & Khởi Nghiệp Sinh Viên STEM 2026
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            Exam Guard được nghiên cứu và phát triển bởi nhóm sinh viên Khoa Công nghệ Thông tin - Trường Đại học Mở TP. Hồ Chí Minh, với định hướng ứng dụng Trí tuệ Nhân tạo Biên để giải quyết bài toán liêm chính học thuật trong chuyển đổi số giáo dục.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                Sứ Mệnh Của Dự Án
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 mb-4">
                Bảo Đảm Tính Công Bằng & Liêm Chính Cho Nền Giáo Dục Số
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Trong xu thế chuyển dịch sang giảng dạy kết hợp (Blended Learning) và đào tạo từ xa, việc tổ chức thi cử trực tuyến thường vấp phải rào cản lớn nhất: sự nghi ngại về tính trung thực của thí sinh.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                Mục tiêu của chúng tôi là cung cấp một giải pháp công nghệ đạt chuẩn quốc tế nhưng có mức chi phí phù hợp hoàn toàn với điều kiện kinh tế của các trường đại học tại Việt Nam, không đòi hỏi sinh viên phải sở hữu thiết bị đắt tiền.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl font-black text-blue-600 mb-1">100%</div>
                  <div className="text-xs font-semibold text-slate-700">Công nghệ tự chủ</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Không phụ thuộc API ngoại</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl font-black text-emerald-600 mb-1">0 VNĐ</div>
                  <div className="text-xs font-semibold text-slate-700">Chi phí phần cứng máy chủ GPU</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Xử lý hoàn toàn tại biên</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white">
                  OU
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    Trường Đại Học Mở TP. Hồ Chí Minh
                  </h3>
                  <div className="text-xs text-slate-400">Khoa Công nghệ Thông tin</div>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Target className="w-4 h-4 text-blue-400 shrink-0 mt-1" />
                  <div>
                    <strong className="text-white">Định hướng nghiên cứu:</strong> Hệ thống nhúng giám sát thi cử phân tán, tối ưu hóa mô hình học sâu cho vi xử lý thông thường.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                  <div>
                    <strong className="text-white">Sân chơi học thuật:</strong> Dự án tham gia vòng chung kết Đề án Khởi nghiệp Đổi mới Sáng tạo Sinh viên STEM năm học 2025 - 2026.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                  <div>
                    <strong className="text-white">Thực nghiệm khảo thí:</strong> Ứng dụng đã được kiểm thử trên hơn 1.200 lượt sinh viên thực hiện các bài thi môn Lập trình và Tin học đại cương.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Members */}
      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2.5 py-1 rounded-md">
              Nhóm Tác Giả Đề Án
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 mb-2">
              Đội Ngũ Kỹ Sư Sinh Viên Nghiên Cứu
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Các thành viên chuyên trách từng mảng từ hệ thống nhân, trí tuệ nhân tạo đến hạ tầng mạng truyền thông thời gian thực.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold tracking-wide text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">
                      {member.badge}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                      {member.name.charAt(0)}
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-1">{member.name}</h3>
                  <div className="text-xs text-blue-600 font-medium mb-3">{member.role}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{member.desc}</p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400">
                  Khoa CNTT · Trường ĐH Mở TP.HCM
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[850px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              Câu Hỏi Thường Gặp (FAQ)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Giải đáp chi tiết các thắc mắc về kỹ thuật và pháp lý khi triển khai tại Nhà trường
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left py-4 px-5 flex items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50/50 border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
