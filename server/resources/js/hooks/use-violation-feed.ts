import { useCallback, useEffect, useRef, useState } from 'react';

export interface FeedRow {
  id: number;
  attempt_id: number;
  type: string;
  severity: string;
  details: unknown;
  student_name: string;
  student_username?: string;
  timestamp: string | null;
  is_reviewed: boolean;
  is_false_positive: boolean;
}

export const FEED_PAGE = 40;

/**
 * Newest-first violation list of one exam. `head` is the server-rendered (and periodically refreshed)
 * first page; older pages are fetched by cursor when the sentinel at the bottom scrolls into view.
 */
export function useViolationFeed(examId: number, head: FeedRow[]) {
  const [older, setOlder] = useState<FeedRow[]>([]);
  const [hasMore, setHasMore] = useState(head.length >= FEED_PAGE);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const minHead = head.length ? Math.min(...head.map((r) => r.id)) : Infinity;
  const rows = [...head, ...older.filter((r) => r.id < minHead)];
  const cursor = rows.length ? rows[rows.length - 1].id : 0;

  const loadMore = useCallback(async () => {
    if (busy.current || !hasMore || !cursor) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/admin/exams/${examId}/violations?before=${cursor}&limit=${FEED_PAGE}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const json = await res.json();
      setOlder((prev) => [...prev, ...(json.data as FeedRow[])]);
      setHasMore(Boolean(json.has_more));
    } catch {
      setHasMore(false);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [examId, hasMore, cursor]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && void loadMore(), { rootMargin: '160px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore, rows.length]);

  return { rows, hasMore, loading, sentinel };
}
