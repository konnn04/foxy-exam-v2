import React, { useEffect, useState } from 'react';
import { ScrollText, X } from 'lucide-react';
import { useSite } from '@/hooks/use-site';
import { DEFAULT_TERMS } from '@/constants/terms';

/** Renders "## heading" lines and blank-line separated paragraphs of the admin-editable terms. */
function TermsBody({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-[13.5px] leading-relaxed text-slate-600">
      {text
        .split(/\n{2,}/)
        .flatMap((block) => block.split('\n'))
        .filter((l) => l.trim())
        .map((line, i) =>
          line.startsWith('## ') ? (
            <h4 key={i} className="pt-2 text-[14px] font-bold text-slate-900">
              {line.slice(3)}
            </h4>
          ) : (
            <p key={i}>{line}</p>
          ),
        )}
    </div>
  );
}

/** Must be accepted before a contact request is sent. */
export default function TermsModal({ open, onClose, onAccept, busy = false, error }: { open: boolean; onClose: () => void; onAccept: () => void; busy?: boolean; error?: string | null }) {
  const { text, lang } = useSite();
  const [agreed, setAgreed] = useState(false);
  const vi = lang === 'vi';

  useEffect(() => {
    if (!open) return;
    setAgreed(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ScrollText className="size-5" />
            </div>
            <div>
              <h3 id="terms-title" className="text-[17px] font-bold text-slate-900">
                {vi ? 'Điều khoản và chính sách dữ liệu' : 'Terms and data policy'}
              </h3>
              <p className="text-[12.5px] text-slate-500">{vi ? 'Vui lòng đọc trước khi gửi thông tin liên hệ' : 'Please read before sending your contact details'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={vi ? 'Đóng' : 'Close'} className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <TermsBody text={text('legal.terms', DEFAULT_TERMS[lang])} />
        </div>

        <div className="space-y-4 border-t border-slate-200 bg-slate-50 px-6 py-5">
          <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-slate-700">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 cursor-pointer accent-blue-600" />
            <span>{vi ? 'Tôi đã đọc và đồng ý với điều khoản, đồng ý để ban dự án xử lý thông tin của tôi nhằm liên hệ tư vấn.' : 'I have read and agree to the terms, and consent to the project team processing my details to contact me.'}</span>
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-100">
              {vi ? 'Huỷ' : 'Cancel'}
            </button>
            <button type="button" disabled={!agreed || busy} onClick={onAccept} className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? (vi ? 'Đang gửi…' : 'Sending…') : vi ? 'Đồng ý và gửi' : 'Agree and send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
