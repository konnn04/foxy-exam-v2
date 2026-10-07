import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react';
import { EmptyState, FxSelect, IconButton, Panel } from './ui';
import { cn } from '@/lib/utils';

export interface FxColumn<T> {
  key: string;
  label: React.ReactNode;
  /** CSS grid track, e.g. "minmax(220px,2fr)" or "110px". */
  width: string;
  render: (row: T) => React.ReactNode;
  align?: 'right';
}

export interface FxFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Client mode only. In server mode the filter `key` is sent as the query parameter. */
  test?: (row: T, value: string) => boolean;
}

/** Server-side paging for lists that can grow to thousands of rows. */
export interface FxServerMode {
  total: number;
  page: number;
  lastPage: number;
  perPage: number;
  /** Current query values echoed by the server (q + one entry per filter key). */
  values: Record<string, string>;
  onQuery: (params: Record<string, string | number | undefined>) => void;
}

/** Reload only `only` props of the current page with new query params (search/filter/page). */
export function useServerQuery(only: string[]) {
  return (params: Record<string, string | number | undefined>) => {
    const url = new URL(window.location.href);
    const current = Object.fromEntries(url.searchParams.entries());
    const merged: Record<string, string | number> = { ...current };
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === 'ALL') delete merged[k];
      else merged[k] = v;
    });
    router.get(url.pathname, merged, { only, preserveState: true, preserveScroll: true, replace: true });
  };
}

/**
 * The list layout from the design (bảng Tổ chức): search + dashed filters,
 * bordered grid table with checkbox column, row actions and pagination.
 */
