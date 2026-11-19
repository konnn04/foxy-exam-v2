import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import PublicLayout from '@/layouts/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSite } from '@/hooks/use-site';
import ZoomableImage from '@/components/common/ZoomableImage';
import FakeDashboard from '@/components/public/FakeDashboard';
import TermsModal from '@/components/public/TermsModal';
import { DEFAULT_TERMS, hashText } from '@/constants/terms';
import { Mockup, SectionHead, type MockKind } from '@/components/public/blocks';
import { shieldsEn, shieldsVi } from '@/constants/landingShields';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileCheck,
  Landmark,
  Play,
  QrCode,
  ScanFace,
  Smartphone,
  Shield,
  ShieldCheck,
  Wallet,
  Users,
  Zap,
} from 'lucide-react';

type L<T = string> = { vi: T; en: T };

const PROBLEMS: { icon: typeof Wallet; title: L; desc: L }[] = [
  {
    icon: Wallet,
    title: { vi: 'Chi phí tổ chức thi cao', en: 'High cost of running exams' },
    desc: {
      vi: 'In sao đề, thuê phòng máy và thù lao coi thi chiếm phần lớn ngân sách mỗi kỳ.',
      en: 'Printing, computer-lab rental and invigilator fees take most of every exam budget.',
    },
  },
  {
    icon: Users,
    title: { vi: 'Một giám thị khó bao quát', en: 'One proctor cannot see everything' },
    desc: {
      vi: 'Coi thi trực tuyến thủ công dễ bỏ sót hành vi gian lận và gây áp lực lớn cho cán bộ.',
      en: 'Manual online proctoring misses cheating and puts heavy strain on staff.',
    },
  },
  {
    icon: Database,
    title: { vi: 'Lo ngại dữ liệu sinh trắc học', en: 'Biometric data concerns' },
    desc: {
      vi: 'Nhiều giải pháp ngoại đẩy toàn bộ video ra nước ngoài, khó đáp ứng quy định bảo vệ dữ liệu.',
      en: 'Many foreign tools stream all video abroad, which is hard to reconcile with data-protection rules.',
    },
  },
];

const STEPS: { title: L; desc: L; icon: typeof QrCode }[] = [
  {
    icon: FileCheck,
    title: { vi: 'Giảng viên tạo kỳ thi', en: 'Lecturer sets up the exam' },
    desc: {
      vi: 'Chọn đề từ ngân hàng câu hỏi, gán lớp, bật các lớp bảo vệ cần thiết và mở phòng thi.',
      en: 'Pick questions from the bank, assign a class, switch on the safeguards you need and open the room.',
    },
  },
  {
    icon: QrCode,
    title: { vi: 'Thí sinh vào phòng', en: 'Candidates join the room' },
    desc: {
      vi: 'Đăng nhập, xác thực khuôn mặt, quét mã QR bằng điện thoại và hoàn tất kiểm tra trong khoảng 2 phút.',
      en: 'Sign in, verify their face, scan the QR with a phone and finish the check in about two minutes.',
    },
  },
  {
    icon: ShieldCheck,
    title: { vi: 'Giám sát và đối soát', en: 'Monitor and review' },
    desc: {
      vi: 'AI cảnh báo bất thường theo thời gian thực; sau thi, hồ sơ video và biên bản được xuất sẵn.',
      en: 'AI flags anomalies in real time; after the exam the video evidence and report are ready to export.',
    },
  },
];

