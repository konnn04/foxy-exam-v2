import React from 'react';
import { Bell, Smartphone, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/** Stand-in for the proctor dashboard screenshot while the real image is not uploaded yet. */
export default function FakeDashboard({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className={`grid gap-3 p-3 sm:p-4 ${compact ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
      {/* Ô thí sinh 1: Bình thường */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-white">Lê Minh Khoa</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
            {t.landing.mockup.faceMatch}
          </span>
        </div>
        <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center relative">
          <Users className="w-8 h-8 text-slate-700" />
          <span className="absolute bottom-1.5 right-1.5 text-[9.5px] font-mono text-emerald-400 bg-black/70 px-1 rounded">
            {t.landing.mockup.secondCamOk}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex justify-between">
          <span>{t.landing.mockup.kioskLocked}</span>
          <span className="text-emerald-400">{t.landing.mockup.normalStatus}</span>
        </div>
      </div>

      {/* Ô thí sinh 2: Báo động vật cấm */}
      <div className="rounded-xl border-2 border-red-500 bg-red-950/20 p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Trần Thị Mai
          </span>
          <span className="text-[10px] text-red-400 font-bold bg-red-950/80 border border-red-800 px-1.5 py-0.5 rounded">
            {t.landing.mockup.bannedObject}
          </span>
        </div>
        <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center relative border border-red-500/40">
          <Users className="w-8 h-8 text-slate-700" />
          <div className="absolute bottom-2 left-2 border-2 border-red-500 bg-red-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-red-400" /> {t.landing.mockup.phoneDetected}
          </div>
          <span className="absolute top-1.5 right-1.5 text-[9px] font-mono text-white bg-red-600 px-1 rounded font-bold">
            {t.landing.mockup.videoReady}
          </span>
        </div>
        <div className="mt-2 text-[11px] flex justify-between items-center text-red-300 font-medium">
          <span>{t.landing.mockup.phoneDetected}</span>
          <span className="text-blue-400 font-bold underline cursor-pointer">{t.landing.mockup.viewAngles}</span>
        </div>
      </div>

      {/* Nhật ký sự kiện */}
      <div className={`rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 flex-col justify-between text-xs font-mono ${compact ? 'hidden' : 'flex'}`}>
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-slate-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-blue-400" /> {t.landing.mockup.autoLogTitle}
            </span>
            <span className="text-[10px] text-slate-500">{t.landing.mockup.realtimeBadge}</span>
          </div>
          <div className="space-y-2 text-[10.5px]">
            <div className="p-2 bg-red-950/40 border border-red-900/50 rounded text-slate-200">
              {t.landing.mockup.log1}
            </div>
            <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded text-slate-300">
              {t.landing.mockup.log2}
            </div>
            <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded text-slate-300">
              {t.landing.mockup.log3}
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-slate-800 text-[10.5px] text-slate-400 flex items-center justify-between">
          <span>{t.landing.mockup.roomStatusLabel}</span>
          <span className="text-emerald-400 font-bold">{t.landing.mockup.roomStatusGood}</span>
        </div>
      </div>
    </div>
  );
}
