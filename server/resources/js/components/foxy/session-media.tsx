import { ExternalLink, Image as ImageIcon, Monitor, Video } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { FeedPlaceholder } from '@/components/foxy/ui';
import { useAttemptRecordings, type RecordingInfo } from '@/hooks/use-recordings';
import { formatDateTime } from '@/lib/datetime';

const LEAD_IN_S = 3;

function pick(list: RecordingInfo[], at: number | null): RecordingInfo | null {
  if (list.length === 0) return null;
  if (at !== null) {
    const hit = list.find((r) => r.started_at && at >= r.started_at && (!r.ended_at || at <= r.ended_at + 2000));
    if (hit) return hit;
  }
  return list[0];
}

function Player({ rec, at, label, icon: Icon }: { rec: RecordingInfo | null; at: number | null; label: string; icon: typeof Video }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !rec?.started_at || at === null) return;
    const to = Math.max(0, (at - rec.started_at) / 1000 - LEAD_IN_S);
    const seek = () => {
      el.currentTime = to;
    };
    if (el.readyState >= 1) seek();
    else el.addEventListener('loadedmetadata', seek, { once: true });
  }, [rec?.id, rec?.started_at, at]);

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-black">
      {rec?.url ? (
        <div className="relative">
          <video ref={ref} src={rec.url} controls preload="metadata" className="aspect-[16/10] w-full bg-black object-contain" />
          <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-2 py-[3px] text-xs font-semibold text-white">
            <Icon className="size-3" />
            {label}
          </span>
        </div>
      ) : (
        <FeedPlaceholder label={rec ? (rec.status === 'recording' ? 'đang ghi…' : 'bản ghi chưa sẵn sàng') : 'không có bản ghi'}>
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-2 py-[3px] text-xs font-semibold text-white">
            <Icon className="size-3" />
            {label}
          </span>
        </FeedPlaceholder>
      )}
    </div>
  );
}

/** Session video (camera + screen) that jumps to the selected violation, and the picture taken at that moment. */
export function SessionMedia({ examId, attemptId, at, evidenceId }: { examId: number; attemptId: number; at: string | null; evidenceId: string | null }) {
  const { items, state } = useAttemptRecordings(examId, attemptId);
  const atMs = at ? new Date(at).getTime() : null;

  const byKind = useMemo(() => {
    const ready = items.filter((r) => r.status === 'ready' || r.status === 'recording');
    const sort = (k: string) => ready.filter((r) => r.kind === k).sort((a, b) => (a.started_at ?? a.created_at) - (b.started_at ?? b.created_at));
    return { camera: sort('camera'), screen: sort('screen') };
  }, [items]);
  const evidence = items.find((r) => r.id === evidenceId && r.url);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <Player rec={pick(byKind.camera, atMs)} at={atMs} label="Camera" icon={Video} />
        <Player rec={pick(byKind.screen, atMs)} at={atMs} label="Màn hình" icon={Monitor} />
      </div>
      {state === 'disabled' && <div className="text-xs text-muted-foreground">Hệ thống ghi hình chưa được bật.</div>}
      {state === 'error' && <div className="text-xs text-danger-fg">Không tải được bản ghi của phiên này.</div>}
      {evidence && (
        <a href={evidence.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-[10px] border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" />
            Ảnh minh chứng lúc vi phạm · {formatDateTime(evidence.created_at)}
            <ExternalLink className="ml-auto size-3 opacity-60 group-hover:opacity-100" />
          </div>
          <img src={evidence.url} alt="Minh chứng vi phạm" className="max-h-[360px] w-full bg-black object-contain" />
        </a>
      )}
    </div>
  );
}