const FAQS: { q: L; a: L }[] = [
  {
    q: { vi: 'Máy thí sinh cấu hình thấp có chạy được không?', en: 'Will low-spec candidate laptops cope?' },
    a: {
      vi: 'Có. Mô hình AI chạy trên CPU, chỉ chiếm khoảng 4–8% tài nguyên, không cần card đồ họa rời.',
      en: 'Yes. The AI models run on the CPU using roughly 4–8% of it, with no discrete GPU required.',
    },
  },
  {
    q: { vi: 'Mất mạng giữa chừng thì bài làm có mất không?', en: 'What if the network drops mid-exam?' },
    a: {
      vi: 'Không. Bài làm được lưu cục bộ và tự đồng bộ lại ngay khi có kết nối.',
      en: 'Answers are buffered locally and resynchronise automatically as soon as the connection returns.',
    },
  },
  {
    q: { vi: 'Dữ liệu khuôn mặt và video được lưu ở đâu?', en: 'Where are face data and video stored?' },
    a: {
      vi: 'Lưu trên máy chủ đặt tại Việt Nam, chỉ ghi các đoạn ngắn quanh thời điểm nghi vấn, tuân thủ Nghị định 13/2023/NĐ-CP.',
      en: 'On servers located in Vietnam. Only short clips around suspected incidents are kept, in line with Decree 13/2023/ND-CP.',
    },
  },
  {
    q: { vi: 'Nhà trường có thể tự triển khai nội bộ không?', en: 'Can the institution self-host?' },
    a: {
      vi: 'Có. Gói cài đặt tại chỗ đưa toàn bộ hệ thống vào máy chủ của trường, kèm tuỳ biến thương hiệu.',
      en: 'Yes. The on-premise package runs the whole stack on your own servers, with custom branding.',
    },
  },
];

function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((chunk, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-slate-900">
            {chunk}
          </strong>
        ) : (
          chunk
        ),
      )}
    </>
  );
}

/** Each protection layer is shown next to the screen that proves it. */
const PROOF_KINDS: MockKind[] = ['kiosk', 'operator', 'phone', 'report'];

