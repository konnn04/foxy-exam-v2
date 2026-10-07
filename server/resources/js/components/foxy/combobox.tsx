import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ComboItem {
  value: number | string;
  label: string;
  hint?: string;
  right?: ReactNode;
}

/**
 * Searchable single select. Use it for any list that can grow (question sets, courses, people):
 * a plain <select> turns into endless scrolling once there are hundreds of entries.
 */
export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Chọn…',
  empty = 'Không có kết quả',
  invalid,
}: {
  items: ComboItem[];
  value: number | string | null | undefined;
  onChange: (v: ComboItem) => void;
  placeholder?: string;
  empty?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.value === value);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? items.filter((i) => `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(needle)) : items;
    return list.slice(0, 200);
  }, [items, q]);

  useEffect(() => setActive(0), [q, open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const pick = (i: ComboItem) => {
    onChange(i);
    setOpen(false);
    setQ('');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-left text-sm outline-none focus-visible:border-primary',
          invalid ? 'border-danger' : 'border-border',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-muted-foreground')}>
          {selected ? (
            <>
              {selected.hint && <span className="mr-2 font-mono text-xs text-muted-foreground">{selected.hint}</span>}
              {selected.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-3.5 opacity-60" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Tìm kiếm…"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 && <div className="px-3 py-3 text-center text-xs text-muted-foreground">{empty}</div>}
            {shown.map((i, idx) => (
              <button
                key={i.value}
                type="button"
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(i)}
                className={cn('flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm', idx === active && 'bg-muted')}
              >
                <Check className={cn('size-3.5 shrink-0', i.value === value ? 'opacity-100' : 'opacity-0')} />
                {i.hint && <span className="font-mono text-xs text-muted-foreground">{i.hint}</span>}
                <span className="min-w-0 flex-1 truncate">{i.label}</span>
                {i.right}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
