import { ParticipantEvent, RemoteTrack, RemoteTrackPublication, Room, RoomEvent, Track } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';

export type FeedSource = 'camera' | 'screen';
type Tracks = Partial<Record<FeedSource, RemoteTrack>>;

/** Subscribes (read-only) to the candidates' camera and screen tracks of one exam room. */
export function useLiveVideo(examId: number, enabled = true) {
  const [tracks, setTracks] = useState<Record<number, Tracks>>({});
  const [ready, setReady] = useState(false);
  const room = useRef<Room | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    const r = new Room({ adaptiveStream: true, dynacast: true });
    room.current = r;

    const attemptOf = (identity: string) => (identity.startsWith('attempt-') ? Number(identity.slice(8)) : 0);
    const put = (identity: string, pub: RemoteTrackPublication, track: RemoteTrack | undefined) => {
      const id = attemptOf(identity);
      const source: FeedSource | null = pub.source === Track.Source.Camera ? 'camera' : pub.source === Track.Source.ScreenShare ? 'screen' : null;
      if (!id || !source) return;
      setTracks((prev) => {
        const cur = { ...(prev[id] ?? {}) };
        if (track) cur[source] = track;
        else delete cur[source];
        return { ...prev, [id]: cur };
      });
    };

    r.on(RoomEvent.TrackSubscribed, (track, pub, p) => put(p.identity, pub, track))
      .on(RoomEvent.TrackUnsubscribed, (_t, pub, p) => put(p.identity, pub, undefined))
      .on(RoomEvent.ParticipantDisconnected, (p) => setTracks((prev) => ({ ...prev, [attemptOf(p.identity)]: {} })));

    (async () => {
      try {
        const res = await fetch(`/admin/exams/${examId}/live-video`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!res.ok || closed) return;
        const info = await res.json();
        await r.connect(info.url, info.token, { autoSubscribe: true });
        if (closed) return void r.disconnect();
        setReady(true);
        r.remoteParticipants.forEach((p) => {
          p.on(ParticipantEvent.TrackSubscribed, () => {});
          p.trackPublications.forEach((pub) => pub.track && put(p.identity, pub as RemoteTrackPublication, pub.track as RemoteTrack));
        });
      } catch {
        setReady(false);
      }
    })();

    return () => {
      closed = true;
      void r.disconnect();
      room.current = null;
      setTracks({});
      setReady(false);
    };
  }, [examId, enabled]);

  return { tracks, ready };
}
