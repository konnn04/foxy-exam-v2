import React from 'react';
import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FxButton } from './ui';

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
  prev_page_url: string | null;
  next_page_url: string | null;
}

/** Prev / next for a Laravel paginator (the filters are already in its URLs through withQueryString). */
export function Pager<T>({ page }: { page: Paginated<T> }) {
  if (page.last_page <= 1) {
    return page.total > 0 ? <div className="px-1 text-xs text-muted-foreground">{page.total} mục</div> : null;
  }
  const go = (url: string | null) => url && router.visit(url, { preserveScroll: true, preserveState: true });

  return (
    <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
      <span>
        {page.from}–{page.to} / {page.total}
      </span>
      <div className="flex items-center gap-2">
        <FxButton size="sm" icon={ChevronLeft} disabled={!page.prev_page_url} onClick={() => go(page.prev_page_url)}>
          Trước
        </FxButton>
        <span className="tabular-nums">
          {page.current_page} / {page.last_page}
        </span>
        <FxButton size="sm" icon={ChevronRight} disabled={!page.next_page_url} onClick={() => go(page.next_page_url)}>
          Sau
        </FxButton>
      </div>
    </div>
  );
}
