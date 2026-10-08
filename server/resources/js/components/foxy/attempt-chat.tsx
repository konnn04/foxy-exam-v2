import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { FxButton } from './ui';
import { hhmmss } from './domain';
import { cn } from '@/lib/utils';

interface Message {
  id: number;
  role: 'PROCTOR' | 'STUDENT';
  name: string | null;
  body: string;
  at: string | null;
}

function xsrf(): string {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Chat of one attempt, proctor side. History is fetched once and then only when `signal` (the hub's newest chat id for
 * the attempt) moves past what is already shown, so there is no polling.
 */
export function AttemptChat({ attemptId, signal, canSend = true, className }: { attemptId: number; signal?: number; canSend?: boolean; className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastId = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
      lastId.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/admin/attempts/${attemptId}/chat?after=${lastId.current}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (res.ok) merge((await res.json()).data ?? []);
    } catch {
      /* the next signal retries */
    }
  }, [attemptId, merge]);

  useEffect(() => {
    lastId.current = 0;
    setMessages([]);
    load();
  }, [attemptId, load]);

  useEffect(() => {
    if (signal && signal > lastId.current) load();
  }, [signal, load]);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/admin/attempts/${attemptId}/chat`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        merge([json.data]);
        setText('');
      } else {
        setError(json.message ?? 'Không gửi được tin nhắn.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div ref={box} className="flex h-64 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface/40 p-2.5">
        {messages.length === 0 && <div className="m-auto text-xs text-muted-foreground">Chưa có tin nhắn. Mọi tin nhắn đều được lưu lại làm bằng chứng.</div>}
        {messages.map((m) => (
          <div key={m.id} className={cn('max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px]', m.role === 'PROCTOR' ? 'self-end bg-primary/15' : 'self-start bg-card ring-1 ring-border')}>
            <div className="whitespace-pre-wrap break-words">{m.body}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {m.role === 'PROCTOR' ? (m.name ?? 'Giám thị') : 'Thí sinh'} · {hhmmss(m.at)}
            </div>
          </div>
        ))}
      </div>
      {error && <div className="text-xs text-danger-fg">{error}</div>}
      {canSend ? (
        <div className="flex gap-2">
          <input
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Nhắn cho thí sinh…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-primary"
          />
          <FxButton variant="primary" icon={Send} onClick={send} disabled={busy || !text.trim()}>
            Gửi
          </FxButton>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Phiên thi đã kết thúc, không gửi thêm được.</div>
      )}
    </div>
  );
}
