import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Activity, RefreshCw } from 'lucide-react';
import { FxButton, Panel, Tip } from './ui';
import { cn } from '@/lib/utils';

interface HeatmapRow {
  attempt_id: number;
  name: string;
  status: string;
  cells: number[];
  violations: number[];
  unusual: boolean[];
}
interface Heatmap {
  bucket_seconds: number;
  start: string | null;
  columns: number;
  max: number;
  rows: HeatmapRow[];
}

const hhmm = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * Candidates x time of the exam: how much each one typed / clicked in every time slot, where the violations fell, and
 * which slots were unusually busy compared with the room (a hint to look, not a verdict).
 */
export function ActivityHeatmap({ examId, live }: { examId: number; live?: boolean }) {
  const [data, setData] = useState<Heatmap | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/admin/exams/${examId}/heatmap.json`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (res.ok) setData(await res.json());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    if (!live) return;
    const t = window.setInterval(() => void load(), 60_000); // one column is at least a minute
    return () => window.clearInterval(t);
  }, [examId, live]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || data.rows.length === 0 || data.columns === 0) return null;
  const start = data.start ? new Date(data.start) : null;
  const colTime = (c: number) => (start ? new Date(start.getTime() + c * data.bucket_seconds * 1000) : null);
  const ticks = [0, Math.floor(data.columns / 2), data.columns - 1];

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Activity className="size-4" />
        <span className="font-semibold">Mức độ thao tác theo thời gian</span>
        <Tip>
          Mỗi ô là số lần gõ phím và nhấp chuột của thí sinh trong {data.bucket_seconds / 60} phút. Màu càng đậm càng nhiều thao tác. Ô viền vàng là
          lúc thao tác nhiều bất thường so với cả phòng hoặc so với chính thí sinh đó; chấm đỏ là có vi phạm. Đây chỉ là gợi ý để xem lại, không phải kết luận.
        </Tip>
        <div className="flex-1" />
        <FxButton size="sm" icon={RefreshCw} disabled={busy} onClick={() => void load()}>
          Làm mới
        </FxButton>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {data.rows.map((r) => (
            <button
              key={r.attempt_id}
              type="button"
              onClick={() => router.visit(`/admin/attempts/${r.attempt_id}`)}
              className="group flex w-full cursor-pointer items-center gap-2 py-[2px] text-left"
            >
              <span className="w-36 shrink-0 truncate text-xs text-muted-foreground group-hover:text-foreground">{r.name}</span>
              <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: `repeat(${data.columns}, minmax(0, 1fr))` }}>
                {r.cells.map((v, c) => {
                  const t = colTime(c);
                  return (
                    <span
                      key={c}
                      title={`${t ? hhmm(t) : ''} · ${v} thao tác${r.violations[c] ? ` · ${r.violations[c]} vi phạm` : ''}${r.unusual[c] ? ' · bất thường' : ''}`}
                      className={cn('relative h-4 rounded-[3px] bg-muted', r.unusual[c] && 'ring-2 ring-warning')}
                    >
                      {v > 0 && <span className="absolute inset-0 rounded-[3px] bg-primary" style={{ opacity: 0.15 + 0.85 * Math.min(1, v / Math.max(1, data.max)) }} />}
                      {r.violations[c] > 0 && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-danger" />}
                    </span>
                  );
                })}
              </div>
            </button>
          ))}
          <div className="mt-1 flex items-center gap-2">
            <span className="w-36 shrink-0" />
            <div className="flex flex-1 justify-between font-mono text-[10px] text-muted-foreground">
              {ticks.map((c) => {
                const t = colTime(c);
                return <span key={c}>{t ? hhmm(t) : ''}</span>;
              })}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
