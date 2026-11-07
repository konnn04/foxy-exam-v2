import { Head } from '@inertiajs/react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { CheckCircle2, Compass, Loader2, Lock, MonitorOff, PowerOff, RotateCw, SwitchCamera, TriangleAlert, Video } from 'lucide-react';
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
  const [tiltWarning, setTiltWarning] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [backgrounded, setBackgrounded] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const room = useRef<Room | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const retry = useRef<number | undefined>(undefined);
  const statusTimer = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  const closed = useRef(false);
  const facingRef = useRef(facing);
  facingRef.current = facing;
  const portraitRef = useRef(portrait);
  portraitRef.current = portrait;
  const tiltRef = useRef<string | null>(null);
  tiltRef.current = tiltWarning;

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      wake.current = (await nav.wakeLock?.request('screen').catch(() => null)) ?? null;
    } catch {
      /* WakeLock API not supported */
    }
  }, []);

  /** Broadcast real-time phone sensor/state telemetry to the candidate's desktop over LiveKit data channel. */
  const sendPhoneSignal = useCallback((type: string, extra: Record<string, unknown> = {}) => {
    const r = room.current;
    if (!r || r.state !== 'connected') return;
    try {
      const payload = JSON.stringify({
        type,
        facing: facingRef.current,
        portrait: portraitRef.current,
        tiltWarning: tiltRef.current,
        visibility: document.visibilityState,
        ts: Date.now(),
        ...extra,
      });
      void r.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true }).catch(() => {});
    } catch {
      /* ignore data channel error */
    }
  }, []);

  // Orientation & Tilt sensor check (camera-orientation-check)
  useEffect(() => {
    const checkOrientation = () => {
      const v = video.current;
      const isVideoPortrait = v && v.videoWidth > 0 && v.videoHeight > v.videoWidth;
      const isScreenPortrait = window.innerHeight > window.innerWidth;
      const nextPortrait = Boolean(isVideoPortrait || isScreenPortrait);
      setPortrait(nextPortrait);
      return nextPortrait;
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      // beta: [-180, 180] front-to-back tilt (0 = flat on table), gamma: [-90, 90] left-to-right tilt
      if (e.beta === null && e.gamma === null) return;
      const b = Math.abs(e.beta ?? 0);
      const g = Math.abs(e.gamma ?? 0);
      // When lying flat face-up or face-down on the desk, both beta (near 0 or 180) and gamma (near 0) are flat
      const flatBeta = b < 18 || b > 162;
      const flatGamma = g < 18;
      if (flatBeta && flatGamma) {
        setTiltWarning('Điện thoại đang đặt nằm phẳng trên mặt bàn (úp/ngửa). Hãy dựng nghiêng điện thoại (~60°–100°) hướng vào bạn và laptop.');
      } else {
        setTiltWarning(null);
      }
    };
    window.addEventListener('deviceorientation', onDeviceOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
  }, []);

  // Notify desktop immediately when orientation or tilt changes while live
  useEffect(() => {
    if (phase === 'live') {
      sendPhoneSignal('ORIENTATION_CHANGED', { portrait, tiltWarning });
    }
  }, [portrait, tiltWarning, phase, sendPhoneSignal]);

  const stopAll = useCallback(() => {
    closed.current = true;
    window.clearTimeout(retry.current);
    window.clearInterval(statusTimer.current);
    void room.current?.disconnect();
    room.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);

  /** Joins (or re-joins) the private room and publishes the camera. A dropped connection comes back here by itself. */
  const join = useCallback(async (cameraSwitched = false) => {
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
        setMessage('Mất kết nối, đang kết nối lại…');
        retry.current = window.setTimeout(() => void join(), 3000);
      });
      await r.connect(ex.livekit.url, ex.livekit.token);
      room.current = r;
      const videoTrack = stream.current.getVideoTracks()[0];
      await r.localParticipant.publishTrack(videoTrack, {
        source: Track.Source.Camera,
        simulcast: false,
        videoEncoding: { maxBitrate: 600_000, maxFramerate: 12 },
      });
      await fetch(api(token, 'ack'), { method: 'POST' });
      setExam(ex.state === 'exam');
      setPhase('live');
      setMessage('');
      const trackSettings = videoTrack?.getSettings();
      sendPhoneSignal(cameraSwitched ? 'CAMERA_SWITCHED' : 'PHONE_LIVE', {
        deviceId: trackSettings?.deviceId ?? null,
        facingMode: trackSettings?.facingMode ?? facingRef.current,
      });

      window.clearInterval(statusTimer.current);
      statusTimer.current = window.setInterval(() => {
        if (room.current?.state === 'connected') {
          sendPhoneSignal('PHONE_HEARTBEAT');
          // Periodically check if the session transitioned from lobby to exam
          void fetch(api(token, 'exchange'), { method: 'POST', headers: { Accept: 'application/json' } })
            .then(async (resp) => {
              if (resp.status === 410) {
                stopAll();
                setPhase('ended');
              } else if (resp.ok) {
                const data = (await resp.json()) as Exchange;
                setExam(data.state === 'exam');
              }
            })
            .catch(() => {});
        }
      }, 6000);
    } catch (e) {
      if (closed.current) return;
      setMessage(e instanceof Error ? e.message : 'Không kết nối được.');
      if (phase !== 'live') setPhase('error');
      else retry.current = window.setTimeout(() => void join(), 4000);
    } finally {
      busy.current = false;
    }
  }, [phase, sendPhoneSignal, stopAll, token]);

  const start = useCallback(
    async (side: 'environment' | 'user', isSwitch = false) => {
      // Request DeviceOrientation permission on iOS 13+ when triggered by user gesture
      try {
        const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
        if (typeof DOE?.requestPermission === 'function') {
          await DOE.requestPermission().catch(() => {});
        }
      } catch {
        /* ignore */
      }
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
          sendPhoneSignal('CAMERA_ENDED');
          setPhase('error');
          setMessage('Camera đã bị tắt hoặc bị gián đoạn. Hãy mở lại ngay để tiếp tục thi.');
        });
        await requestWakeLock();
        await join(isSwitch);
      } catch (e) {
        setPhase('error');
        setMessage(cameraError(e));
      }
    },
    [join, requestWakeLock, sendPhoneSignal],
  );

  // Detect phone screen lock / app switch / tab backgrounding
  useEffect(() => {
    const onVisibility = () => {
      if (closed.current) return;
      if (document.visibilityState === 'hidden') {
        setBackgrounded(true);
        sendPhoneSignal('PHONE_SCREEN_OFF');
      } else {
        setBackgrounded(false);
        void requestWakeLock();
        // If camera track stopped while phone was locked on iOS/Android, restart camera & notify desktop
        const track = stream.current?.getVideoTracks()[0];
        if (phase === 'live' && (!track || track.readyState === 'ended' || !track.enabled)) {
          void start(facingRef.current, true);
        } else if (phase === 'live') {
          sendPhoneSignal('PHONE_FOREGROUND');
        }
      }
    };
    const onPageHide = () => sendPhoneSignal('PHONE_SCREEN_OFF');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [phase, requestWakeLock, sendPhoneSignal, start]);

  useEffect(() => () => stopAll(), [stopAll]);

  const flip = () => {
    if (exam) {
      setMessage('Không được tự ý đổi ống kính camera khi đang trong giờ làm bài.');
      sendPhoneSignal('CAMERA_SWITCH_ATTEMPTED');
      return;
    }
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    if (phase === 'live') void start(next, true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Head title="Camera mở rộng" />
      <div className="relative flex-1 bg-black">
        <video ref={video} playsInline muted className="size-full max-h-[calc(100vh-180px)] object-contain" />
        {phase !== 'live' && phase !== 'starting' && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90" />}
        {phase === 'live' && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            {exam ? 'ĐANG GIÁM SÁT PHÒNG THI' : 'ĐÃ KẾT NỐI — CHỜ KIỂM TRA GÓC ĐẶT'}
          </span>
        )}
        {phase === 'live' && (
          <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-zinc-300">
            {facing === 'environment' ? 'Cam sau' : 'Cam trước'} · {portrait ? 'Dọc (Chưa chuẩn)' : 'Ngang (Chuẩn)'}
          </span>
        )}
        {portrait && (phase === 'live' || phase === 'intro') && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-amber-500/95 px-3 py-2.5 text-xs font-semibold text-black shadow-lg">
            <RotateCw className="size-4 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
            Bắt buộc xoay ngang điện thoại (Landscape) để thấy rõ cả thí sinh và màn hình laptop.
          </div>
        )}
        {!portrait && tiltWarning && phase === 'live' && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl bg-red-600/95 px-3 py-2.5 text-xs font-semibold text-white shadow-lg">
            <Compass className="size-4 shrink-0" /> {tiltWarning}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-zinc-800 bg-zinc-900 p-4">
        {phase === 'intro' && (
          <>
            <h1 className="text-base font-semibold">Camera giám sát phụ (Điện thoại)</h1>
            <ul className="space-y-1 text-sm text-zinc-300">
              <li>• Đặt điện thoại <b>nằm ngang</b> ở góc bàn, <b>hướng chéo (~90°)</b> thấy rõ bạn, hai tay và màn hình laptop.</li>
              <li>• Cắm sạc. Dùng nút <b>“Tắt màn hình chống chói”</b> bên dưới thay vì bấm nút nguồn khoá máy.</li>
              <li>• <b>Tuyệt đối không</b> khoá màn hình vật lý, không chuyển ứng dụng hoặc đổi camera trong giờ thi.</li>
            </ul>
            <button onClick={() => void start(facing, false)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 font-semibold text-white active:scale-[0.99]">
              <Video className="size-5" /> Bật camera và kết nối
            </button>
          </>
        )}
        {phase === 'starting' && (
          <p className="flex items-center justify-center gap-2 py-3 text-sm text-zinc-300">
            <Loader2 className="size-4 animate-spin" /> Đang kết nối máy chủ giám sát…
          </p>
        )}
        {phase === 'live' && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-green-500" />
            <div className="flex-1 text-sm text-zinc-300">
              <p>
                {exam
                  ? 'Đang phát hình giám sát. Giữ nguyên vị trí điện thoại và không thoát trình duyệt.'
                  : 'Đã kết nối. Đặt điện thoại nằm ngang đúng góc rồi bấm “Kiểm tra góc đặt” trên máy tính.'}
              </p>
              {backgrounded && (
                <p className="mt-1 text-xs font-medium text-red-400">
                  Cảnh báo: Bạn vừa rời trang hoặc tắt màn hình điện thoại — sự việc đã được báo về máy tính thi!
                </p>
              )}
              {message && <p className="mt-1 text-xs text-amber-400">{message}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button onClick={() => setDark(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium" title="Làm tối màn hình chống chói (camera vẫn chạy)">
                <MonitorOff className="size-4" /> Chống chói
              </button>
              {!exam ? (
                <button onClick={flip} className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 px-3 text-xs" title="Đổi camera trước / sau (chỉ cho phép ở phòng chờ)">
                  <SwitchCamera className="size-4" /> Đổi cam
                </button>
              ) : (
                <span className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-[11px] text-zinc-500" title="Đã khoá đổi camera trong giờ thi">
                  <Lock className="size-3.5" /> Đã khoá cam
                </span>
              )}
            </div>
          </div>
        )}
        {phase === 'error' && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-red-400">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {message}
            </p>
            <button onClick={() => void start(facing, true)} className="h-11 w-full rounded-xl bg-zinc-700 font-medium">
              Mở lại camera & Kết nối
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
        <button type="button" onClick={() => setDark(false)} className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black pb-12 text-xs text-zinc-700">
          <span>Chế độ tiết kiệm pin & chống chói — Camera vẫn đang phát trực tiếp</span>
          <span className="mt-1 text-[11px] text-zinc-800">Chạm vào bất kỳ đâu để hiện lại màn hình (Không bấm nút nguồn khoá máy)</span>
        </button>
      )}
    </div>
  );
}
