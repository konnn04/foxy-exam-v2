import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { ArrowUp, CheckCircle2, Loader2, Mail, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useSite } from '@/hooks/use-site';
import { DEFAULT_TERMS, hashText } from '@/constants/terms';
import TermsModal from '@/components/public/TermsModal';

type Prefill = Partial<Record<'name' | 'organization' | 'email' | 'phone' | 'plan' | 'scale' | 'message', string>>;

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  /** the assistant opened the contact form in this message */
  form?: { prefill: Prefill; sent?: boolean };
  error?: boolean;
}

const STORE = 'foxy:landing-chat';
const xsrf = () => decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? '');

/** Bold, links ([text](url), bare https:// and /paths) and "- " bullets, rendered as React nodes (never as HTML). */
function Rich({ text }: { text: string }) {
  const inline = (line: string, key: string) => {
    const out: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)|(https?:\/\/[^\s)]+|(?<![\w/])\/(?:pricing|features|download|about|biometric-policy|#tu-van)\b)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push(line.slice(last, m.index));
      if (m[1]) out.push(<strong key={`${key}-${m.index}`}>{m[1]}</strong>);
      else {
        const href = m[3] ?? m[4];
        out.push(
          <a key={`${key}-${m.index}`} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="font-medium text-blue-600 underline underline-offset-2">
            {m[2] ?? href}
          </a>,
        );
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((l, i) =>
        /^\s*[-*•]\s+/.test(l) ? (
          <div key={i} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current opacity-60" />
            <span>{inline(l.replace(/^\s*[-*•]\s+/, ''), `l${i}`)}</span>
          </div>
        ) : l.trim() ? (
          <p key={i}>{inline(l, `l${i}`)}</p>
        ) : null,
      )}
    </div>
  );
}

