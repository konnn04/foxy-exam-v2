import {
  FastForward,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RefreshCw,
  Rewind,
  Scissors,
  Smartphone,
  Video,
} from 'lucide-react';
import { type RemoteTrack } from 'livekit-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/foxy/ui';
import { useAttemptLiveVideo } from '@/hooks/use-live-video';
import { useAttemptRecordings, type RecordingInfo } from '@/hooks/use-recordings';
import { cn } from '@/lib/utils';

const LEAD_IN_S = 3;
const CLIP_PAD_S = 15;
const DRIFT_S = 0.35;
const RATES = [0.5, 1, 1.5, 2, 4];

type StreamKey = 'camera' | 'screen' | 'camera2';

function pick(list: RecordingInfo[], at: number | null): RecordingInfo | null {
  if (list.length === 0) return null;
  if (at !== null) {
    const hit = list.find((r) => r.started_at && at >= r.started_at && (!r.ended_at || at <= r.ended_at + 2000));
    if (hit) return hit;
  }
  return list[0];
}

interface Clock {
  t: number | null;
  playing: boolean;
  rate: number;
}

/** Attach a LiveKit RemoteTrack to a `<video>` element. */
function LiveStreamTile({
  track,
  label,
  icon: Icon,
  isPrimary,
  onSelectPrimary,
}: {
  track?: RemoteTrack;
  label: string;
  icon: typeof Video;
  isPrimary?: boolean;
  onSelectPrimary?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <div
      onDoubleClick={onSelectPrimary}
      title={onSelectPrimary ? 'Nháy đúp để đưa luồng này lên màn hình chính' : undefined}
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-border bg-black select-none',
        onSelectPrimary && 'cursor-pointer',
      )}
    >
      {track ? (
        <video
          ref={ref}
          data-stream-kind={label}
          autoPlay
          playsInline
          muted
          className={cn('w-full bg-black object-contain', isPrimary ? 'aspect-video max-h-[460px]' : 'aspect-[16/10]')}
        />
      ) : (
        <div className={cn('flex flex-col items-center justify-center gap-1.5 bg-zinc-950 text-xs text-white/65', isPrimary ? 'aspect-video' : 'aspect-[16/10]')}>
          <Icon className="size-5 opacity-60" />
          <span>Đang chờ tín hiệu trực tiếp ({label})…</span>
        </div>
      )}
      <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
        <span className={cn('size-2 rounded-full', track ? 'animate-pulse bg-emerald-400' : 'bg-amber-400')} />
        <Icon className="size-3" />
        {label}
      </span>
    </div>
  );
}

