import { ExternalLink, Image as ImageIcon, Monitor, Smartphone, Video } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { FeedPlaceholder } from '@/components/foxy/ui';
import { useAttemptRecordings, type RecordingInfo } from '@/hooks/use-recordings';

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
export function SessionMedia({
  examId,
  attemptId,
  at,
  evidenceId,
  evidence: evidenceSet,
  config,
}: {
  examId: number;
  attemptId: number;
  at: string | null;
  evidenceId: string | null;
  evidence?: Record<string, string> | null;
  config?: { ai_face_check?: boolean; require_screen?: boolean; extra_camera?: string } | null;
}) {
  const { items, state } = useAttemptRecordings(examId, attemptId);
  const atMs = at ? new Date(at).getTime() : null;

  const byKind = useMemo(() => {
    const ready = items.filter((r) => r.status === 'ready' || r.status === 'recording');
    const sort = (k: string) => ready.filter((r) => r.kind === k).sort((a, b) => (a.started_at ?? a.created_at) - (b.started_at ?? b.created_at));
    return { camera: sort('camera'), screen: sort('screen'), camera2: sort('camera2') };
  }, [items]);
  // a source is shown when it was recorded, or when the exam required it (a missing recording is then news);
  // nothing is rendered for sources the exam never used, so reviewing a plain exam does not show empty boxes
  const asked = { camera: !!config?.ai_face_check, screen: !!config?.require_screen, camera2: (config?.extra_camera ?? 'off') !== 'off' };
  const tiles = ([
    { key: 'camera', label: 'Camera', icon: Video },
    { key: 'screen', label: 'Màn hình', icon: Monitor },
    { key: 'camera2', label: 'Camera phụ', icon: Smartphone },
  ] as const).filter((t) => state !== 'loading' && (byKind[t.key].length > 0 || (config ? asked[t.key] : t.key !== 'camera2')));

  // the three pictures of the violation moment: screen, main camera, phone camera (older violations have just one)
  const shots = ([
    ['screen', 'Màn hình'],
    ['camera', 'Camera chính'],
    ['phone', 'Camera phụ (điện thoại)'],
  ] as const)
    .map(([k, label]) => ({ k, label, rec: items.find((r) => r.id === (evidenceSet?.[k] ?? null) && r.url) }))
    .filter((x) => x.rec);
  const single = shots.length === 0 ? items.find((r) => r.id === evidenceId && r.url) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {tiles.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          {tiles.map((t) => (
            <Player key={t.key} rec={pick(byKind[t.key], atMs)} at={atMs} label={t.label} icon={t.icon} />
          ))}
        </div>
      )}
      {state === 'disabled' && <div className="text-xs text-muted-foreground">Hệ thống ghi hình chưa được bật.</div>}
      {state === 'error' && <div className="text-xs text-danger-fg">Không tải được bản ghi của phiên này.</div>}
      {(shots.length > 0 || single) && (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" />
            Ảnh minh chứng lúc vi phạm
          </div>
          <div className="grid gap-px bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            {(shots.length > 0 ? shots.map((x) => ({ key: x.k, label: x.label, rec: x.rec! })) : [{ key: 'one', label: 'Minh chứng', rec: single! }]).map((x) => (
              <a key={x.key} href={x.rec.url} target="_blank" rel="noreferrer" className="group relative block bg-black">
                <img src={x.rec.url} alt={x.label} className="aspect-[16/10] w-full object-contain" />
                <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">{x.label}</span>
                <ExternalLink className="absolute bottom-2 right-2 size-3.5 text-white opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