/** The contact form the assistant opens, pre-filled with what it learned. Sent only by the visitor, after the terms. */
function ContactCard({ prefill, sent, onSent }: { prefill: Prefill; sent?: boolean; onSent: () => void }) {
  const site = useSite();
  const vi = site.lang === 'vi';
  const [f, setF] = useState<Prefill>(prefill);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Prefill) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const missing = !f.name?.trim() || !f.email?.trim() || !f.phone?.trim();

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/pilot-requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          ...f,
          source: 'chat',
          locale: site.lang,
          terms_accepted: true,
          terms_hash: await hashText(site.text('legal.terms', DEFAULT_TERMS[site.lang])),
        }),
      });
      if (res.status === 422) throw new Error(vi ? 'Email hoặc số điện thoại chưa hợp lệ.' : 'Please check the email and phone number.');
      if (!res.ok) throw new Error(vi ? 'Chưa gửi được, thử lại sau ít phút.' : 'Could not send, please try again shortly.');
      setTerms(false);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
        <CheckCircle2 className="size-4 shrink-0" />
        {vi ? 'Đã gửi. Đội ngũ tư vấn sẽ liên hệ với thầy cô.' : 'Sent. Our team will get in touch.'}
      </div>
    );
  }

  const input = 'h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input className={input} value={f.name ?? ''} onChange={set('name')} placeholder={vi ? 'Họ tên *' : 'Full name *'} aria-label={vi ? 'Họ tên' : 'Full name'} />
        <input className={input} value={f.organization ?? ''} onChange={set('organization')} placeholder={vi ? 'Trường / đơn vị' : 'Organization'} aria-label={vi ? 'Đơn vị' : 'Organization'} />
        <input className={input} type="email" value={f.email ?? ''} onChange={set('email')} placeholder="Email *" aria-label="Email" />
        <input className={input} type="tel" value={f.phone ?? ''} onChange={set('phone')} placeholder={vi ? 'Số điện thoại *' : 'Phone *'} aria-label={vi ? 'Số điện thoại' : 'Phone'} />
        <input className={input} value={f.plan ?? ''} onChange={set('plan')} placeholder={vi ? 'Gói quan tâm' : 'Plan'} aria-label={vi ? 'Gói quan tâm' : 'Plan'} />
        <input className={input} value={f.scale ?? ''} onChange={set('scale')} placeholder={vi ? 'Số thí sinh / kỳ thi' : 'Candidates per exam'} aria-label={vi ? 'Quy mô' : 'Scale'} />
      </div>
      <textarea
        className={`${input} h-16 resize-none py-2`}
        value={f.message ?? ''}
        onChange={set('message')}
        maxLength={1000}
        placeholder={vi ? 'Nhu cầu (tuỳ chọn)' : 'What you need (optional)'}
        aria-label={vi ? 'Nhu cầu' : 'Needs'}
      />
      {error && !terms && <p className="text-[12px] text-red-600">{error}</p>}
      <button
        type="button"
        disabled={missing || busy}
        onClick={() => setTerms(true)}
        className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="size-3.5" /> {vi ? 'Xem điều khoản và gửi' : 'Review terms and send'}
      </button>
      <TermsModal open={terms} onClose={() => setTerms(false)} onAccept={() => void send()} busy={busy} error={error} />
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const site = useSite();
  const vi = site.lang === 'vi';
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as Msg[];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30)));
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs]);
  useEffect(() => field.current?.focus(), []);

  const patchLast = (fn: (m: Msg) => Msg) => setMsgs((list) => [...list.slice(0, -1), fn(list[list.length - 1])]);

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const history = [...msgs, { role: 'user' as const, content: q }];
      setMsgs([...history, { role: 'assistant', content: '' }]);
      setInput('');
      setBusy(true);
      try {
        const res = await fetch('/chat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({
            lang: site.lang,
            messages: history.filter((m) => m.content.trim() && !m.error).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
          }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(res.status === 429 && !body.message ? (vi ? 'Thầy cô hỏi hơi nhanh, đợi một chút rồi hỏi tiếp nhé.' : 'Too many questions, please wait a moment.') : body.message || (vi ? 'Trợ lý chưa trả lời được.' : 'The assistant is unavailable.'));
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, cut);
            buf = buf.slice(cut + 2);
            const event = block.match(/^event: (.+)$/m)?.[1];
            const raw = block.match(/^data: (.+)$/m)?.[1];
            if (!event || !raw) continue;
            const data = JSON.parse(raw);
            if (event === 'delta') patchLast((m) => ({ ...m, content: m.content + data.t }));
            else if (event === 'action' && data.type === 'contact_form') patchLast((m) => ({ ...m, form: { prefill: data.prefill ?? {} } }));
            else if (event === 'error') patchLast((m) => ({ ...m, content: data.message, error: true }));
          }
        }
      } catch (e) {
        patchLast((m) => ({ ...m, content: e instanceof Error ? e.message : String(e), error: true }));
      } finally {
        setBusy(false);
      }
    },
    [busy, msgs, site.lang, vi],
  );

  const markSent = (index: number) =>
    setMsgs((list) => [
      ...list.map((m, i) => (i === index && m.form ? { ...m, form: { ...m.form, sent: true } } : m)),
      { role: 'assistant', content: vi ? 'Đã nhận thông tin của thầy cô. Đội ngũ tư vấn sẽ liên hệ sớm.' : 'Thank you, our team will contact you soon.' },
    ]);

  const suggestions = vi
    ? ['Bảng giá các gói', 'Hệ thống chống gian lận thế nào?', 'Thí sinh cần chuẩn bị gì?', 'Đăng ký dùng thử']
    : ['Pricing plans', 'How is cheating prevented?', 'What do candidates need?', 'Request a trial'];

  return (
    <div
      role="dialog"
      aria-label={vi ? 'Trợ lý tư vấn' : 'Assistant'}
      className="fixed inset-0 z-[55] flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(600px,calc(100dvh-8rem))] sm:w-[380px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-slate-900">{vi ? 'Trợ lý tư vấn' : 'Assistant'}</div>
          <div className="text-[11.5px] text-slate-500">{vi ? 'Trả lời tự động bằng AI, có thể chưa chính xác' : 'AI answers, may be inaccurate'}</div>
        </div>
        {msgs.length > 0 && (
          <button type="button" onClick={() => setMsgs([])} disabled={busy} aria-label={vi ? 'Cuộc trò chuyện mới' : 'New conversation'} title={vi ? 'Cuộc trò chuyện mới' : 'New conversation'} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <RotateCcw className="size-4" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label={vi ? 'Đóng' : 'Close'} className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <X className="size-4" />
        </button>
      </div>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[13.5px] leading-relaxed" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-2.5 text-slate-800">
              {vi ? 'Xin chào thầy cô. Em có thể giải đáp về tính năng, bảng giá, cách triển khai, hoặc giúp đăng ký dùng thử.' : 'Hello. I can answer questions about features, pricing and deployment, or help you request a trial.'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => void ask(s)} className="cursor-pointer rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12.5px] font-medium text-blue-700 hover:bg-blue-100">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-blue-600 px-3.5 py-2.5 whitespace-pre-wrap text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="max-w-[92%]">
              {m.content ? (
                <div className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 ${m.error ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-800'}`}>
                  <Rich text={m.content} />
                </div>
              ) : (
                !m.form &&
                busy &&
                i === msgs.length - 1 && (
                  <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-3" aria-label={vi ? 'Đang trả lời' : 'Typing'}>
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                )
              )}
              {m.form && <ContactCard prefill={m.form.prefill} sent={m.form.sent} onSent={() => markSent(i)} />}
            </div>
          ),
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex items-end gap-2 border-t border-slate-200 p-3"
      >
        <textarea
          ref={field}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask(input);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={vi ? 'Nhập câu hỏi…' : 'Ask a question…'}
          aria-label={vi ? 'Câu hỏi' : 'Question'}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-[13.5px] outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label={vi ? 'Gửi' : 'Send'} className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  );
}

/** Bottom-right corner of the public site: back to top, Zalo, contact form, AI assistant. */
export default function ContactDock() {
  const site = useSite();
  const vi = site.lang === 'vi';
  const { url, props } = usePage();
  const chatAvailable = Boolean((props as { chatAvailable?: boolean }).chatAvailable);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 400);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const digits = site.get('contact.phone').replace(/\D/g, '');
  const zalo = site.get('contact.zalo') || (digits ? `https://zalo.me/${digits}` : '');

  const contact = () => {
    setOpen(false);
    if (url === '/' || url.startsWith('/#') || url.startsWith('/?')) document.getElementById('tu-van')?.scrollIntoView({ behavior: 'smooth' });
    else router.visit('/#tu-van');
  };

  const btn = 'group relative flex size-12 cursor-pointer items-center justify-center rounded-full shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4';
  const tip = (text: string) => (
    <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[12px] font-medium text-white opacity-0 transition group-hover:opacity-100 sm:block">{text}</span>
  );

  return (
    <>
      {open && chatAvailable && <ChatPanel onClose={() => setOpen(false)} />}
      <div className={`fixed right-4 bottom-4 z-50 flex flex-col items-center gap-3 sm:right-6 sm:bottom-6 ${open ? 'max-sm:hidden' : ''}`}>
        {scrolled && !open && (
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={vi ? 'Lên đầu trang' : 'Back to top'} className={`${btn} size-10 bg-white text-slate-600 ring-slate-300 hover:text-slate-900`}>
            <ArrowUp className="size-4" />
            {tip(vi ? 'Lên đầu trang' : 'Back to top')}
          </button>
        )}
        {zalo && (
          <a href={zalo} target="_blank" rel="noopener noreferrer" aria-label="Zalo" className={`${btn} bg-[#0068ff] text-[13px] font-black tracking-tight text-white ring-blue-300`}>
            Zalo
            {tip(vi ? 'Nhắn Zalo' : 'Chat on Zalo')}
          </a>
        )}
        <button type="button" onClick={contact} aria-label={vi ? 'Để lại thông tin liên hệ' : 'Contact form'} className={`${btn} bg-white text-blue-700 ring-blue-200`}>
          <Mail className="size-5" />
          {tip(vi ? 'Để lại thông tin liên hệ' : 'Contact form')}
        </button>
        {chatAvailable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={vi ? 'Trợ lý AI' : 'AI assistant'}
            className={`${btn} size-14 bg-blue-600 text-white ring-blue-300 hover:bg-blue-700`}
          >
            {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
            {!open && tip(vi ? 'Hỏi trợ lý AI' : 'Ask the AI assistant')}
          </button>
        )}
      </div>
    </>
  );
}
