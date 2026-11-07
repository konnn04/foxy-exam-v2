import React from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import {
  Download,
  Laptop,
  Building2,
  CheckCircle2,
  HelpCircle,
  FileCheck,
  ShieldCheck,
  Cpu,
  Monitor,
  Wifi,
  HardDrive,
  Info,
} from 'lucide-react';

export default function DownloadPage() {
  return (
    <PublicLayout>
      <Head title="Tải ứng dụng - Exam Guard" />

      {/* Hero */}
      <section className="relative pt-12 sm:pt-16 pb-12 sm:pb-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Bản phát hành ổn định v2.1.0 · Dành cho Windows
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            Tải ứng dụng giám sát thi Exam Guard
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            Phần mềm bảo vệ môi trường thi an toàn dành cho thí sinh làm bài thi trực tuyến và quản trị viên phòng máy trường đại học.
          </p>
        </div>
      </section>

      {/* Download Options */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Candidate Edition */}
            <div className="rounded-2xl border-2 border-blue-600 bg-gradient-to-b from-blue-50/20 to-white p-6 sm:p-8 flex flex-col justify-between shadow-lg shadow-blue-500/5">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-blue-600 uppercase bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                    DÀNH CHO THÍ SINH
                  </span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Ứng dụng thí sinh cho máy tính cá nhân
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Dành cho sinh viên tự trang bị máy tính xách tay cá nhân tham gia bài kiểm tra tại nhà hoặc tại lớp học.
                </p>

                <div className="space-y-2.5 mb-8 text-xs sm:text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tương thích với Windows 10 và Windows 11 (64-bit)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Bộ cài đặt siêu nhẹ chỉ ~42 MB, cài đặt trong 30 giây</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tự động giải phóng hoàn toàn tài nguyên sau khi nộp bài</span>
                  </div>
                </div>
              </div>

              <div>
                <a
                  href="/download/ExamGuard-Setup-Latest.exe"
                  className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-md shadow-blue-500/20 group"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
                  </svg>
                  <span>Tải ứng dụng Windows (.exe)</span>
                  <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                </a>
                <div className="text-center text-[11px] text-slate-400 mt-2">
                  Bản phát hành chính thức 2.1.0 · Có sẵn mã kiểm tra tính toàn vẹn
                </div>
              </div>
            </div>

            {/* School Lab Edition */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-xs">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                    DÀNH CHO QUẢN TRỊ VIÊN
                  </span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Gói cài đặt đồng loạt cho phòng máy trường
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Dành cho cán bộ quản trị công nghệ thông tin triển khai hàng loạt trên hàng trăm máy tính phòng thực hành.
                </p>

                <div className="space-y-2.5 mb-8 text-xs sm:text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Định dạng cài đặt chuẩn Windows Installer (.msi)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hỗ trợ cài đặt tự động từ xa qua chính sách nhóm (GPO)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Hỗ trợ cấu hình trước địa chỉ máy chủ khảo thí nội bộ</span>
                  </div>
                </div>
              </div>

              <div>
                <a
                  href="/download/ExamGuard-Enterprise-Latest.msi"
                  className="w-full py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-3 transition-all"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
                  </svg>
                  <span>Tải bản phòng máy (.msi)</span>
                  <Download className="w-4 h-4" />
                </a>
                <div className="text-center text-[11px] text-slate-400 mt-2">
                  Dành cho trung tâm quản trị mạng và phòng máy của trường
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Yêu cầu hệ thống */}
      <section className="py-12 bg-slate-50 border-y border-slate-200">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              Yêu cầu phần cứng và hệ thống
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Kiểm tra thiết bị để bảo đảm bài thi diễn ra thuận lợi nhất
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Cấu hình tối thiểu
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600">
                <li className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Hệ điều hành: Windows 10 (64-bit) bản 1909 trở lên</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Bộ xử lý: Intel Core i3 (thế hệ 4 trở lên) hoặc AMD tương đương</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Bộ nhớ RAM: Tối thiểu 4 GB RAM còn trống</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Đường truyền: Tốc độ mạng ổn định từ 2 Mbps trở lên</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-xs ring-1 ring-blue-100">
              <h3 className="font-bold text-blue-900 text-sm mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Cấu hình đề nghị để trải nghiệm tốt nhất
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
                <li className="flex items-center gap-2.5">
                  <Monitor className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Hệ điều hành: Windows 11 (64-bit) cập nhật mới nhất</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Bộ xử lý: Intel Core i5 (thế hệ 8 trở lên) hoặc AMD Ryzen 5</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Bộ nhớ RAM: 8 GB RAM trở lên</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Đường truyền: Mạng dây cáp hoặc Wi-Fi 5GHz từ 10 Mbps</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Hướng dẫn 3 bước */}
      <section className="py-14 sm:py-16 bg-white">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              Hướng dẫn 3 bước chuẩn bị trước giờ thi
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Quy trình nhanh chóng, chỉ mất dưới 2 phút thao tác
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">Tải và mở ứng dụng</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tải tệp cài đặt về máy tính và khởi chạy. Nếu xuất hiện thông báo Windows SmartScreen, chọn "More info" rồi nhấn "Run anyway".
              </p>
            </div>

            <div className="text-center p-5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">Cấp quyền và quét mã QR</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cho phép ứng dụng sử dụng webcam và micro. Dùng điện thoại quét mã QR hiển thị trên màn hình để thiết lập camera phụ.
              </p>
            </div>

            <div className="text-center p-5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">Nhập mã phòng và làm bài</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nhập mã ca thi do cán bộ coi thi cung cấp. Màn hình tự động chuyển sang chế độ làm bài thi an toàn và bắt đầu tính giờ.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