/** One recorded video slaved to the shared clock: follows `clock.t` (absolute ms) and reports its own position when it leads. */
function Player({
  rec,
  clock,
  lead,
  scrubbing,
  onTick,
  label,
  icon: Icon,
  onClip,
  isPrimary,
  onSelectPrimary,
}: {
  rec: RecordingInfo | null;
  clock: Clock;
  lead: boolean;
  scrubbing: boolean;
  onTick: (t: number) => void;
  label: string;
  icon: typeof Video;
  onClip?: () => void;
  isPrimary?: boolean;
  onSelectPrimary?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const started = rec?.started_at ?? null;
  const inside = started !== null && clock.t !== null && clock.t >= started && (!rec?.ended_at || clock.t <= rec.ended_at + 2000);

  useEffect(() => {
    const el = ref.current;
    if (!el || started === null || clock.t === null) return;
    el.playbackRate = clock.rate;
    if (!inside) {
      el.pause();
      return;
    }
    const want = Math.max(0, (clock.t - started) / 1000);
    const apply = () => {
      if (Math.abs(el.currentTime - want) > DRIFT_S) {
        try {
          el.currentTime = want;
        } catch {
          // ignore unbuffered seek error
        }
      }
      const shouldPlay = clock.playing && !scrubbing;
      if (shouldPlay && el.paused) void el.play().catch(() => undefined);
      if (!shouldPlay && !el.paused) el.pause();
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener('loadedmetadata', apply, { once: true });
  }, [rec?.id, started, clock.t, clock.playing, clock.rate, inside, scrubbing]);

  return (
    <div
      onDoubleClick={onSelectPrimary}
      title={onSelectPrimary ? 'Nháy đúp để đổi góc nhìn chính / phụ (PiP)' : undefined}
      className={cn(
        'overflow-hidden rounded-[10px] border border-border bg-black select-none',
        onSelectPrimary && 'cursor-pointer',
      )}
    >
      {rec?.url ? (
        <div className="relative">
          <video
            ref={ref}
            data-stream-kind={label}
            crossOrigin="anonymous"
            src={rec.url}
            muted
            playsInline
            preload="metadata"
            className={cn('w-full bg-black object-contain', isPrimary ? 'aspect-video max-h-[480px]' : 'aspect-[16/10]')}
            onTimeUpdate={(e) => lead && inside && !scrubbing && started !== null && onTick(started + e.currentTarget.currentTime * 1000)}
          />
          <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded bg-black/65 px-2 py-[3px] text-xs font-semibold text-white">
            <Icon className="size-3" />
            {label}
          </span>
          {!inside && clock.t !== null && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white/80">
              Không có bản ghi ở thời điểm này
            </span>
          )}
          {onClip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClip();
              }}
              title="Cắt clip quanh thời điểm đang xem và tải về"
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/65 px-2 py-1 text-[11px] font-semibold text-white hover:bg-black/80"
            >
              <Scissors className="size-3" /> Clip
            </button>
          )}
        </div>
      ) : (
        <div className="flex h-12 items-center gap-2 px-3 text-xs text-white/70">
          <Icon className="size-3.5" />
          <span className="font-semibold text-white">{label}</span>
          <span>
            {rec
              ? rec.status === 'recording' || rec.status === 'pending_upload'
                ? 'Đang ghi hình & xử lý luồng…'
                : 'Bản ghi chưa sẵn sàng'
              : 'Không có bản ghi'}
          </span>
        </div>
      )}
    </div>
  );
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Multi-stream Session Video & Evidence Viewer:
 * - Realtime Live mode (Camera + Screen + Secondary Mobile Camera via LiveKit) when `running` is true
 * - Synchronized Playback mode (Camera + Screen + Secondary Mobile Camera slaved to one master clock with offset compensation)
 * - Grid layout (3 streams side-by-side) OR PiP layout (1 main view + 2 switchable overlay views)
 * - Synchronized 10s violation clips playback + Realtime Async Evidence Render status & auto-polling
 */
