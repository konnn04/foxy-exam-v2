import React from 'react';

/** Dark hero shared by the inner public pages: same visual language as the landing hero, but compact. */
export default function PageHero({
  icon: Icon,
  eyebrow,
  title,
  desc,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, #000 30%, transparent 80%)',
        }}
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[380px] w-[760px] -translate-x-1/2 rounded-full bg-blue-600/30 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 top-10 h-[260px] w-[360px] rounded-full bg-indigo-500/20 blur-[100px]" />

      <div className="relative mx-auto max-w-[1000px] px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-[12px] font-semibold tracking-wide text-blue-200">
          <Icon className="size-3.5 text-blue-300" />
          {eyebrow}
        </div>
        <h1 className="text-[30px] font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{title}</h1>
        {desc && <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-300 sm:text-[17px]">{desc}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
    </section>
  );
}
