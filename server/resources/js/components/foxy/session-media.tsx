import { FastForward, Maximize2, Image as ImageIcon, Monitor, Pause, Play, Rewind, Scissors, Smartphone, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/foxy/ui';
import { useAttemptRecordings, type RecordingInfo } from '@/hooks/use-recordings';

const LEAD_IN_S = 3;
const CLIP_PAD_S = 15;
const DRIFT_S = 0.6;
const RATES = [0.5, 1, 2, 4];

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

/** One video slaved to the shared clock: it follows `clock.t` (absolute ms) and reports its own position when it leads. */
function Player({
  rec,
  clock,
  lead,
  onTick,
  label,
  icon: Icon,
  onClip,
}: {
  rec: RecordingInfo | null;
  clock: Clock;
  lead: boolean;
  onTick: (t: number) => void;
  label: string;
  icon: typeof Video;
  onClip?: () => void;
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
    const want = (clock.t - started) / 1000;
    const apply = () => {
      if (Math.abs(el.currentTime - want) > DRIFT_S) el.currentTime = want;
      if (clock.playing && el.paused) void el.play().catch(() => undefined);
      if (!clock.playing && !el.paused) el.pause();
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener('loadedmetadata', apply, { once: true });
  }, [rec?.id, started, clock.t, clock.playing, clock.rate, inside]);

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-black">
      {rec?.url ? (
        <div className="relative">
          <video
            ref={ref}
            src={rec.url}
            muted
            preload="metadata"
            className="aspect-[16/10] w-full bg-black object-contain"
            onTimeUpdate={(e) => lead && inside && started !== null && onTick(started + e.currentTarget.currentTime * 1000)}
          />
          <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-2 py-[3px] text-xs font-semibold text-white">
            <Icon className="size-3" />
            {label}
          </span>
          {!inside && clock.t !== null && <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white/80">không có bản ghi ở thời điểm này</span>}
          {onClip && (
            <button type="button" onClick={onClip} title="Cắt clip quanh thời điểm đang xem và tải về" className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/65 px-2 py-1 text-[11px] font-semibold text-white hover:bg-black/80">
              <Scissors className="size-3" /> Clip
            </button>
          )}
        </div>
      ) : (
        <div className="flex h-12 items-center gap-2 px-3 text-xs text-white/70">
          <Icon className="size-3.5" />
          <span className="font-semibold text-white">{label}</span>
          <span>{rec ? (rec.status === 'recording' ? 'đang ghi…' : 'bản ghi chưa sẵn sàng') : 'không có bản ghi'}</span>
        </div>
      )}
    </div>
  );
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Session video (camera + screen + phone) on one shared clock, jumping to the selected violation, and the pictures taken at that moment. */
export function SessionMedia({
  examId,
  attemptId,
  studentId,
  hasFacePhoto,
  at,
  evidenceId,
  evidence: evidenceSet,
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
  at: string | null;
  evidenceId: string | null;
  evidence?: Record<string, string> | null;
  clips?: Record<string, string> | null;
  clipRange?: { from_ms: number; to_ms: number } | null;
  config?: { ai_face_check?: boolean; require_screen?: boolean; extra_camera?: string } | null;
  refreshKey?: string | number;
  publicEndpoint?: string;
}) {
  const { items, state, clip } = useAttemptRecordings(examId, attemptId, refreshKey, publicEndpoint);
  const atMs = at ? new Date(at).getTime() : null;
  const [clock, setClock] = useState<Clock>({ t: null, playing: false, rate: 1 });
  const [clipError, setClipError] = useState('');
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);

  // choosing another violation moves the shared clock to just before it, paused
  useEffect(() => {
    if (atMs !== null) setClock((c) => ({ ...c, t: atMs - LEAD_IN_S * 1000, playing: false }));
  }, [atMs]);

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

  const shown = tiles.map((t) => ({ ...t, rec: pick(byKind[t.key], clock.t ?? atMs) }));
  const spans = shown.filter((x) => x.rec?.started_at).map((x) => ({ from: x.rec!.started_at!, to: x.rec!.ended_at ?? x.rec!.started_at! + x.rec!.duration_ms }));
  const from = spans.length ? Math.min(...spans.map((x) => x.from)) : 0;
  const to = spans.length ? Math.max(...spans.map((x) => x.to)) : 0;
  const leadKey = shown.find((x) => x.rec?.url && x.rec.started_at && clock.t !== null && clock.t >= x.rec.started_at && (!x.rec.ended_at || clock.t <= x.rec.ended_at))?.key;
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

  // the three pictures of the violation moment: screen, main camera, phone camera (older violations have just one)
  const shots = ([
    ['screen', 'Màn hình'],
    ['camera', 'Camera chính'],
    ['phone', 'Camera phụ (điện thoại)'],
  ] as const)
    .map(([k, label]) => ({ k, label, rec: items.find((r) => r.id === (evidenceSet?.[k] ?? null) && r.url) }))
    .filter((x) => x.rec);
  const clipList = ([
    ['camera', 'camera'],
    ['screen', 'màn hình'],
  ] as const)
    .flatMap(([k, label]) => {
      const rec = items.find((r) => r.id === (clips?.[k] ?? null) && r.url);
      return rec ? [{ key: k as string, label: label as string, rec }] : [];
    });
  const single = shots.length === 0 ? items.find((r) => r.id === evidenceId && r.url) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {tiles.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          {shown.map((t) => (
            <Player
              key={t.key}
              rec={t.rec}
              clock={clock}
              lead={t.key === leadKey}
              onTick={(v) => setClock((c) => (c.playing ? { ...c, t: v } : c))}
              label={t.label}
              icon={t.icon}
              onClip={t.rec?.url ? () => void download(t.rec!) : undefined}
            />
          ))}
        </div>
      )}
      {spans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2">
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => move(-10_000)} title="Lùi 10 giây">
            <Rewind className="size-4" />
          </button>
          <button type="button" className="rounded bg-primary p-1.5 text-primary-foreground" onClick={() => setClock((c) => ({ ...c, t: c.t ?? from, playing: !c.playing }))} title={clock.playing ? 'Tạm dừng' : 'Phát'}>
            {clock.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => move(10_000)} title="Tiến 10 giây">
            <FastForward className="size-4" />
          </button>
          <input type="range" min={from} max={to} step={500} value={clock.t ?? from} onChange={(e) => setClock((c) => ({ ...c, t: Number(e.target.value) }))} className="min-w-[160px] flex-1 accent-primary" />
          <span className="font-mono text-xs text-muted-foreground">
            {mmss((clock.t ?? from) - from)} / {mmss(to - from)}
          </span>
          <select value={clock.rate} onChange={(e) => setClock((c) => ({ ...c, rate: Number(e.target.value) }))} className="h-7 rounded border border-border bg-card px-1 text-xs">
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </div>
      )}
      {clipError && <div className="text-xs text-danger-fg">{clipError}</div>}
      {state === 'disabled' && <div className="text-xs text-muted-foreground">Hệ thống ghi hình chưa được bật.</div>}
      {state === 'error' && <div className="text-xs text-danger-fg">Không tải được bản ghi của phiên này.</div>}
      {(shots.length > 0 || single || clipList.length > 0 || (studentId && hasFacePhoto)) && (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" />
            Đối chiếu khuôn mặt sinh trắc &amp; Minh chứng lúc vi phạm
            <span className="ml-auto">bấm ảnh để phóng to</span>
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
                <span className="absolute left-1 top-1 rounded bg-primary/85 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">Mẫu đăng ký</span>
                <Maximize2 className="absolute bottom-1 right-1 size-3.5 text-white opacity-0 group-hover:opacity-100" />
              </button>
            )}
            {(shots.length > 0 ? shots.map((x) => ({ key: x.k, label: x.label, rec: x.rec! })) : single ? [{ key: 'one', label: 'Minh chứng', rec: single }] : []).map((x) => (
              <button key={x.key} type="button" onClick={() => setZoom({ url: x.rec.url!, label: x.label })} className="group relative h-24 w-40 overflow-hidden rounded-lg border border-border bg-black">
                <img src={x.rec.url} alt={x.label} className="size-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">{x.label}</span>
                <Maximize2 className="absolute bottom-1 right-1 size-3.5 text-white opacity-0 group-hover:opacity-100" />
              </button>
            ))}
            {clipList.map((c) => (
              <div key={c.key} className="w-56">
                <video
                  src={c.rec.url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full rounded-lg bg-black object-contain"
                  onLoadedMetadata={(e) => {
                    // the clip starts before the violation: jump to the moment itself (a bit earlier for context)
                    if (clipRange && atMs !== null && Number.isFinite(e.currentTarget.duration)) e.currentTarget.currentTime = Math.max(0, (atMs - clipRange.from_ms) / 1000 - 2);
                  }}
                />
                <div className="mt-0.5 text-[11px] text-muted-foreground">Clip {c.label} (5 giây trước và sau)</div>
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
