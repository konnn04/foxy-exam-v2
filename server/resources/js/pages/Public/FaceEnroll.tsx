import { Head } from '@inertiajs/react';
import { Camera, CheckCircle2, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'loading' | 'ready' | 'camera' | 'sending' | 'done' | 'gone' | 'error';

const api = (token: string, path: string) => `/api/v1/public/face-enroll/${token}/${path}`;

/** Opened from the QR code in the exam lobby: the phone takes the reference photo and sends it. The single-use token is the credential. */
export default function FaceEnroll({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(api(token, 'info'), { method: 'POST', headers: { Accept: 'application/json' } });
        const json = await res.json().catch(() => ({}));
        if (res.status === 410) {
          setMessage(json.message ?? 'Liên kết đã hết hạn.');
          return setPhase('gone');
        }
        setName(json.name ?? '');
        setPhase('ready');
      } catch {
        setMessage('Không kết nối được máy chủ.');
        setPhase('error');
      }
    })();
    return stop;
  }, [token, stop]);

  const open = async () => {
    setMessage('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      setPhase('camera');
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = stream.current;
          void video.current.play();
        }
      });
    } catch {
      setMessage('Chưa cho phép dùng camera. Mở cài đặt trang web, cho phép camera rồi thử lại.');
    }
  };

  const shoot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) return;
    setPhase('sending');
    const body = new FormData();
    body.append('frame', blob, 'face.jpg');
    try {
      const res = await fetch(api(token, 'submit'), { method: 'POST', body, headers: { Accept: 'application/json' } });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        stop();
        setMessage(json.message ?? 'Đã lưu khuôn mặt.');
        return setPhase('done');
      }
      if (res.status === 410 || res.status === 423) {
        stop();
        setMessage(json.message ?? 'Liên kết không còn dùng được.');
        return setPhase('gone');
      }
      setMessage(json.message ?? 'Ảnh chưa dùng được, chụp lại.');
      setPhase('camera');
      requestAnimationFrame(() => {
        if (video.current && stream.current) video.current.srcObject = stream.current;
      });
    } catch {
      setMessage('Mất kết nối khi gửi ảnh, thử lại.');
      setPhase('camera');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Head title="Đăng ký khuôn mặt" />
      <div className="relative flex-1 bg-black">
        <video ref={video} playsInline muted className="size-full max-h-[calc(100vh-190px)] -scale-x-100 object-contain" />
        {phase !== 'camera' && phase !== 'sending' && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950" />}
        {(phase === 'loading' || phase === 'sending') && <Loader2 className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 animate-spin" />}
        {phase === 'camera' && <div className="pointer-events-none absolute inset-0 m-auto aspect-[3/4] max-h-[80%] rounded-[50%] border-2 border-dashed border-white/60" />}
      </div>
      <div className="space-y-3 border-t border-zinc-800 bg-zinc-900 p-4">
        {phase === 'ready' && (
          <>
            <h1 className="text-base font-semibold">Đăng ký khuôn mặt{name ? ` · ${name}` : ''}</h1>
            <ul className="space-y-1 text-sm text-zinc-300">
              <li>• Nhìn thẳng vào camera, mặt rõ, đủ sáng, không đeo kính râm hay khẩu trang.</li>
              <li>• Chỉ một khuôn mặt trong khung. Ảnh được khoá sau khi lưu; muốn đổi phải xin giảng viên duyệt.</li>
            </ul>
            <button onClick={() => void open()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 font-semibold text-white">
              <Camera className="size-5" /> Mở camera
            </button>
          </>
        )}
        {phase === 'camera' && (
          <button onClick={() => void shoot()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 font-semibold text-white">
            <Camera className="size-5" /> Chụp và gửi
          </button>
        )}
        {phase === 'done' && (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="size-5" /> {message}
          </div>
        )}
        {(phase === 'gone' || phase === 'error') && (
          <div className="flex items-start gap-2 text-red-300">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" /> {message}
          </div>
        )}
        {phase === 'error' && (
          <button onClick={() => location.reload()} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700">
            <RefreshCw className="size-4" /> Thử lại
          </button>
        )}
        {message && (phase === 'ready' || phase === 'camera') && <p className="text-sm text-amber-300">{message}</p>}
      </div>
    </div>
  );
}
