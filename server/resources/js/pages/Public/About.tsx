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
      role: 'Trưởng nhóm và kiến trúc sư hệ thống',
      desc: 'Phụ trách tổng thể kiến trúc phần mềm, cơ chế khóa môi trường máy tính và thiết kế giao thức bảo mật.',
      badge: 'KIẾN TRÚC HỆ THỐNG',
    },
    {
      name: 'Trần Minh Quân',
      role: 'Kỹ sư trí tuệ nhân tạo và thị giác máy tính',
      desc: 'Nghiên cứu và tối ưu hóa mô hình nhận diện khuôn mặt và vật cấm chạy trực tiếp trên vi xử lý thông thường.',
      badge: 'TRÍ TUỆ NHÂN TẠO',
    },
    {
      name: 'Lê Hoàng Khang',
      role: 'Kỹ sư ứng dụng Windows và Kiosk',
      desc: 'Phát triển tầng khóa hệ điều hành, ngăn chặn phần mềm điều khiển từ xa và phát hiện can thiệp tiến trình.',
      badge: 'HỆ THỐNG NATIVE',
    },
    {
      name: 'Phạm Thu Thảo',
      role: 'Kỹ sư truyền thông thời gian thực',
      desc: 'Thiết kế kênh truyền luồng video độ trễ thấp từ điện thoại phụ, cơ chế lưu đệm khi mất mạng và mã băm đối soát.',
      badge: 'TRUYỀN THÔNG REALTIME',
    },
    {
      name: 'Đỗ Quốc Bảo',
      role: 'Kỹ sư trải nghiệm người dùng và khảo sát khảo thí',
      desc: 'Nghiên cứu trải nghiệm phòng thi của sinh viên và giám thị, tiến hành khảo sát thực nghiệm tại các đơn vị đào tạo.',
      badge: 'SẢN PHẨM & KIỂM THỬ',
    },
  ];

  const faqs = [
    {
      q: 'Máy tính của sinh viên cấu hình yếu (Core i3, RAM 4GB) có chạy nổi không?',
      a: 'Hoàn toàn mượt mà. Ứng dụng Exam Guard được biên dịch siêu nhẹ, mức tiêu thụ bộ nhớ chỉ dưới 150MB. Toàn bộ mô hình thị giác nhân tạo được tối ưu hóa để chạy nhẹ nhàng trên CPU với mức tải chỉ từ 5% đến 8%, không đòi hỏi sinh viên phải có máy tính cấu hình cao hay card đồ họa rời.',
    },
    {
      q: 'Nếu đang thi mà mạng Internet của sinh viên bị rớt thì bài làm có bị mất không?',
      a: 'Không hề bị mất. Ứng dụng tích hợp bộ đệm an toàn cục bộ. Toàn bộ thao tác làm bài và trạng thái giám sát được mã hóa và lưu trữ tạm thời trên máy. Khi kết nối Internet được phục hồi, hệ thống sẽ tự động đồng bộ bù mà không làm mất bài thi.',
    },
    {
      q: 'Camera điện thoại phụ có tự ý ghi hình ngoài giờ thi làm ảnh hưởng quyền riêng tư không?',
      a: 'Tuyệt đối không. Luồng giám sát từ điện thoại chạy trực tiếp trên trình duyệt web, không yêu cầu cài ứng dụng chạy ngầm. Kênh kết nối chỉ mở khi thí sinh quét mã QR bắt đầu làm bài và lập tức bị hủy bỏ hoàn toàn ngay khi thí sinh nộp bài.',
    },
    {
      q: 'Nhà trường có phải đầu tư dàn máy chủ GPU đắt tiền để triển khai không?',
      a: 'Không cần. Khác với các giải pháp AI truyền thống phải đẩy toàn bộ video về máy chủ gây quá tải và chi phí vận hành khổng lồ, Exam Guard phân tán việc xử lý xuống chính máy tính của thí sinh. Máy chủ của trường chỉ cần cấu hình tiêu chuẩn để điều phối phòng thi.',
    },
    {
      q: 'Hệ thống có phát hiện được tai nghe siêu nhỏ hoặc màn hình thứ hai không?',
      a: 'Có. Cơ chế khóa sẽ tự động quét định kỳ các thiết bị ngoại vi và cổng xuất hình ảnh. Nếu phát hiện màn hình thứ hai hoặc thiết bị capture card, hệ thống sẽ cảnh báo và vô hiệu hóa ngay. Đồng thời, camera sẽ nhận diện các cử chỉ che tai hoặc quay mặt bất thường.',
    },
    {
      q: 'Bằng chứng vi phạm được lưu trữ thế nào để không bị thí sinh khiếu nại?',
      a: 'Mỗi sự kiện nghi vấn đều được tự động lưu lại dưới dạng đoạn video ngắn và ảnh chụp đồng bộ từ cả 3 góc (camera trước, camera phụ và màn hình) kèm mốc thời gian chính xác và mã băm kiểm tra tính toàn vẹn, bảo đảm tính xác thực trước hội đồng kỷ luật.',
    },
  ];

  return (
    <PublicLayout>
      <Head title="Về chúng tôi và đội ngũ nghiên cứu - Exam Guard" />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <GraduationCap className="w-3.5 h-3.5" />
            Trường Đại học Mở TP. Hồ Chí Minh
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Đề án nghiên cứu và khởi nghiệp sinh viên STEM 2026
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            Exam Guard được nghiên cứu và phát triển bởi nhóm sinh viên Khoa Công nghệ Thông tin - Trường Đại học Mở TP. Hồ Chí Minh, với định hướng ứng dụng trí tuệ nhân tạo để giải quyết bài toán liêm chính học thuật trong chuyển đổi số giáo dục.
          </p>
        </div>
      </section>

      {/* Sứ mệnh & Tầm nhìn */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                Sứ mệnh của dự án
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 mb-4">
                Bảo đảm tính công bằng và liêm chính cho nền giáo dục số
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Trong xu thế chuyển dịch sang giảng dạy kết hợp và đào tạo trực tuyến, việc tổ chức thi cử từ xa thường gặp rào cản lớn nhất: sự nghi ngại về tính trung thực của thí sinh.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                Mục tiêu của chúng tôi là mang lại một giải pháp công nghệ đạt chuẩn chất lượng nhưng có chi phí tiếp cận hợp lý cho các trường đại học tại Việt Nam, không đòi hỏi sinh viên phải sở hữu thiết bị đắt tiền.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl font-black text-blue-600 mb-1">100%</div>
                  <div className="text-xs font-semibold text-slate-700">Công nghệ tự chủ</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Không phụ thuộc dịch vụ nước ngoài</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl font-black text-emerald-600 mb-1">0 VNĐ</div>
                  <div className="text-xs font-semibold text-slate-700">Chi phí đầu tư GPU máy chủ</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Xử lý trực tiếp tại máy thí sinh</div>
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
                    Trường Đại học Mở TP. Hồ Chí Minh
                  </h3>
                  <div className="text-xs text-slate-400">Khoa Công nghệ Thông tin</div>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Target className="w-4 h-4 text-blue-400 shrink-0 mt-1" />
                  <div>
                    <strong className="text-white">Định hướng nghiên cứu:</strong> Hệ thống giám sát thi cử phân tán, tối ưu hóa mô hình trí tuệ nhân tạo cho thiết bị thông thường.
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
                    <strong className="text-white">Thực nghiệm khảo thí:</strong> Ứng dụng đã được kiểm nghiệm thực tế trên hơn 1.200 lượt sinh viên thực hiện các bài thi học phần lập trình và tin học.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Đội ngũ nghiên cứu */}
      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2.5 py-1 rounded-md">
              Nhóm tác giả đề án
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 mb-2">
              Đội ngũ nghiên cứu và phát triển
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

      {/* Câu hỏi thường gặp */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[850px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              Câu hỏi thường gặp
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Giải đáp chi tiết các thắc mắc về kỹ thuật và pháp lý khi triển khai tại nhà trường
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
                    className="w-full text-left py-4 px-5 flex items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
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
