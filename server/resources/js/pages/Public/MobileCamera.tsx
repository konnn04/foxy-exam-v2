import { Head } from '@inertiajs/react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { CheckCircle2, Loader2, PowerOff, RotateCw, SwitchCamera, TriangleAlert, Video } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'intro' | 'starting' | 'live' | 'ended' | 'error';
type Stage = 'lobby' | 'exam';

interface Exchange {
  state: Stage;
  livekit: { url: string; token: string; room: string } | null;
  snapshots?: { presign_url: string; commit_url: string; content_base: string; token: string; interval_ms: number };
}

const api = (token: string, path: string) => `/api/v1/public/mobile-camera/${token}/${path}`;

async function openCamera(facing: 'environment' | 'user'): Promise<MediaStream> {
  const tries: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 12, max: 15 } }, audio: false },
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false },
  ];
  let last: unknown;
  for (const c of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      last = e;
      if (!(e instanceof DOMException && e.name === 'OverconstrainedError')) throw e;
    }
  }
  throw last;
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Trình duyệt chưa cho phép dùng camera. Mở cài đặt trang web, cho phép camera rồi thử lại.';
  if (name === 'NotFoundError') return 'Không tìm thấy camera trên điện thoại.';
  if (name === 'NotReadableError') return 'Camera đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.';
  return e instanceof Error ? e.message : 'Không mở được camera.';
}

