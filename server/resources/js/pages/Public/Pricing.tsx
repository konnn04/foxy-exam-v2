import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import {
  Check,
  Shield,
  HelpCircle,
  ArrowRight,
  FileText,
  Building,
  GraduationCap,
  Scale,
  Sparkles,
  Zap,
} from 'lucide-react';

interface PlanProps {
  id: number;
  name: string;
  code: string;
  price: number;
  period: string;
  description: string;
  features: string[];
}

interface PricingPageProps {
  plans?: PlanProps[];
}

export default function Pricing({ plans = [] }: PricingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'per_session' | 'semester'>('per_session');

  const defaultSessionPlans = [
    {
      title: 'Gói Ca Thi Thử Nghiệm',
      badge: 'Dành cho Giảng viên / Bộ môn',
      price: '450.000',
      unit: 'VNĐ / kỳ thi (Tối đa 50 SV)',
      perStudent: '~9.000 đ / sinh viên',
      desc: 'Phù hợp cho các bài kiểm tra giữa kỳ, thi học phần nhỏ hoặc đánh giá năng lực nội bộ.',
      features: [
        'Giám sát tối đa 50 thí sinh đồng thời',
        'Khóa Kiosk OS-level chống gian lận',
        'Camera kép (Webcam + Điện thoại QR)',
        'Edge AI phát hiện 4 hành vi cơ bản',
        'Lưu trữ hồ sơ vi phạm 30 ngày',
        'Báo cáo xuất bản liên kết công khai',
      ],
      popular: false,
      ctaText: 'Đăng Ký Gói Thử Nghiệm',
    },
    {
      title: 'Gói Khảo Thí Tiêu Chuẩn',
      badge: 'Phổ biến nhất cho Khoa',
      price: '1.800.000',
      unit: 'VNĐ / đợt thi (Tối đa 300 SV)',
      perStudent: '~6.000 đ / sinh viên',
      desc: 'Tối ưu cho kỳ thi kết thúc học phần của Khoa hoặc các chứng chỉ chuẩn đầu ra ngoại ngữ, tin học.',
      features: [
        'Giám sát tối đa 300 thí sinh đồng thời',
        'Đầy đủ 4 tầng khiên bảo vệ toàn diện',
        'AI nhận diện vật thể cấm (điện thoại, tai nghe)',
        'Cắt video buffer vi phạm tự động ±10s',
        'Lưu trữ hồ sơ đối soát 90 ngày',
        'Hỗ trợ kỹ thuật trực tiếp trong giờ thi',
        'Xuất biên bản kèm mã băm SHA-256',
      ],
      popular: true,
      ctaText: 'Chọn Gói Khảo Thí Tiêu Chuẩn',
    },
    {
      title: 'Gói Kỳ Thi Tập Trung',
      badge: 'Dành cho Phòng Khảo thí Trường',
      price: '4.500.000',
      unit: 'VNĐ / kỳ thi lớn (Tối đa 1.000 SV)',
      perStudent: '~4.500 đ / sinh viên',
      desc: 'Quy mô lớn phục vụ kỳ thi tuyển sinh, thi tốt nghiệp hoặc thi học kỳ toàn trường.',
      features: [
        'Không giới hạn số phòng thi chia nhỏ',
        'Hỗ trợ giám sát phân quyền nhiều giám thị',
        'Kênh truyền WebRTC SFU băng thông ưu tiên',
        'Tích hợp CSDL sinh viên qua API / Excel',
        'Bảo mật dữ liệu tuân thủ NĐ 13/2023',
        'Kỹ sư trực hỗ trợ on-site hoặc từ xa',
        'Hợp đồng kinh tế và hóa đơn GTGT đầy đủ',
      ],
      popular: false,
      ctaText: 'Liên Hệ Đặt Lịch Kỳ Thi',
    },
  ];

  const semesterPlans = [
    {
      title: 'Thuê Bao Học Kỳ (Khoa)',
      badge: 'Dành cho Khoa đào tạo',
      price: '12.000.000',
      unit: 'VNĐ / Học kỳ (5 tháng)',
      perStudent: 'Không giới hạn số lượt thi',
      desc: 'Khoa được chủ động tổ chức không giới hạn bài thi giữa kỳ và cuối kỳ cho toàn bộ sinh viên trực thuộc.',
      features: [
        'Phục vụ tối đa 2.500 sinh viên toàn khoa',
        'Cấp tài khoản không giới hạn cho Giảng viên',
        'Bảng điều khiển quản lý ngân hàng đề thi',
        'Chấm trắc nghiệm và lập trình tự động',
        'Lưu trữ dữ liệu học kỳ trong 12 tháng',
        'Tập huấn sử dụng cho toàn bộ giảng viên',
      ],
      popular: false,
      ctaText: 'Đăng Ký Thuê Bao Khoa',
    },
    {
      title: 'Bản Quyền Toàn Trường (Campus)',
      badge: 'Dành cho Toàn Trường Đại Học',
      price: 'Liên hệ',
      unit: 'Báo giá theo quy mô sinh viên',
      perStudent: 'Chi phí tối ưu dài hạn',
      desc: 'Triển khai đồng bộ toàn trường, kết nối trực tiếp với hệ thống LMS (Moodle, Canvas, Blackboard) hoặc cổng đào tạo tín chỉ.',
      features: [
        'Quy mô 5.000 - 30.000 sinh viên',
        'Tùy chọn triển khai Cloud hoặc On-Premise nội bộ',
        'Tích hợp Single Sign-On (SSO / SAML / OAuth)',
        'Tùy biến nhận diện thương hiệu của Trường',
        'Cam kết SLA vận hành 99.9%',
        'Hỗ trợ hội đồng nghiệm thu và đấu thầu công',
      ],
      popular: true,
      ctaText: 'Yêu Cầu Báo Giá Campus',
    },
  ];

  return (
    <PublicLayout>
      <Head title="Bảng Giá & Gói Dịch Vụ - Exam Guard" />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <Scale className="w-3.5 h-3.5" />
            Minh Bạch · Hợp Lệ Đấu Thầu Giáo Dục
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Biểu Phí Khảo Thí & Phương Án Triển Khai
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
            Chỉ từ <span className="font-bold text-blue-600">4.500 VNĐ / lượt thi</span>. Tiết kiệm tới 70% ngân sách in sao đề thi, thuê phòng máy và bố trí cán bộ coi thi truyền thống.
          </p>

          {/* Billing Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/80 border border-slate-300">
            <button
              type="button"
              onClick={() => setBillingCycle('per_session')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                billingCycle === 'per_session'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo Ca Thi Linh Hoạt
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('semester')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                billingCycle === 'semester'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thuê Bao Học Kỳ / Trường
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(billingCycle === 'per_session' ? defaultSessionPlans : semesterPlans).map((p, idx) => (
              <div
                key={idx}
                className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between p-6 sm:p-8 relative ${
                  p.popular
                    ? 'border-blue-600 shadow-xl shadow-blue-500/10 ring-2 ring-blue-600/20 bg-gradient-to-b from-blue-50/30 to-white'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-wide uppercase shadow-sm">
                    Khuyến Nghị Sử Dụng
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase bg-slate-100 px-2.5 py-1 rounded-md">
                      {p.badge}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2.5">{p.title}</h2>
                    <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{p.desc}</p>
                  </div>

                  <div className="my-6 pb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                        {p.price}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">{p.unit}</div>
                    <div className="text-xs text-emerald-600 font-semibold mt-1">
                      {p.perStudent}
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Quyền lợi bao gồm:
                    </div>
                    {p.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                        <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/#tu-van"
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-center transition-all flex items-center justify-center gap-2 ${
                    p.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {p.ctaText}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal & Procurement Section */}
      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Cơ Sở Pháp Lý & Hồ Sơ Mua Sắm Dành Cho Đơn Vị Công Lập
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Exam Guard được xây dựng hoàn toàn tuân thủ các quy định hiện hành về đấu thầu dịch vụ công nghệ thông tin và bảo mật dữ liệu học đường tại Việt Nam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                Nghị định 214/2025/NĐ-CP & Luật Đấu thầu 22/2023
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hỗ trợ đầy đủ bộ hồ sơ năng lực, báo giá cạnh tranh 3 bên, hợp đồng kinh tế điện tử và hóa đơn giá trị gia tăng hợp lệ để thanh quyết toán ngân sách nhà nước.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                Nghị định 13/2023/NĐ-CP (Bảo vệ dữ liệu cá nhân)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cam kết máy chủ đặt tại Việt Nam. Hình ảnh và video vi phạm được tự động mã hóa, hủy bỏ định kỳ theo quy chế khảo thí và tuyệt đối không thương mại hóa dữ liệu sinh viên.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3.5">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                Tự Do Tích Hợp LMS (Moodle / Edunext / Canvas)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cung cấp chuẩn REST API mở và Webhook cho phép đồng bộ lịch thi, danh sách thí sinh và điểm số trực tiếp vào phần mềm quản lý đào tạo hiện hữu của Nhà trường.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison with traditional costs */}
      <section className="py-14 bg-white">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              So Sánh Chi Phí Khảo Thí (Cho 1.000 Thí Sinh)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Ước tính bài toán kinh tế thực tế tại các trường Đại học & Cao đẳng
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Hạng mục chi phí</th>
                  <th className="py-3 px-4 text-slate-500">Coi thi truyền thống</th>
                  <th className="py-3 px-4 text-blue-600 font-bold bg-blue-50/50">
                    Sử dụng Exam Guard
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-medium">Bố trí giám thị</td>
                  <td className="py-3 px-4 text-slate-500">40 giám thị (20 phòng thi)</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    4 - 5 giám thị trực màn hình AI
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">In sao & vận chuyển đề thi</td>
                  <td className="py-3 px-4 text-slate-500">12.000.000 - 18.000.000 đ</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    0 đ (Đề số hóa bảo mật)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Bằng chứng xử lý gian lận</td>
                  <td className="py-3 px-4 text-slate-500">Dễ khiếu nại, thiếu bằng chứng ghi hình</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    Video 2 góc + Mã SHA-256 đối soát
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Tổng chi phí bình quân</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">~35.000 đ / sinh viên</td>
                  <td className="py-3 px-4 text-blue-600 font-bold bg-blue-50/30">
                    ~4.500 - 6.000 đ / sinh viên
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
