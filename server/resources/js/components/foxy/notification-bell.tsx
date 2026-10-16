import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from './domain';

interface Item {
  id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  at: string | null;
}

function xsrf(): string {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * The bell: loaded once when the page opens and again when the window regains focus or the menu is opened
 * (there is no push channel to staff pages, and a timer would only burn requests).
 */
export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/notifications', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data ?? []);
      setUnread(json.unread ?? 0);
    } catch {
      /* the bell is a convenience */
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const markRead = async (ids?: number[]) => {
    await fetch('/notifications/read', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ ids }),
    }).catch(() => undefined);
    void load();
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Thông báo"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-muted"
      >
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute right-[7px] top-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-semibold">
            Thông báo
            {unread > 0 && (
              <button type="button" className="text-xs font-normal text-muted-foreground hover:text-foreground" onClick={() => void markRead()}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <div className="px-4 py-8 text-center text-xs text-muted-foreground">Chưa có thông báo nào.</div>}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  void markRead([n.id]);
                  setOpen(false);
                  if (n.url) router.visit(n.url);
                }}
                className={cn('flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-surface', !n.read && 'bg-primary/5')}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-danger" />}
                  {n.title}
                </span>
                {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[11px] text-muted-foreground/70">{n.at ? timeAgo(n.at) : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