/** The phone as the candidate's second camera: opened from the QR code in the exam lobby. */
export default function MobileCamera({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [stage, setStage] = useState<Stage>('lobby');
  const [message, setMessage] = useState('');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [portrait, setPortrait] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const room = useRef<Room | null>(null);
  const snapTimer = useRef<number | undefined>(undefined);
  const lobbyPoll = useRef<number | undefined>(undefined);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const busy = useRef(false);
  const stageRef = useRef<Stage>('lobby');

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const stopAll = useCallback(() => {
    window.clearInterval(snapTimer.current);
    window.clearInterval(lobbyPoll.current);
    void room.current?.disconnect();
    room.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);

  const snapshot = useCallback(async (s: NonNullable<Exchange['snapshots']>) => {
    const v = video.current;
    if (!v || v.videoWidth === 0) return;
    const scale = Math.min(1, 960 / v.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.6));
    if (!blob) return;
    const auth = { Authorization: `Bearer ${s.token}` };
    try {
      const pre = await fetch(s.presign_url, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: 'image/jpeg', purpose: 'phone' }) });
      if (!pre.ok) return;
      const meta = await pre.json();
      const put = await fetch(s.content_base + meta.content_url, { method: 'PUT', headers: { ...auth, 'Content-Type': 'image/jpeg' }, body: blob });
      if (put.ok) await fetch(s.commit_url.replace('{id}', meta.evidence_id), { method: 'POST', headers: auth });
    } catch {
      /* a missed snapshot is only a missed snapshot */
    }
  }, []);

  const join = useCallback(async () => {
    if (busy.current || !stream.current) return;
    busy.current = true;
    try {
      const res = await fetch(api(token, 'exchange'), { method: 'POST', headers: { Accept: 'application/json' } });
      if (res.status === 410) {
        stopAll();
        setPhase('ended');
        return;
      }
      const ex = (await res.json()) as Exchange;
      if (!ex.livekit) throw new Error('Máy chủ chưa bật hệ thống phát hình.');

      window.clearInterval(snapTimer.current);
      await room.current?.disconnect();
      const r = new Room({ adaptiveStream: false, dynacast: false });
      r.on(RoomEvent.DataReceived, (payload) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload)) as { t?: string };
          if (msg.t === 'go' && stageRef.current === 'lobby') void join();
        } catch {
          /* not for us */
        }
      }).on(RoomEvent.Disconnected, () => {
        if (room.current === r && stream.current) setMessage('Mất kết nối, đang thử lại…');
      });
      await r.connect(ex.livekit.url, ex.livekit.token);
      room.current = r;
      const track = stream.current.getVideoTracks()[0];
      await r.localParticipant.publishTrack(track, { source: Track.Source.Camera, simulcast: false, videoEncoding: { maxBitrate: 600_000, maxFramerate: 12 } });
      await fetch(api(token, 'ack'), { method: 'POST' });

      stageRef.current = ex.state;
      setStage(ex.state);
      setPhase('live');
      setMessage('');
      if (ex.state === 'exam' && ex.snapshots) {
        const s = ex.snapshots;
        void snapshot(s);
        snapTimer.current = window.setInterval(() => void snapshot(s), s.interval_ms);
      }
    } catch (e) {
      setPhase('error');
      setMessage(e instanceof Error ? e.message : 'Không kết nối được.');
    } finally {
      busy.current = false;
    }
  }, [snapshot, stopAll, token]);

  const start = useCallback(
    async (side: 'environment' | 'user') => {
      setPhase('starting');
      setMessage('');
      try {
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = await openCamera(side);
        if (video.current) {
          video.current.srcObject = stream.current;
          await video.current.play().catch(() => {});
        }
        stream.current.getVideoTracks()[0]?.addEventListener('ended', () => {
          setPhase('error');
          setMessage('Camera đã bị tắt. Mở lại để tiếp tục.');
        });
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        wake.current = (await nav.wakeLock?.request('screen').catch(() => null)) ?? null;
        await join();
      } catch (e) {
        setPhase('error');
        setMessage(cameraError(e));
      }
    },
    [join],
  );

  // Only while still in the lobby: a cheap fallback in case the "exam started" message from the computer is lost.
  useEffect(() => {
    if (phase !== 'live' || stage !== 'lobby') return;
    lobbyPoll.current = window.setInterval(async () => {
      try {
        const s = await (await fetch(api(token, 'state'))).json();
        if (!s.active) {
          stopAll();
          setPhase('ended');
        } else if (s.state === 'exam') void join();
      } catch {
        /* offline: nothing to do */
      }
    }, 20_000);
    return () => window.clearInterval(lobbyPoll.current);
  }, [phase, stage, token, join, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  const flip = () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    if (phase === 'live') void start(next);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Head title="Camera mở rộng" />
      <div className="relative flex-1 bg-black">
        <video ref={video} playsInline muted className="size-full max-h-[calc(100vh-170px)] object-contain" />
        {phase !== 'live' && phase !== 'starting' && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90" />}
        {phase === 'live' && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            {stage === 'exam' ? 'ĐANG GIÁM SÁT' : 'ĐÃ KẾT NỐI — CHỜ VÀO THI'}
          </span>
        )}
        {portrait && phase === 'live' && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-amber-500/90 px-3 py-2 text-xs font-medium text-black">
            <RotateCw className="size-4 shrink-0" /> Xoay ngang điện thoại để thấy cả bạn và màn hình laptop.
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-zinc-800 bg-zinc-900 p-4">
        {phase === 'intro' && (
          <>
            <h1 className="text-base font-semibold">Camera mở rộng cho phòng thi</h1>
            <ul className="space-y-1 text-sm text-zinc-300">
              <li>• Đặt điện thoại <b>nằm ngang</b> ở góc bàn, thấy được bạn, hai tay và màn hình laptop.</li>
              <li>• Cắm sạc và giữ màn hình luôn sáng; không thoát trang này trong giờ thi.</li>
              <li>• Chỉ ghi hình để giám sát phòng thi này; liên kết hết hạn khi bạn nộp bài.</li>
            </ul>
            <button onClick={() => void start(facing)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 font-semibold text-white active:scale-[0.99]">
              <Video className="size-5" /> Bật camera và kết nối
            </button>
          </>
        )}
        {phase === 'starting' && (
          <p className="flex items-center justify-center gap-2 py-3 text-sm text-zinc-300">
            <Loader2 className="size-4 animate-spin" /> Đang kết nối…
          </p>
        )}
        {phase === 'live' && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-green-500" />
            <p className="flex-1 text-sm text-zinc-300">
              {stage === 'exam' ? 'Đang phát hình cho giám thị. Để nguyên điện thoại ở vị trí này.' : 'Đã kết nối. Quay lại máy tính để kiểm tra góc đặt, rồi bắt đầu làm bài.'}
              {message && <span className="block text-amber-400">{message}</span>}
            </p>
            <button onClick={flip} className="flex h-10 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs" title="Đổi camera trước / sau">
              <SwitchCamera className="size-4" /> Đổi camera
            </button>
          </div>
        )}
        {phase === 'error' && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-red-400">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {message}
            </p>
            <button onClick={() => void start(facing)} className="h-11 w-full rounded-xl bg-zinc-700 font-medium">
              Thử lại
            </button>
          </div>
        )}
        {phase === 'ended' && (
          <p className="flex items-center gap-2 py-2 text-sm text-zinc-300">
            <PowerOff className="size-4" /> Liên kết đã hết hạn hoặc phiên thi đã kết thúc. Bạn có thể đóng trang này.
          </p>
        )}
      </div>
    </div>
  );
}