export function SessionMedia({
  examId,
  attemptId,
  studentId,
  hasFacePhoto,
  running = false,
  at,
  evidenceId,
  evidence: evidenceSet,
  snapshots,
  clips,
  clipRange,
  config,
  refreshKey,
  publicEndpoint,
}: {
  examId: number;
  attemptId: number;
  studentId?: number | null;
  hasFacePhoto?: boolean;
  running?: boolean;
  at: string | null;
  evidenceId: string | null;
  evidence?: Record<string, string> | null;
  snapshots?: Record<string, string> | null;
  clips?: Record<string, string> | null;
  clipRange?: { from_ms: number; to_ms: number } | null;
  config?: { ai_face_check?: boolean; require_screen?: boolean; extra_camera?: string } | null;
  refreshKey?: string | number;
  publicEndpoint?: string;
}) {
  const { items, state, clip, reload } = useAttemptRecordings(examId, attemptId, refreshKey, publicEndpoint);
  const atMs = at ? new Date(at).getTime() : null;

  const [sourceMode, setSourceMode] = useState<'playback' | 'live'>(() => (running && !at ? 'live' : 'playback'));
  const [layoutMode, setLayoutMode] = useState<'grid' | 'pip'>('grid');
  const [primaryKey, setPrimaryKey] = useState<StreamKey>('screen');
  const [scrubbing, setScrubbing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [clock, setClock] = useState<Clock>({ t: null, playing: false, rate: 1 });
  const [clipError, setClipError] = useState('');
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);

  // Synced 10s violation clip refs (when both camera & screen clips exist for the selected violation)
  const clipVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Subscribe to LiveKit streams only when proctor switches to "Trực tiếp (Realtime)" mode
  const live = useAttemptLiveVideo(attemptId, running && sourceMode === 'live' && !publicEndpoint);

  // Choosing a violation automatically switches to playback/evidence view and moves the shared clock to 3s before it
  useEffect(() => {
    if (atMs !== null) {
      setSourceMode('playback');
      setClock((c) => ({ ...c, t: atMs - LEAD_IN_S * 1000, playing: false }));
    }
  }, [atMs]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen().catch(() => undefined);
    } else {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  const byKind = useMemo(() => {
    const ready = items.filter((r) => r.status === 'ready' || r.status === 'recording' || r.status === 'pending_upload');
    const sort = (k: string) => ready.filter((r) => r.kind === k).sort((a, b) => (a.started_at ?? a.created_at) - (b.started_at ?? b.created_at));
    return { camera: sort('camera'), screen: sort('screen'), camera2: sort('camera2') };
  }, [items]);

  const asked = {
    camera: !!config?.ai_face_check,
    screen: !!config?.require_screen,
    camera2: (config?.extra_camera ?? 'off') !== 'off',
  };
  const tiles = ([
    { key: 'camera' as const, label: 'Camera chính', icon: Video },
    { key: 'screen' as const, label: 'Màn hình', icon: Monitor },
    { key: 'camera2' as const, label: 'Camera phụ (Điện thoại)', icon: Smartphone },
  ]).filter((t) => state !== 'loading' && (byKind[t.key].length > 0 || (config ? asked[t.key] : t.key !== 'camera2') || (sourceMode === 'live' && live.tracks[t.key])));

  const shown = tiles.map((t) => ({ ...t, rec: pick(byKind[t.key], clock.t ?? atMs) }));
  const spans = shown
    .filter((x) => x.rec?.started_at)
    .map((x) => ({ from: x.rec!.started_at!, to: x.rec!.ended_at ?? x.rec!.started_at! + Math.max(1000, x.rec!.duration_ms) }));
  const from = spans.length ? Math.min(...spans.map((x) => x.from)) : 0;
  const to = spans.length ? Math.max(...spans.map((x) => x.to)) : 0;
  const leadKey = shown.find(
    (x) => x.rec?.url && x.rec.started_at && clock.t !== null && clock.t >= x.rec.started_at && (!x.rec.ended_at || clock.t <= x.rec.ended_at),
  )?.key;
  const move = (deltaMs: number) => setClock((c) => ({ ...c, t: Math.min(to, Math.max(from, (c.t ?? from) + deltaMs)) }));

  const download = async (rec: RecordingInfo) => {
    setClipError('');
    try {
      const centre = (clock.t ?? atMs ?? rec.started_at ?? 0) - (rec.started_at ?? 0);
      const url = await clip(rec, centre / 1000 - CLIP_PAD_S, centre / 1000 + CLIP_PAD_S);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setClipError(e instanceof Error ? e.message : 'Không cắt được clip.');
    }
  };

  // Evidence snapshots for the selected violation (screen, camera, phone)
  const expectedEvidenceIds = useMemo(() => {
    const ids: string[] = [];
    if (evidenceId) ids.push(evidenceId);
    if (evidenceSet) Object.values(evidenceSet).forEach((id) => id && ids.push(id));
    if (clips) Object.values(clips).forEach((id) => id && ids.push(id));
    return ids;
  }, [evidenceId, evidenceSet, clips]);

  const shots = ([
    ['screen', 'Màn hình'],
    ['camera', 'Camera chính'],
    ['phone', 'Camera phụ (điện thoại)'],
  ] as const)
    .map(([k, label]) => {
      const rec = items.find((r) => r.id === (evidenceSet?.[k] ?? null) && r.url);
      if (rec) return { k, label, rec };
      const inlineDataUrl = snapshots?.[k];
      if (inlineDataUrl && typeof inlineDataUrl === 'string') {
        return { k, label, rec: { id: `snap-${k}`, kind: 'evidence', status: 'ready', duration_ms: 0, created_at: 0, url: inlineDataUrl } as RecordingInfo };
      }
      return { k, label, rec: undefined };
    })
    .filter((x) => x.rec);

  const clipList = ([
    ['camera', 'Camera chính'],
    ['screen', 'Màn hình'],
    ['phone', 'Camera phụ'],
  ] as const).flatMap(([k, label]) => {
    const rec = items.find((r) => r.id === (clips?.[k] ?? null) && r.url);
    return rec ? [{ key: k as string, label: label as string, rec }] : [];
  });

  const single = shots.length === 0 ? items.find((r) => r.id === evidenceId && r.url) : undefined;

  // Detect whether evidence/clips or recordings are still rendering / uploading asynchronously
  const hasPendingUploadItem = useMemo(() => {
    if (expectedEvidenceIds.some((id) => {
      const found = items.find((r) => r.id === id);
      return !found || !found.url || found.status === 'pending_upload' || found.status === 'recording';
    })) {
      return true;
    }
    // Or if the violation just occurred within the last 45 seconds and its 10s clip hasn't arrived yet
    if (atMs !== null && Date.now() - atMs < 45_000 && clipList.length === 0 && shots.length === 0 && !single) {
      return true;
    }
    return items.some((r) => r.status === 'pending_upload' || (r.status === 'recording' && !r.url));
  }, [expectedEvidenceIds, items, atMs, clipList.length, shots.length, single]);

  // Auto-poll every 3.5s while any evidence snapshot or violation video clip is still rendering/uploading
  useEffect(() => {
    if (!hasPendingUploadItem || state === 'disabled') return;
    const timer = setInterval(() => {
      reload();
    }, 3500);
    return () => clearInterval(timer);
  }, [hasPendingUploadItem, state, reload]);

  // Synchronize 10s violation clips when user plays/seeks one of them
  const syncViolationClips = (sourceKey: string, currentTime: number, playing: boolean) => {
    Object.entries(clipVideoRefs.current).forEach(([k, el]) => {
      if (!el || k === sourceKey) return;
      if (Math.abs(el.currentTime - currentTime) > 0.35) {
        try {
          el.currentTime = currentTime;
        } catch {
          // ignore
        }
      }
      if (playing && el.paused) void el.play().catch(() => undefined);
      if (!playing && !el.paused) el.pause();
    });
  };

  const activePrimary = shown.some((s) => s.key === primaryKey) ? primaryKey : (shown[0]?.key ?? 'camera');

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-3', isFullscreen && 'bg-background p-4 overflow-y-auto')}>
      {/* Top Control Header: Switch between Realtime Live vs Recorded Playback + Layout Mode (Grid vs PiP) */}
      {(running || tiles.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-surface px-3 py-2">
          <div className="flex items-center gap-1.5">
            {running && !publicEndpoint && (
              <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSourceMode('live')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition',
                    sourceMode === 'live' ? 'bg-danger text-white shadow-2xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Radio className={cn('size-3.5', sourceMode === 'live' && 'animate-pulse')} />
                  Trực tiếp (Realtime)
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('playback')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition',
                    sourceMode === 'playback' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Play className="size-3.5" />
                  Xem lại &amp; Minh chứng
                </button>
              </div>
            )}
            {(!running || publicEndpoint) && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Video className="size-3.5 text-primary" />
                Đồng bộ đa luồng Video (Cam chính · Màn hình · Cam phụ)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {hasPendingUploadItem && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                <Loader2 className="size-3 animate-spin" />
                Đang chờ render ảnh/video minh chứng…
              </span>
            )}
            <button
              type="button"
              onClick={reload}
              title="Làm mới danh sách video & minh chứng"
              className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="size-3" />
              Làm mới
            </button>
            <div className="flex items-center rounded border border-border bg-card p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                title="Chế độ Lưới 3 góc nhìn song song"
                className={cn('flex items-center gap-1 rounded px-2 py-0.5 font-medium', layoutMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground')}
              >
                <LayoutGrid className="size-3.5" />
                Lưới
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('pip')}
                title="Chế độ Hình-trong-Hình (PiP — nháy đúp vào video phụ để đổi góc nhìn chính)"
                className={cn('flex items-center gap-1 rounded px-2 py-0.5 font-medium', layoutMode === 'pip' ? 'bg-muted text-foreground' : 'text-muted-foreground')}
              >
                <PictureInPicture2 className="size-3.5" />
                PiP
              </button>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              className="rounded border border-border bg-card p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* MODE 1: REALTIME LIVE STREAM (Camera + Screen + Mobile Phone Camera) */}
      {sourceMode === 'live' && running && !publicEndpoint ? (
        layoutMode === 'pip' ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-9">
              {(() => {
                const mainTile = tiles.find((t) => t.key === activePrimary) ?? { key: 'screen' as const, label: 'Màn hình', icon: Monitor };
                return <LiveStreamTile track={live.tracks[mainTile.key]} label={mainTile.label} icon={mainTile.icon} isPrimary />;
              })()}
            </div>
            <div className="flex flex-col gap-3 lg:col-span-3">
              {([
                { key: 'camera' as const, label: 'Camera chính', icon: Video },
                { key: 'screen' as const, label: 'Màn hình', icon: Monitor },
                { key: 'camera2' as const, label: 'Camera phụ (ĐT)', icon: Smartphone },
              ])
                .filter((t) => t.key !== activePrimary)
                .map((t) => (
                  <LiveStreamTile
                    key={t.key}
                    track={live.tracks[t.key]}
                    label={t.label}
                    icon={t.icon}
                    onSelectPrimary={() => setPrimaryKey(t.key)}
                  />
                ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <LiveStreamTile track={live.tracks.camera} label="Camera chính" icon={Video} onSelectPrimary={() => { setPrimaryKey('camera'); setLayoutMode('pip'); }} />
            <LiveStreamTile track={live.tracks.screen} label="Màn hình bài làm" icon={Monitor} onSelectPrimary={() => { setPrimaryKey('screen'); setLayoutMode('pip'); }} />
            <LiveStreamTile track={live.tracks.camera2} label="Camera phụ (Điện thoại)" icon={Smartphone} onSelectPrimary={() => { setPrimaryKey('camera2'); setLayoutMode('pip'); }} />
          </div>
        )
      ) : (
        /* MODE 2: SYNCHRONIZED MULTI-VIDEO PLAYBACK */
        <>
          {tiles.length > 0 && (
            layoutMode === 'pip' && shown.length > 1 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                <div className="lg:col-span-9">
                  {shown
                    .filter((t) => t.key === activePrimary)
                    .map((t) => (
                      <Player
                        key={t.key}
                        rec={t.rec}
                        clock={clock}
                        lead={t.key === leadKey}
                        scrubbing={scrubbing}
                        onTick={(v) => setClock((c) => (c.playing ? { ...c, t: v } : c))}
                        label={t.label}
                        icon={t.icon}
                        isPrimary
                        onClip={t.rec?.url ? () => void download(t.rec!) : undefined}
                      />
                    ))}
                </div>
                <div className="flex flex-col gap-3 lg:col-span-3">
                  {shown
                    .filter((t) => t.key !== activePrimary)
                    .map((t) => (
                      <Player
                        key={t.key}
                        rec={t.rec}
                        clock={clock}
                        lead={t.key === leadKey}
                        scrubbing={scrubbing}
                        onTick={(v) => setClock((c) => (c.playing ? { ...c, t: v } : c))}
                        label={t.label}
                        icon={t.icon}
                        onSelectPrimary={() => setPrimaryKey(t.key)}
                        onClip={t.rec?.url ? () => void download(t.rec!) : undefined}
                      />
                    ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                {shown.map((t) => (
                  <Player
                    key={t.key}
                    rec={t.rec}
                    clock={clock}
                    lead={t.key === leadKey}
                    scrubbing={scrubbing}
                    onTick={(v) => setClock((c) => (c.playing ? { ...c, t: v } : c))}
                    label={t.label}
                    icon={t.icon}
                    onSelectPrimary={() => {
                      setPrimaryKey(t.key);
                      setLayoutMode('pip');
                    }}
                    onClip={t.rec?.url ? () => void download(t.rec!) : undefined}
                  />
                ))}
              </div>
            )
          )}

          {spans.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2">
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => move(-10_000)} title="Lùi 10 giây">
                <Rewind className="size-4" />
              </button>
              <button
                type="button"
                className="rounded bg-primary p-1.5 text-primary-foreground"
                onClick={() => setClock((c) => ({ ...c, t: c.t ?? from, playing: !c.playing }))}
                title={clock.playing ? 'Tạm dừng đồng bộ' : 'Phát đồng bộ tất cả luồng'}
              >
                {clock.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => move(10_000)} title="Tiến 10 giây">
                <FastForward className="size-4" />
              </button>
              <input
                type="range"
                min={from}
                max={to}
                step={250}
                value={clock.t ?? from}
                onPointerDown={() => setScrubbing(true)}
                onPointerUp={() => setScrubbing(false)}
                onChange={(e) => setClock((c) => ({ ...c, t: Number(e.target.value) }))}
                className="min-w-[160px] flex-1 accent-primary"
              />
              <span className="font-mono text-xs text-muted-foreground">
                {mmss((clock.t ?? from) - from)} / {mmss(to - from)}
              </span>
              <select
                value={clock.rate}
                onChange={(e) => setClock((c) => ({ ...c, rate: Number(e.target.value) }))}
                className="h-7 rounded border border-border bg-card px-1 text-xs"
              >
                {RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}x
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {clipError && <div className="text-xs text-danger-fg">{clipError}</div>}
      {state === 'disabled' && <div className="text-xs text-muted-foreground">Hệ thống ghi hình chưa được bật.</div>}
      {state === 'error' && <div className="text-xs text-danger-fg">Không tải được bản ghi của phiên này.</div>}

      {/* Realtime Async Rendering Banner when a violation is selected but its snapshots/clips are still rendering */}
      {atMs !== null && hasPendingUploadItem && shots.length === 0 && clipList.length === 0 && !single && (
        <div className="flex items-center gap-3 rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          <Loader2 className="size-4 shrink-0 animate-spin text-amber-600" />
          <div className="flex-1">
            <div className="font-semibold">Đang xử lý &amp; render ảnh/video minh chứng cho thời điểm vi phạm này…</div>
            <div className="mt-0.5 text-[11px] opacity-85">
              Vi phạm được báo cáo tức thời (realtime); ảnh chụp 3 góc và đoạn video clip 10 giây quanh thời điểm vi phạm đang được máy thí sinh / dịch vụ ghi hình tải lên và sẽ tự động hiển thị ngay khi hoàn tất.
            </div>
          </div>
        </div>
      )}

      {/* Evidence Snapshots + Synchronized 10s Violation Clips */}
      {(shots.length > 0 || single || clipList.length > 0 || (studentId && hasFacePhoto)) && (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" />
            <span>Đối chiếu khuôn mặt sinh trắc &amp; Minh chứng lúc vi phạm (Ảnh 3 góc + Clip 10 giây đồng bộ)</span>
            {hasPendingUploadItem && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600">
                <Loader2 className="size-3 animate-spin" /> Đang đồng bộ thêm minh chứng…
              </span>
            )}
            <span className="ml-auto">Bấm ảnh để phóng to</span>
          </div>
          <div className="flex flex-wrap gap-3 p-3">
            {studentId && hasFacePhoto && (
              <button
                type="button"
                onClick={() => setZoom({ url: `/admin/users/${studentId}/face-photo`, label: 'Khuôn mặt mẫu đã đăng ký sinh trắc' })}
                className="group relative h-24 w-28 overflow-hidden rounded-lg border-2 border-primary/50 bg-black"
                title="Ảnh khuôn mặt gốc đã đăng ký để đối chiếu"
              >
                <img src={`/admin/users/${studentId}/face-photo`} alt="Khuôn mặt mẫu" className="size-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-primary/85 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Mẫu đăng ký
                </span>
                <Maximize2 className="absolute bottom-1 right-1 size-3.5 text-white opacity-0 group-hover:opacity-100" />
              </button>
            )}
            {(shots.length > 0 ? shots.map((x) => ({ key: x.k, label: x.label, rec: x.rec! })) : single ? [{ key: 'one', label: 'Minh chứng', rec: single }] : []).map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setZoom({ url: x.rec.url!, label: x.label })}
                className="group relative h-24 w-40 overflow-hidden rounded-lg border border-border bg-black"
              >
                <img src={x.rec.url} alt={x.label} className="size-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">{x.label}</span>
                <Maximize2 className="absolute bottom-1 right-1 size-3.5 text-white opacity-0 group-hover:opacity-100" />
              </button>
            ))}
            {clipList.map((c) => (
              <div key={c.key} className="w-60">
                <video
                  ref={(el) => {
                    clipVideoRefs.current[c.key] = el;
                  }}
                  src={c.rec.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full rounded-lg bg-black object-contain"
                  onPlay={(e) => syncViolationClips(c.key, e.currentTarget.currentTime, true)}
                  onPause={(e) => syncViolationClips(c.key, e.currentTarget.currentTime, false)}
                  onSeeked={(e) => syncViolationClips(c.key, e.currentTarget.currentTime, !e.currentTarget.paused)}
                  onLoadedMetadata={(e) => {
                    if (clipRange && atMs !== null && Number.isFinite(e.currentTarget.duration)) {
                      e.currentTarget.currentTime = Math.max(0, (atMs - clipRange.from_ms) / 1000 - 2);
                    }
                  }}
                />
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Clip {c.label} (5s trước &amp; sau)</span>
                  {clipList.length > 1 && <span className="text-[10px] font-semibold text-primary">Đồng bộ đa góc</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Modal open={zoom !== null} onClose={() => setZoom(null)} width={1100} title={zoom?.label ?? ''}>
        {zoom && <img src={zoom.url} alt={zoom.label} className="max-h-[75vh] w-full rounded-lg bg-black object-contain" />}
      </Modal>
    </div>
  );
}
