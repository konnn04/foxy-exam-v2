import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  PROJECT_INFO,
  TEAM_MEMBERS,
  TEAM_MEMBERS_EN,
  ADVISORS,
  ADVISORS_EN,
} from '@/constants/projectInfo';
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
  Phone,
  Briefcase,
} from 'lucide-react';

export default function About() {
  const { lang, t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const team = lang === 'vi' ? TEAM_MEMBERS : TEAM_MEMBERS_EN;
  const advisors = lang === 'vi' ? ADVISORS : ADVISORS_EN;

  const faqsVi = [
    {
      q: 'Máy tính của sinh viên cấu hình yếu (Core i3, RAM 4GB) có chạy nổi không?',
      a: 'Hoàn toàn mượt mà. Ứng dụng Exam Guard được đóng gói siêu nhẹ, chạy ổn định trên Windows 10 và 11 phổ thông. Mô hình học máy YOLOX và MobileFaceNet được tối ưu lượng tử hóa chạy trực tiếp trên vi xử lý thông thường với mức chiếm dụng CPU chỉ 4-8%, không đòi hỏi máy tính phải có card đồ họa GPU đắt đỏ.',
    },
    {
      q: 'Nếu đang thi mà mạng Internet của sinh viên bị rớt thì bài làm có bị mất không?',
      a: 'Không hề bị mất. Ứng dụng tích hợp bộ đệm an toàn cục bộ mã hóa dữ liệu. Nếu rớt mạng trong 3-5 phút, bài thi vẫn được bảo toàn nguyên vẹn và hệ thống tự động đồng bộ bù ngay khi có kết nối trở lại.',
    },
    {
      q: 'Camera điện thoại phụ có tự ý ghi hình ngoài giờ thi làm ảnh hưởng quyền riêng tư không?',
      a: 'Tuyệt đối không. Luồng giám sát từ điện thoại chạy trực tiếp trên trình duyệt web qua WebRTC, không yêu cầu cài ứng dụng chạy ngầm. Hệ thống tuân thủ nguyên tắc "Tối thiểu hóa dữ liệu" (Data Minimization) theo Nghị định 13/2023/NĐ-CP: chỉ ghi nhận đoạn video ngắn tại thời điểm phát sinh sự cố bất thường.',
    },
    {
      q: 'Nhà trường có phải đầu tư dàn máy chủ GPU đắt tiền để triển khai không?',
      a: 'Không cần. Khác với các giải pháp quốc tế xử lý video tập trung tại máy chủ gây tốn kém băng thông, Exam Guard phân tán việc phân tích về máy thí sinh. Chi phí vận hành chỉ khoảng 3.000 đ/lượt thi và nhà trường hoàn toàn không phải đầu tư máy chủ GPU.',
    },
    {
      q: 'Hệ thống có phát hiện được tai nghe siêu nhỏ hoặc màn hình thứ hai không?',
      a: 'Có. Cơ chế khóa Kiosk chặn phím tắt, ngăn chia sẻ màn hình ngoài qua cổng HDMI và chặn các phần mềm điều khiển từ xa (UltraViewer, AnyDesk). Camera phụ góc nghiêng 45° từ điện thoại bao quát toàn bộ thao tác gõ phím và không gian quanh bàn thi.',
    },
    {
      q: 'Bằng chứng vi phạm được lưu trữ thế nào để không bị thí sinh khiếu nại?',
      a: 'Hệ thống tự động cắt đoạn video ngắn tại thời điểm bất thường và đính kèm mã băm kiểm chứng tính toàn vẹn. Giám thị nhận thông báo trong vòng 2 giây và hội đồng khảo thí có căn cứ số hóa rõ ràng để giải quyết khiếu nại minh bạch.',
    },
  ];

  const faqsEn = [
    {
      q: 'Can low-spec student laptops (Core i3, 4GB RAM) run the software smoothly?',
      a: 'Absolutely smooth. The Exam Guard client is ultra-lightweight and stable on Windows 10 and 11. Quantized YOLOX and MobileFaceNet neural networks run directly on commodity CPUs with only 4–8% CPU utilization, requiring zero dedicated GPU hardware.',
    },
    {
      q: 'Will answers be lost if candidate Internet disconnects during the exam?',
      a: 'Not at all. The application incorporates a secure local encrypted buffer. During 3–5 minute network dropouts, test data remains fully protected and resynchronizes automatically the instant connectivity is restored.',
    },
    {
      q: 'Does the secondary phone camera record outside exam hours or breach privacy?',
      a: 'Never. The mobile stream runs strictly inside the web browser via WebRTC with no background app install. It complies with Data Minimization under Decree 13/2023/ND-CP: only short incident clips during detected anomalies are captured.',
    },
    {
      q: 'Does the university need to invest in expensive server GPU clusters?',
      a: 'No. Unlike international platforms that stream and process all video centrally on cloud GPUs incurring immense bandwidth bills, Exam Guard distributes inference to the edge. Operational cost is only ~3,000 VND per attempt with zero server GPU CapEx.',
    },
    {
      q: 'Can the system detect hidden micro-earphones or secondary external displays?',
      a: 'Yes. The OS-level Kiosk hook blocks hotkeys, detects external HDMI monitors, and disables remote desktop applications (UltraViewer, AnyDesk). The angled 45° smartphone camera captures hands, keyboard typing, and desk perimeter.',
    },
    {
      q: 'How is violation evidence recorded to resolve student grade appeals fairly?',
      a: 'The platform automatically clips multi-angle video segments during anomalies, sealed with cryptographic SHA-256 hashes. Proctors receive alerts within 2 seconds, providing indisputable evidence for academic disciplinary committees.',
    },
  ];

  const faqs = lang === 'vi' ? faqsVi : faqsEn;

  return (
    <PublicLayout>
      <Head title={t.about.metaTitle} />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <GraduationCap className="w-3.5 h-3.5" />
            {lang === 'vi' ? PROJECT_INFO.competition : 'STEM 2026 Student Entrepreneurship Competition'}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.about.heroTitle}
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            {t.about.heroDesc}
          </p>
        </div>
      </section>

      {/* Sứ mệnh & Bối cảnh đề án */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                {t.about.missionBadge}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 mb-4">
                {t.about.missionTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                {t.about.missionP1}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                {t.about.missionP2}
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl font-black text-blue-600 mb-1">1 : 80</div>
                  <div className="text-xs font-semibold text-slate-700">
                    {lang === 'vi' ? 'Tỷ lệ giám sát / thí sinh' : 'Proctor to Candidate Ratio'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {lang === 'vi' ? 'Tăng gấp 2 lần hiệu suất coi thi' : '2x invigilation operational efficiency'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-2xl font-black text-emerald-600 mb-1">0 VNĐ</div>
                  <div className="text-xs font-semibold text-slate-700">
                    {lang === 'vi' ? 'Đầu tư máy chủ GPU' : 'GPU Server Investment'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {lang === 'vi' ? 'AI chạy trực tiếp tại máy thí sinh' : 'AI runs locally on candidate laptops'}
                  </div>
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
                    {lang === 'vi' ? PROJECT_INFO.institution : 'Ho Chi Minh City Open University'}
                  </h3>
                  <div className="text-xs text-slate-400">
                    {lang === 'vi' ? PROJECT_INFO.faculty : 'Faculty of Information Technology'}
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Target className="w-4 h-4 text-blue-400 shrink-0 mt-1" />
                  <div>
                    <strong className="text-white">
                      {lang === 'vi' ? 'Ý tưởng chính:' : 'Core Concept:'}
                    </strong>{' '}
                    {lang === 'vi'
                      ? 'Nền tảng giám sát dùng chung cho thi trực tuyến từ xa, thi tại phòng máy và thi kết hợp. Tích hợp AI phát hiện bất thường, cảnh báo thời gian thực và bằng chứng hậu kiểm có cấu trúc.'
                      : 'Unified proctoring system for remote online exams, campus computer labs, and hybrid assessment. Integrated with edge AI anomaly detection, realtime alerts, and cryptographic audit evidence.'}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                  <div>
                    <strong className="text-white">
                      {lang === 'vi' ? 'Hiện trạng sản phẩm:' : 'Product Readiness:'}
                    </strong>{' '}
                    {lang === 'vi'
                      ? 'Sản phẩm mẫu đã vận hành thực tế, phát triển và bảo vệ trong đồ án chuyên ngành tại Khoa CNTT Trường ĐH Mở TP.HCM.'
                      : 'Fully functional working MVP, architected and defended as a major IT capstone project at Ho Chi Minh City Open University.'}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                  <div>
                    <strong className="text-white">
                      {lang === 'vi' ? 'Kết quả kiểm thử:' : 'Benchmark Results:'}
                    </strong>{' '}
                    {lang === 'vi'
                      ? 'Đã kiểm thử tải 50 người dùng đồng thời; thời gian phản hồi P95 trong 2s; độ trễ xử lý AI trung bình ~50ms.'
                      : 'Benchmarked with 50 concurrent candidates; P95 response latency ≤ 2s; average AI inference latency ~50ms per frame.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Đội ngũ 5 sinh viên thực hiện đề án */}
      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2.5 py-1 rounded-md">
              {t.about.teamSectionBadge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 mb-2">
              {t.about.teamSectionTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {t.about.teamSectionDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl border transition-all flex flex-col justify-between ${
                  member.isLeader
                    ? 'bg-gradient-to-b from-blue-50/40 to-white border-blue-400 shadow-md ring-1 ring-blue-300'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10.5px] font-bold tracking-wide text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {member.badge}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      MSSV: {member.mssv}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-lg mb-1">{member.name}</h3>
                  <div className="text-xs text-blue-600 font-semibold mb-3">{member.role}</div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {member.duties}
                  </p>
                </div>

                <div className="pt-3 mt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={`mailto:${member.email}`} className="hover:text-blue-600 truncate">
                      {member.email}
                    </a>
                  </div>
                  {member.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Giảng viên cố vấn đề án */}
          <div className="mt-12 pt-10 border-t border-slate-200">
            <div className="text-center max-w-xl mx-auto mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-200/80 px-2.5 py-1 rounded-md">
                {t.about.advisorsBadge}
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">
                {t.about.advisorsTitle}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {advisors.map((adv, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{adv.name}</h4>
                    <div className="text-xs text-blue-600 font-semibold">{adv.role}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{adv.department}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[850px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              {t.about.faqTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {t.about.faqDesc}
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
