import { useEffect, useRef, useState } from 'react';

/**
 * Progressive rendering for long lists: show `step` rows first and reveal the next batch when the
 * sentinel at the bottom of the scroll container comes into view.
 *
 *   const more = useMore(rows.length, 40, [filter]);
 *   rows.slice(0, more.count).map(...)   <div ref={more.sentinel} />
 */
export function useMore(total: number, step = 40, resetOn: unknown[] = []) {
  const [count, setCount] = useState(step);
  const sentinel = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setCount(step), resetOn);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= total) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setCount((c) => c + step), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [count, total, step]);

  return { count: Math.min(count, total), sentinel, hasMore: count < total };
}