export function FxList<T extends { id: number }>({
  rows,
  columns,
  searchText,
  searchPlaceholder = 'Tìm kiếm…',
  filters = [],
  onRowClick,
  actions,
  empty,
  bulk,
  toolbarExtra,
  minWidth = 860,
  pageSizes = [10, 20, 50],
  actionsWidth = '104px',
  server,
}: {
  rows: T[];
  columns: FxColumn<T>[];
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FxFilter<T>[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  empty: { icon: LucideIcon; title: string; desc?: string; action?: React.ReactNode };
  bulk?: (ids: number[], clear: () => void) => React.ReactNode;
  toolbarExtra?: React.ReactNode;
  minWidth?: number;
  pageSizes?: number[];
  /** Fixed track for the row-actions column so header and rows line up. */
  actionsWidth?: string;
  server?: FxServerMode;
}) {
  const [q, setQ] = useState(server?.values.q ?? '');
  const [fv, setFv] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(server?.perPage ?? pageSizes[0]);

  // server mode: debounce the search box, everything else goes straight to the query
  const firstRender = useRef(true);
  useEffect(() => {
    if (!server) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => server.onQuery({ q: q.trim(), page: 1 }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    if (server) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) => (!s || searchText(r).toLowerCase().includes(s)) && filters.every((f) => !fv[f.key] || fv[f.key] === 'ALL' || f.test?.(r, fv[f.key]) !== false),
    );
  }, [rows, q, fv, filters, searchText, server]);

  const total = server ? server.total : filtered.length;
  const pages = server ? Math.max(1, server.lastPage) : Math.max(1, Math.ceil(filtered.length / size));
  const cur = server ? server.page : Math.min(page, pages);
  const visible = server ? rows : filtered.slice((cur - 1) * size, cur * size);
  const fvalue = (key: string) => (server ? server.values[key] || 'ALL' : fv[key] ?? 'ALL');
  const gotoPage = (n: number) => (server ? server.onQuery({ page: n }) : setPage(n));
  // column widths the user dragged (px); untouched columns keep their CSS track. Remembered per column set.
  const storeKey = `foxy:cols:${columns.map((c) => c.key).join(',')}`;
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? '{}');
    } catch {
      return {};
    }
  });
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const startResize = (key: string, e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = e.currentTarget.parentElement as HTMLElement;
    const from = cell.getBoundingClientRect().width;
    const x0 = e.clientX;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const move = (m: PointerEvent) => setWidths((w) => ({ ...w, [key]: Math.max(60, Math.round(from + m.clientX - x0)) }));
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      try {
        localStorage.setItem(storeKey, JSON.stringify(widthsRef.current));
      } catch {
        /* only a convenience */
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  const resetWidth = (key: string) =>
    setWidths((w) => {
      const { [key]: _drop, ...rest } = w;
      try {
        localStorage.setItem(storeKey, JSON.stringify(rest));
      } catch {
        /* only a convenience */
      }
      return rest;
    });
  const grid = ['40px', ...columns.map((c) => (widths[c.key] ? `${widths[c.key]}px` : c.width)), ...(actions ? [actionsWidth] : [])].join(' ');
  const allOn = visible.length > 0 && visible.every((r) => selected.includes(r.id));

  return (
    <Panel padded={false} className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-[300px] max-w-full items-center gap-2 rounded-lg border border-border px-2.5 text-muted-foreground focus-within:border-primary">
          <Search className="size-4 opacity-60" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!server) setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {filters.map((f) => (
          <FxSelect
            key={f.key}
            value={fvalue(f.key)}
            onChange={(e) => {
              if (server) return server.onQuery({ [f.key]: e.target.value, page: 1 });
              setFv({ ...fv, [f.key]: e.target.value });
              setPage(1);
            }}
            className={cn('w-auto border-dashed', fvalue(f.key) !== 'ALL' && 'border-solid border-primary text-brand-fg')}
          >
            <option value="ALL">{f.label}: tất cả</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FxSelect>
        ))}
        <div className="flex-1" />
        {selected.length > 0 && bulk?.(selected, () => setSelected([]))}
        {toolbarExtra}
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <div style={{ minWidth }}>
          <div className="grid h-10 items-center gap-3 border-b border-border px-2 text-[13px] font-medium text-muted-foreground" style={{ gridTemplateColumns: grid }}>
            <Check on={allOn} onClick={() => setSelected((s) => (allOn ? s.filter((id) => !visible.some((r) => r.id === id)) : [...new Set([...s, ...visible.map((r) => r.id)])]))} />
            {columns.map((c) => (
              <span key={c.key} className={cn('relative min-w-0 select-none truncate', c.align === 'right' && 'text-right')}>
                {c.label}
                <span
                  role="separator"
                  title="Kéo để đổi độ rộng cột (nhấp đúp để đặt lại)"
                  onPointerDown={(e) => startResize(c.key, e)}
                  onDoubleClick={() => resetWidth(c.key)}
                  className="absolute -right-2 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize rounded-sm hover:bg-primary/40"
                />
              </span>
            ))}
            {actions && <span />}
          </div>
          {visible.length === 0 ? (
            <EmptyState {...empty} />
          ) : (
            visible.map((r) => (
              <div
                key={r.id}
                onClick={() => onRowClick?.(r)}
                className={cn('grid min-h-14 items-center gap-3 border-b border-border px-2 text-sm last:border-b-0 hover:bg-surface/60', onRowClick && 'cursor-pointer')}
                style={{ gridTemplateColumns: grid }}
              >
                <Check
                  on={selected.includes(r.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]));
                  }}
                />
                {columns.map((c) => (
                  <div key={c.key} className={cn('min-w-0 overflow-hidden', c.align === 'right' && 'text-right')}>
                    {c.render(r)}
                  </div>
                ))}
                {actions && (
                  <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {actions(r)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>
          Đã chọn {selected.length} / {total.toLocaleString('en')}
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            Số dòng
            <FxSelect
              value={size}
              onChange={(e) => {
                const n = Number(e.target.value);
                setSize(n);
                if (server) return server.onQuery({ per: n, page: 1 });
                setPage(1);
              }}
              className="h-8 w-16"
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </FxSelect>
          </span>
          <span className="text-foreground">
            Trang {cur} / {pages}
          </span>
          <div className="flex gap-1">
            <IconButton icon={ChevronLeft} label="Trang trước" disabled={cur <= 1} onClick={() => gotoPage(cur - 1)} className="size-8 border border-border disabled:opacity-50" />
            <IconButton icon={ChevronRight} label="Trang sau" disabled={cur >= pages} onClick={() => gotoPage(cur + 1)} className="size-8 border border-border disabled:opacity-50" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Check({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn('flex size-4 cursor-pointer items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/30')}
    >
      {on && <span className="text-[10px] leading-none">✓</span>}
    </button>
  );
}

/** Code chip + name + subtitle, the first column of most tables. */
export function NameCell({ code, name, sub, onClick }: { code?: string; name: React.ReactNode; sub?: React.ReactNode; onClick?: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5" onClick={onClick}>
      {code !== undefined && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted px-0.5 text-[10px] font-bold">{code.slice(0, 4)}</div>
      )}
      <div className="min-w-0">
        <div className="truncate font-medium">{name}</div>
        {sub && <div className="truncate font-mono text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}