export default function Landing() {
  const { lang, t } = useLanguage();
  const site = useSite();
  const pick = <T,>(v: L<T>): T => v[lang];
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [form, setForm] = useState({ name: '', email: '', phone: '', org: '' });
  const [submitted, setSubmitted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [dashFailed, setDashFailed] = useState(false);

  const shields = lang === 'en' ? shieldsEn : shieldsVi;
  const dashboard = site.get('media.dashboard');
  const videoUrl = site.get('media.video_url');

  const heroTitle = site.text('hero.title', t.landing.heroTitle);
  const heroHighlight = site.text('hero.highlight', t.landing.heroTitleHighlight);
  const heroDesc = site.text('hero.description', t.landing.heroDesc);
  const heroBadge = site.text('hero.badge', t.landing.badge);

  const metrics = [
    { value: t.landing.metrics.latencyNum, label: t.landing.metrics.latencyLabel },
    { value: t.landing.metrics.ratioNum, label: t.landing.metrics.ratioLabel },
    { value: t.landing.metrics.costNum, label: t.landing.metrics.costLabel },
    { value: t.landing.metrics.dataNum, label: t.landing.metrics.dataLabel },
  ].map((m, i) => ({
    value: site.get(`metrics.${i + 1}.value`, m.value),
    label: site.text(`metrics.${i + 1}.label`, m.label),
  }));

  const trust = [
    { icon: Landmark, text: lang === 'vi' ? 'Phát triển tại Trường ĐH Mở TP.HCM' : 'Built at HCMC Open University' },
    { icon: Database, text: lang === 'vi' ? 'Dữ liệu lưu trữ tại Việt Nam' : 'Data stored in Vietnam' },
    { icon: BadgeCheck, text: lang === 'vi' ? 'Tuân thủ NĐ 13/2023/NĐ-CP' : 'Decree 13/2023 compliant' },
    { icon: ScanFace, text: lang === 'vi' ? 'AI chạy trên máy thí sinh' : 'On-device AI inference' },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setTermsOpen(true);
  };

  /** Runs only after the visitor accepted the terms: stores the request with the proof of consent. */
  const sendRequest = async () => {
    setSending(true);
    setSendError(null);
    try {
      const termsText = site.text('legal.terms', DEFAULT_TERMS[lang]);
      const xsrf = decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? '');
      const res = await fetch('/pilot-requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf, 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ ...form, website: honeypot, locale: lang, terms_accepted: true, terms_hash: await hashText(termsText) }),
      });
      if (res.status === 429) throw new Error(lang === 'vi' ? 'Bạn gửi quá nhanh, vui lòng thử lại sau ít phút.' : 'Too many attempts, please try again in a few minutes.');
      if (!res.ok) throw new Error(lang === 'vi' ? 'Không gửi được, vui lòng kiểm tra thông tin và thử lại.' : 'Could not send, please check your details and try again.');
      setTermsOpen(false);
      setSubmitted(true);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const input =
    'w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15';

  return (
    <PublicLayout>
      <Head>
        <title>{t.landing.metaTitle}</title>
        <meta name="description" content={heroDesc} />
      </Head>

      {/* HERO */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 90% at 70% 40%, #000 25%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 90% at 70% 40%, #000 25%, transparent 75%)',
          }}
        />
        <div className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[620px] rounded-full bg-blue-600/25 blur-[130px]" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-[460px] w-[560px] rounded-full bg-indigo-500/25 blur-[130px]" />

        <div className="relative mx-auto grid max-w-[1280px] items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:px-8 lg:py-24">
          {/* Message */}
          <div className="text-center lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-blue-400/30 bg-blue-500/10 py-1.5 pl-2 pr-4 text-[12px] font-semibold tracking-wide text-blue-100">
              <span className="relative flex size-5 items-center justify-center rounded-full bg-blue-500/30">
                <span className="absolute size-2 animate-ping rounded-full bg-blue-300/70" />
                <ShieldCheck className="relative size-3 text-blue-100" />
              </span>
              {heroBadge}
            </div>

            <h1 className="text-[34px] font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[52px]">
              {heroTitle}
              <span className="mt-3 block bg-gradient-to-r from-blue-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">{heroHighlight}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-[620px] text-[15.5px] leading-relaxed text-slate-300 sm:text-[17px] lg:mx-0">{heroDesc}</p>

            <div className="mt-9 flex flex-col items-center gap-3.5 sm:flex-row lg:justify-start sm:justify-center">
              <a
                href="#tu-van"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-[14.5px] font-bold text-white shadow-lg shadow-blue-600/30 ring-1 ring-white/10 transition hover:bg-blue-500 sm:w-auto"
              >
                {t.landing.registerPilotCta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/download"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-[14.5px] font-bold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
              >
                <svg className="size-4 fill-current" viewBox="0 0 88 88">
                  <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L0 75.48v-29.35zm4.326-39.043L87.314 0v41.527l-47.318.376zm47.329 44.912l-.011 41.535-47.318-6.678-.041-35.195z" />
                </svg>
                {t.landing.downloadWinCta}
              </Link>
            </div>

            <ul className="mt-9 flex flex-col items-center gap-x-6 gap-y-2.5 text-[13px] font-medium text-slate-300 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              {(lang === 'vi'
                ? ['Không cần GPU, chạy trên máy sẵn có', 'Camera phụ qua mã QR', 'Dữ liệu lưu tại Việt Nam']
                : ['No GPU, runs on existing laptops', 'Secondary camera via QR', 'Data stored in Vietnam']
              ).map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  {x}
                </li>
              ))}
            </ul>
          </div>

          {/* Product + live proof */}
          <div className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
            <div className="pointer-events-none absolute -inset-6 rounded-[32px] bg-gradient-to-br from-blue-500/25 via-transparent to-indigo-500/25 blur-2xl" />

            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-[0_40px_100px_-30px_rgba(37,99,235,0.6)] ring-1 ring-black/40 lg:[transform:perspective(1800px)_rotateY(-7deg)_rotateX(2deg)]">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500/80" />
                  <span className="size-3 rounded-full bg-amber-500/80" />
                  <span className="size-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 hidden font-mono text-[11px] text-slate-400 sm:inline">examguard.edu.vn/live/session-it2026</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                  <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                  {t.landing.mockup.liveBadge}
                </span>
              </div>
              <div className="relative">
                {dashboard && !dashFailed ? (
                  <ZoomableImage
                    key={dashboard}
                    src={dashboard}
                    alt={t.landing.mockup.autoLogTitle}
                    hintText={lang === 'vi' ? 'Xem ảnh lớn' : 'Click to zoom'}
                    onError={() => setDashFailed(true)}
                    className="block h-auto w-full"
                    containerClassName="!rounded-none"
                  />
                ) : (
                  <FakeDashboard compact />
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-transparent via-blue-400/10 to-transparent motion-safe:animate-[heroSweep_5s_linear_infinite]" />
              </div>
            </div>

            {/* floating evidence cards */}
            <div className="absolute -left-4 top-[22%] hidden w-[230px] rounded-xl border border-red-400/40 bg-slate-900/95 p-3 shadow-2xl shadow-black/40 backdrop-blur motion-safe:animate-[heroFloat_6s_ease-in-out_infinite] sm:block lg:-left-10">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-red-500/15 text-red-300">
                  <Smartphone className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold text-white">{t.landing.mockup.phoneDetected}</div>
                  <div className="text-[11px] text-red-300/90">{t.landing.mockup.videoReady}</div>
                </div>
              </div>
            </div>

            <div className="absolute -right-3 top-[8%] hidden rounded-xl border border-emerald-400/30 bg-slate-900/95 p-3 shadow-2xl shadow-black/40 backdrop-blur motion-safe:animate-[heroFloat_7s_ease-in-out_-2s_infinite] sm:block lg:-right-6">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                  <ScanFace className="size-[18px]" />
                </span>
                <div>
                  <div className="text-[12.5px] font-bold text-white">{t.landing.mockup.faceMatch}</div>
                  <div className="text-[11px] text-emerald-300/90">{t.landing.mockup.secondCamOk}</div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 right-6 hidden items-center gap-3 rounded-xl border border-blue-400/30 bg-slate-900/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur motion-safe:animate-[heroFloat_8s_ease-in-out_-4s_infinite] sm:flex">
              <span className="flex size-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                <Zap className="size-[18px]" />
              </span>
              <div>
                <div className="font-mono text-[15px] font-extrabold text-white">{metrics[0].value}</div>
                <div className="text-[11px] text-blue-200/90">{metrics[0].label}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
      </section>

      {/* KEY METRICS */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1100px] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm md:grid-cols-4">
            {metrics.map((m, i) => (
              <div key={i} className="bg-white px-4 py-7 text-center">
                <div className={`font-mono text-[28px] font-extrabold sm:text-[34px] ${i === 0 ? 'text-blue-600' : i === 3 ? 'text-emerald-600' : 'text-slate-900'}`}>{m.value}</div>
                <div className="mx-auto mt-1.5 max-w-[190px] text-[13px] font-medium leading-snug text-slate-600">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            {trust.map((x, i) => (
              <div key={i} className="flex items-center justify-center gap-2.5 text-center text-[13px] font-semibold text-slate-600">
                <x.icon className="size-[18px] shrink-0 text-blue-600" />
                <span>{x.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow={lang === 'vi' ? 'Bài toán của nhà trường' : 'The institution’s challenge'}
            title={lang === 'vi' ? 'Khảo thí số cần công bằng, gọn nhẹ và hợp pháp' : 'Digital assessment must be fair, light and lawful'}
            desc={
              lang === 'vi'
                ? 'Exam Guard giải quyết ba nút thắt lớn nhất khi chuyển kỳ thi sang môi trường trực tuyến.'
                : 'Exam Guard tackles the three biggest bottlenecks of moving exams online.'
            }
          />
          <div className="grid gap-6 md:grid-cols-3">
            {PROBLEMS.map((p, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <p.icon className="size-6" />
                </div>
                <h3 className="text-[17px] font-bold text-slate-900">{pick(p.title)}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-600">{pick(p.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 LAYERS, each next to its proof */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow={t.landing.shieldsSection.badge} title={t.landing.shieldsSection.title} desc={t.landing.shieldsSection.desc} />

          <div className="divide-y divide-slate-200">
            {shields.map((sh, i) => {
              const Icon = sh.icon;
              const flip = i % 2 === 1;
              return (
                <div key={sh.id} className="grid items-center gap-8 py-12 first:pt-0 last:pb-0 lg:grid-cols-2 lg:gap-16 lg:py-16">
                  <div className={flip ? 'lg:order-2' : ''}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                        <Icon className="size-5" />
                      </div>
                      <span className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">{sh.badge}</span>
                      <span className="ml-auto font-mono text-sm font-bold text-slate-300">0{i + 1}</span>
                    </div>
                    <h3 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[28px]">{sh.title}</h3>
                    <p className="mt-2 text-[15px] font-medium text-blue-700">{sh.subtitle}</p>
                    <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                      <Bold text={sh.desc} />
                    </p>
                    <ul className="mt-6 space-y-2.5">
                      {sh.specs.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-[14.5px] text-slate-700">
                          <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-emerald-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Mockup kind={PROOF_KINDS[i]} className={flip ? 'lg:order-1' : ''} />
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link href="/features" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">
              {t.landing.shieldsSection.viewMoreFeatures} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow={lang === 'vi' ? 'Quy trình' : 'How it works'}
            title={lang === 'vi' ? 'Ba bước cho một kỳ thi trực tuyến' : 'Three steps to an online exam'}
          />
          <div className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            <div className="absolute left-[16%] right-[16%] top-7 hidden border-t-2 border-dashed border-slate-200 md:block" />
            {STEPS.map((s, i) => (
              <div key={i} className="relative text-center">
                <div className="relative mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 shadow-xs">
                  <s.icon className="size-6" />
                  <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
                </div>
                <h3 className="text-[17px] font-bold text-slate-900">{pick(s.title)}</h3>
                <p className="mx-auto mt-2 max-w-[300px] text-[14.5px] leading-relaxed text-slate-600">{pick(s.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIDEO */}
      {videoUrl && (
        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-[1060px] px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow={t.landing.videoSection.badge} title={t.landing.videoSection.title} desc={t.landing.videoSection.desc} />
            <div className="mx-auto aspect-video max-w-4xl overflow-hidden rounded-2xl border border-slate-300 bg-black shadow-xl">
              <iframe src={videoUrl} className="h-full w-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen title="Demo video" />
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-[820px] px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="FAQ" title={lang === 'vi' ? 'Câu hỏi thường gặp' : 'Frequently asked questions'} />
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-xs">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-[15.5px] font-semibold text-slate-900">{pick(f.q)}</span>
                    <ChevronDown className={`size-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <p className="px-6 pb-5 text-[14.5px] leading-relaxed text-slate-600">{pick(f.a)}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-center text-sm text-slate-500">
            <Link href="/about" className="font-semibold text-blue-700 hover:underline">
              <span className="inline-flex items-center gap-1.5">
                {lang === 'vi' ? 'Xem thêm câu hỏi' : 'More questions'}
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </p>
        </div>
      </section>

      {/* PILOT FORM */}
      <section id="tu-van" className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-3 inline-block rounded-full border border-blue-400/40 bg-blue-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-100">
                {t.landing.pilotForm.badge}
              </div>
              <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t.landing.pilotForm.title}</h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-blue-100">{t.landing.pilotForm.desc}</p>
              <div className="mt-6 space-y-3 text-sm text-blue-100">
                {[t.landing.pilotForm.bullet1, t.landing.pilotForm.bullet2, t.landing.pilotForm.bullet3].map((b) => (
                  <div key={b} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[13px] text-blue-100">
                <Zap className="size-4 text-amber-300" />
                {lang === 'vi' ? 'Phản hồi trong 24 giờ làm việc' : 'We reply within one working day'}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
              {submitted ? (
                <div className="space-y-3 py-8 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h3 className="text-xl font-bold">{lang === 'vi' ? 'Đã tiếp nhận thông tin' : 'Request received'}</h3>
                  <p className="text-sm text-slate-600">
                    {lang === 'vi' ? 'Ban dự án sẽ liên hệ với bạn trong 24 giờ làm việc.' : 'Our team will get back to you within one working day.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <h3 className="text-xl font-bold">{t.landing.pilotForm.formTitle}</h3>
                  <input tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">{t.landing.pilotForm.nameLabel}</label>
                    <input className={input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === 'vi' ? 'ThS. Nguyễn Văn A' : 'Dr. John Doe'} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">{t.landing.pilotForm.emailLabel}</label>
                      <input className={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="canbo@ou.edu.vn" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">{t.landing.pilotForm.phoneLabel}</label>
                      <input className={input} type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xx xxx xxx" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">{t.landing.pilotForm.orgLabel}</label>
                    <input className={input} value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} placeholder={lang === 'vi' ? 'Trường Đại học / Cao đẳng / Khoa' : 'University / College / Faculty'} />
                  </div>
                  <button type="submit" className="mt-1 w-full cursor-pointer rounded-lg bg-blue-600 py-3 font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
                    {t.landing.pilotForm.submitBtn}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} onAccept={sendRequest} busy={sending} error={sendError} />
    </PublicLayout>
  );
}
