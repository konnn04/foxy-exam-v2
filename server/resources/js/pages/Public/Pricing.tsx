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

import { OFFICIAL_PRICING } from '@/constants/projectInfo';

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

  const defaultSessionPlans = OFFICIAL_PRICING.perClass.map((p) => ({
    title: p.title,
    badge: p.scale.toUpperCase(),
    price: p.price,
    unit: p.unit,
    perStudent: p.perStudent,
    desc: p.desc,
    features: p.features,
    popular: p.popular,
    ctaText: p.ctaText,
  }));

  const semesterPlans = OFFICIAL_PRICING.semester.map((p) => ({
    title: p.title,
    badge: p.scale.toUpperCase(),
    price: p.price,
    unit: p.unit,
    perStudent: p.perStudent,
    desc: p.desc,
    features: p.features,
    popular: p.popular,
    ctaText: p.ctaText,
  }));

  return (
    <PublicLayout>
      <Head title="Bảng giá và gói dịch vụ - Exam Guard" />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <Scale className="w-3.5 h-3.5" />
            Minh bạch · Hợp lệ mua sắm giáo dục
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Biểu phí khảo thí và phương án triển khai
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
            Chỉ từ <span className="font-bold text-blue-600">4.500 VNĐ / lượt thi</span>. Tiết kiệm tới 70% ngân sách in sao đề thi, thuê phòng máy và thù lao cán bộ coi thi truyền thống.
          </p>

          {/* Bộ chọn chu kỳ */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/80 border border-slate-300">
            <button
              type="button"
              onClick={() => setBillingCycle('per_session')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                billingCycle === 'per_session'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo ca thi linh hoạt
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('semester')}
              className={`px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                billingCycle === 'semester'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thuê bao học kỳ hoặc theo trường
            </button>
          </div>
        </div>
      </section>

      {/* Danh sách thẻ giá */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
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
                    Khuyến nghị sử dụng
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase bg-slate-100 px-2.5 py-1 rounded-md">
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

          {/* Ưu đãi khách hàng sáng lập & Gói On-premise */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded">
                  Chính sách khách hàng sáng lập
                </span>
                <h3 className="text-xl font-bold mt-3 mb-2">Ưu đãi giảm 30% năm đầu</h3>
                <p className="text-xs sm:text-sm text-blue-100 leading-relaxed mb-4">
                  Dành riêng cho 03 cơ sở đào tạo tiên phong ký kết hợp đồng thương mại với Exam Guard, đổi lại quyền xây dựng bộ hồ sơ triển khai mẫu (Case Study).
                </p>
                <div className="text-xs text-blue-200">
                  ✓ Thí điểm miễn phí 01 học phần (tối đa 200 lượt thi) trước khi ký hợp đồng
                </div>
              </div>
              <Link
                href="/#tu-van"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Đăng ký thí điểm miễn phí
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="p-6 sm:p-7 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-blue-400 px-2.5 py-1 rounded border border-slate-700">
                  {OFFICIAL_PRICING.onPremise.title}
                </span>
                <div className="mt-3 text-lg font-bold text-white">
                  {OFFICIAL_PRICING.onPremise.setupFee}
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  + {OFFICIAL_PRICING.onPremise.maintenanceFee}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {OFFICIAL_PRICING.onPremise.desc}
                </p>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {OFFICIAL_PRICING.onPremise.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href="/#tu-van"
                className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm transition-colors border border-slate-700 cursor-pointer"
              >
                Tư vấn giải pháp On-premise
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Cơ sở pháp lý & Hồ sơ mua sắm */}
      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Cơ sở pháp lý và hồ sơ mua sắm dành cho đơn vị công lập
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Exam Guard được xây dựng hoàn toàn phù hợp với các quy định hiện hành về đấu thầu dịch vụ công nghệ thông tin và bảo vệ dữ liệu sinh viên tại Việt Nam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                Nghị định 214/2025/NĐ-CP và Luật Đấu thầu
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hỗ trợ đầy đủ bộ hồ sơ năng lực, bảng báo giá cạnh tranh, hợp đồng kinh tế điện tử và hóa đơn giá trị gia tăng hợp lệ để thanh quyết toán ngân sách nhà nước.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Toàn bộ dữ liệu đặt tại trung tâm dữ liệu Việt Nam. Hình ảnh và video vi phạm được tự động mã hóa, hủy bỏ định kỳ theo quy chế khảo thí và cam kết không thương mại hóa dữ liệu sinh viên.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3.5">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                Tích hợp linh hoạt với hệ thống đào tạo sẵn có
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cung cấp cổng kết nối chuẩn cho phép đồng bộ lịch thi, danh sách sinh viên và xuất điểm thi trực tiếp vào phần mềm quản lý đào tạo hiện hữu của nhà trường.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bảng so sánh chi phí thực tế */}
      <section className="py-14 bg-white">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              So sánh chi phí khảo thí cho 1.000 thí sinh
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Ước tính bài toán kinh tế thực tế tại các trường đại học và cao đẳng
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
                  <td className="py-3 px-4 text-slate-500">40 cán bộ coi thi (20 phòng)</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    4 đến 5 cán bộ giám sát trực tiếp
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">In sao và bảo quản đề thi</td>
                  <td className="py-3 px-4 text-slate-500">12.000.000 - 18.000.000 đ</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    0 đ (Đề thi số hóa bảo mật)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Căn cứ giải quyết khiếu nại</td>
                  <td className="py-3 px-4 text-slate-500">Dễ khiếu nại, không có hình ảnh ghi lại</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold bg-blue-50/20">
                    Video 3 góc có mã kiểm tra toàn vẹn
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Tổng chi phí bình quân</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">~35.000 đ / sinh viên</td>
                  <td className="py-3 px-4 text-blue-600 font-bold bg-blue-50/30">
                    ~4.500 đến 6.000 đ / sinh viên
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
