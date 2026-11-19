import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const KEY = 'examguard_cookie_consent';
export type CookieChoice = 'all' | 'essential';

/** Bottom-left consent card. The choice is kept in localStorage; analytics code (if added later) must check it. */
export default function CookieConsent() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(!localStorage.getItem(KEY));
    } catch {
      setOpen(false);
    }
  }, []);

  const choose = (c: CookieChoice) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ choice: c, at: new Date().toISOString() }));
    } catch {
      /* storage blocked: the card simply shows again next visit */
    }
    setOpen(false);
  };

  if (!open) return null;
  const vi = lang === 'vi';

  return (
    <div role="dialog" aria-label={vi ? 'Thông báo cookie' : 'Cookie notice'} className="fixed bottom-4 left-4 right-4 z-[60] sm:right-auto sm:max-w-[400px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/15">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Cookie className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[14.5px] font-bold text-slate-900">{vi ? 'Chúng tôi sử dụng cookie' : 'We use cookies'}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              {vi
                ? 'Cookie thiết yếu giúp trang hoạt động (ngôn ngữ, phiên đăng nhập). Cookie phân tích giúp chúng tôi cải thiện nội dung và chỉ bật khi bạn đồng ý.'
                : 'Essential cookies keep the site working (language, sign-in session). Analytics cookies help us improve content and are only enabled with your consent.'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2.5">
          <button type="button" onClick={() => choose('essential')} className="flex-1 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50">
            {vi ? 'Chỉ cần thiết' : 'Essential only'}
          </button>
          <button type="button" onClick={() => choose('all')} className="flex-1 cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-[13px] font-bold text-white transition hover:bg-blue-700">
            {vi ? 'Chấp nhận tất cả' : 'Accept all'}
          </button>
        </div>
      </div>
    </div>
  );
}
