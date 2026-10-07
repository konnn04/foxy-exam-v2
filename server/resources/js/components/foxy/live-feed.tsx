import type { RemoteTrack } from 'livekit-client';
import { useEffect, useRef } from 'react';
import { FeedPlaceholder } from '@/components/foxy/ui';

/** One candidate tile: the live video when a track is subscribed, the striped placeholder otherwise. */
export function LiveFeed({ track, label, children }: { track?: RemoteTrack; label: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => void track.detach(el);
  }, [track]);

  if (!track) return <FeedPlaceholder label={label}>{children}</FeedPlaceholder>;

  return (
    <div className="relative aspect-[16/10] bg-black">
      <video ref={ref} autoPlay muted playsInline className="size-full object-contain" />
      {children}
    </div>
  );
}
