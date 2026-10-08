import { Head } from '@inertiajs/react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { CheckCircle2, Loader2, MonitorOff, PowerOff, RotateCw, SwitchCamera, TriangleAlert, Video } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'intro' | 'starting' | 'live' | 'ended' | 'error';

interface Exchange {
  state: 'lobby' | 'exam';
  livekit: { url: string; token: string; room: string } | null;
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
  const [exam, setExam] = useState(false);
  const [message, setMessage] = useState('');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [portrait, setPortrait] = useState(false);
  const [dark, setDark] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const room = useRef<Room | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const retry = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  const closed = useRef(false);

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const stopAll = useCallback(() => {
    closed.current = true;
    window.clearTimeout(retry.current);
    void room.current?.disconnect();
    room.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);

  /** Joins (or re-joins) the private room and publishes the camera. A dropped connection comes back here by itself. */
  const join = useCallback(async () => {
    if (busy.current || !stream.current || closed.current) return;
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

      await room.current?.disconnect();
      const r = new Room({ adaptiveStream: false, dynacast: false });
      r.on(RoomEvent.Disconnected, () => {
        if (room.current !== r || closed.current) return;
        // the connection dropped: try again, and learn from the server whether the exam is over
        setMessage('Mất kết nối, đang kết nối lại…');
        retry.current = window.setTimeout(() => void join(), 3000);
      });
      await r.connect(ex.livekit.url, ex.livekit.token);
      room.current = r;
      await r.localParticipant.publishTrack(stream.current.getVideoTracks()[0], {
        source: Track.Source.Camera,
        simulcast: false,
        videoEncoding: { maxBitrate: 600_000, maxFramerate: 12 },
      });
      await fetch(api(token, 'ack'), { method: 'POST' }); // the computer is told by LiveKit itself; this starts the recording
      setExam(ex.state === 'exam');
      setPhase('live');
      setMessage('');
    } catch (e) {
      if (closed.current) return;
      setMessage(e instanceof Error ? e.message : 'Không kết nối được.');
      if (phase !== 'live') setPhase('error');
      else retry.current = window.setTimeout(() => void join(), 4000);
    } finally {
      busy.current = false;
    }
  }, [phase, stopAll, token]);

  const start = useCallback(
    async (side: 'environment' | 'user') => {
      setPhase('starting');
      setMessage('');
      closed.current = false;
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
            {exam ? 'ĐANG GIÁM SÁT' : 'ĐÃ KẾT NỐI — CHỜ VÀO THI'}
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
              <li>• Đặt điện thoại <b>nằm ngang</b> ở một bên bàn, <b>vuông góc (90°)</b> với laptop: thấy bạn, hai tay và màn hình.</li>
              <li>• Cắm sạc. Bạn có thể tắt màn hình điện thoại để đỡ chói (camera vẫn chạy).</li>
              <li>• Không thoát trang này trong giờ thi. Liên kết hết hạn khi bạn nộp bài.</li>
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
              {exam ? 'Đang phát hình cho giám thị. Để nguyên điện thoại ở vị trí này.' : 'Đã kết nối. Quay lại máy tính để kiểm tra góc đặt, rồi bắt đầu làm bài.'}
              {message && <span className="block text-amber-400">{message}</span>}
            </p>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button onClick={() => setDark(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs" title="Tắt màn hình (chạm để bật lại)">
                <MonitorOff className="size-4" /> Tắt màn hình
              </button>
              <button onClick={flip} className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs" title="Đổi camera trước / sau">
                <SwitchCamera className="size-4" /> Đổi camera
              </button>
            </div>
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

      {dark && (
        <button type="button" onClick={() => setDark(false)} className="fixed inset-0 z-50 flex items-end justify-center bg-black pb-10 text-xs text-zinc-700">
          Camera vẫn đang chạy — chạm để bật lại màn hình
        </button>
      )}
    </div>
  );
}
