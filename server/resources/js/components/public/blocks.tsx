import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowRight, ImageIcon } from 'lucide-react';
import ZoomableImage from '@/components/common/ZoomableImage';
import { useSite } from '@/hooks/use-site';

export type MockKind = 'dashboard' | 'kiosk' | 'operator' | 'phone' | 'report';

/** Wireframe drawn when the real screenshot is missing, so pages never show a broken image. */
function Wireframe({ kind, label }: { kind: MockKind; label: string }) {
  const cell = 'rounded-md bg-slate-800/80 border border-slate-700/70';
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 p-3 sm:p-4">
      {kind === 'phone' ? (
        <div className="mx-auto flex h-full w-[34%] min-w-[84px] flex-col rounded-2xl border-2 border-slate-600 bg-slate-900 p-1.5">
          <div className="flex-1 rounded-xl bg-slate-800/80" />
          <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-slate-600" />
        </div>
      ) : kind === 'kiosk' ? (
        <div className="grid h-full grid-cols-[1fr_28%] gap-2.5">
          <div className={`${cell} flex flex-col gap-2 p-3`}>
            <div className="h-2.5 w-2/3 rounded bg-slate-600" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-2 w-full rounded bg-slate-700/80" />
            ))}
            <div className="mt-auto grid grid-cols-2 gap-2">
              <div className="h-7 rounded bg-blue-600/60" />
              <div className="h-7 rounded bg-slate-700" />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className={`${cell} flex-1`} />
            <div className={`${cell} h-1/3`} />
          </div>
        </div>
      ) : kind === 'report' ? (
        <div className={`${cell} flex h-full flex-col gap-2 p-3`}>
          <div className="h-2.5 w-1/2 rounded bg-slate-600" />
          <div className="grid flex-1 grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded bg-slate-900/80" />
            ))}
          </div>
          <div className="h-2 w-3/4 rounded bg-emerald-700/60" />
        </div>
      ) : (
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-2.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`${cell} ${i === 1 ? 'border-red-500/70' : ''}`} />
          ))}
        </div>
      )}
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10.5px] font-medium text-slate-300">
        <ImageIcon className="size-3" /> {label}
      </span>
    </div>
  );
}

const CHROME_LABEL: Record<MockKind, [string, string]> = {
  dashboard: ['Bảng điều khiển giám thị', 'Proctor dashboard'],
  kiosk: ['Màn hình làm bài của thí sinh', 'Candidate exam screen'],
  operator: ['Giám sát trực tiếp phòng thi', 'Live room monitoring'],
  phone: ['Camera phụ trên điện thoại', 'Secondary phone camera'],
  report: ['Biên bản vi phạm có bằng chứng', 'Evidence-backed violation report'],
};

/** Window-framed screenshot (zoomable). The image comes from the white-label settings (`media.<kind>`). */
export function Mockup({ kind, srcKey, className = '', caption = true }: { kind: MockKind; srcKey?: string; className?: string; caption?: boolean }) {
  const { get, lang } = useSite();
  const src = get(srcKey ?? `media.${kind}`) || (srcKey ? get(`media.${kind}`) : '');
  const [failed, setFailed] = useState(false);
  const title = CHROME_LABEL[kind][lang === 'vi' ? 0 : 1];

  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-900/20">
        <div className="flex items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-3.5 py-2.5">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-amber-500/80" />
          <span className="size-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 truncate font-mono text-[11px] text-slate-400">{title}</span>
        </div>
        {src && !failed ? (
          <ZoomableImage
            key={src}
            src={src}
            alt={title}
            hintText={lang === 'vi' ? 'Xem ảnh lớn' : 'Click to zoom'}
            onError={() => setFailed(true)}
            className="block h-auto w-full"
            containerClassName="!rounded-none"
          />
        ) : (
          <Wireframe kind={kind} label={lang === 'vi' ? 'Ảnh minh hoạ' : 'Illustration'} />
        )}
      </div>
      {caption && <figcaption className="mt-3 text-center text-[13px] font-medium text-slate-500">{title}</figcaption>}
    </figure>
  );
}

export function SectionHead({
  eyebrow,
  title,
  desc,
  tone = 'light',
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      {eyebrow && (
        <div className={`mb-3 text-[12px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-blue-300' : 'text-blue-600'}`}>{eyebrow}</div>
      )}
      <h2 className={`text-[26px] font-extrabold leading-tight tracking-tight sm:text-[36px] ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
      {desc && <p className={`mt-3.5 text-[15px] leading-relaxed sm:text-base ${dark ? 'text-blue-100/90' : 'text-slate-600'}`}>{desc}</p>}
    </div>
  );
}

/** Four screenshots in a row of cards: the "see the product" strip reused on several pages. */
export function ScreenGallery({ kinds = ['operator', 'kiosk', 'phone', 'report'] }: { kinds?: MockKind[] }) {
  const { lang } = useSite();
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={lang === 'vi' ? 'Giao diện thực tế' : 'Product tour'}
          title={lang === 'vi' ? 'Một hệ thống, bốn góc nhìn' : 'One system, four perspectives'}
          desc={
            lang === 'vi'
              ? 'Từ màn hình thí sinh, camera phụ, phòng giám sát đến biên bản bằng chứng, mọi bước đều được thiết kế để giảng viên và hội đồng dễ theo dõi.'
              : 'From the candidate screen and phone camera to the live room and the evidence report, every step is designed to be easy for lecturers and committees to follow.'
          }
        />
        <div className="grid gap-8 md:grid-cols-2">
          {kinds.map((k) => (
            <Mockup key={k} kind={k} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ title, desc, primary, secondary }: { title: string; desc?: string; primary: { label: string; href: string }; secondary?: { label: string; href: string } }) {
  return (
    <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-[900px] px-4 text-center sm:px-6">
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h2>
        {desc && <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-blue-100">{desc}</p>}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={primary.href} className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[14.5px] font-bold text-blue-800 shadow-lg transition hover:bg-blue-50">
            {primary.label} <ArrowRight className="size-4" />
          </Link>
          {secondary && (
            <Link href={secondary.href} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3.5 text-[14.5px] font-bold text-white transition hover:bg-white/10">
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
