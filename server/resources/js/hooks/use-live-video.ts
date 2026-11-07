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

export type AttemptLiveFeed = 'camera' | 'screen' | 'camera2';

/**
 * Subscribes (read-only) to a single candidate's live streams on the Attempt detail page:
 * - Main room (`exam-{examId}`): candidate's `camera` and `screen` tracks (`attempt-{attemptId}`)
 * - Secondary mobile room (`cam2-{userId}-{examId}`): candidate's `phone` camera track (`camera2`)
 */
export function useAttemptLiveVideo(attemptId: number, enabled = true) {
  const [tracks, setTracks] = useState<Partial<Record<AttemptLiveFeed, RemoteTrack>>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setTracks({});
      setReady(false);
      return;
    }
    let closed = false;
    const mainRoom = new Room({ adaptiveStream: true, dynacast: true });
    const phoneRoom = new Room({ adaptiveStream: true, dynacast: true });
    const targetIdentity = `attempt-${attemptId}`;

    const putMain = (identity: string, pub: RemoteTrackPublication, track: RemoteTrack | undefined) => {
      if (identity !== targetIdentity) return;
      const source: AttemptLiveFeed | null =
        pub.source === Track.Source.Camera ? 'camera' : pub.source === Track.Source.ScreenShare ? 'screen' : null;
      if (!source) return;
      setTracks((prev) => {
        const next = { ...prev };
        if (track) next[source] = track;
        else delete next[source];
        return next;
      });
    };

    const putPhone = (identity: string, pub: RemoteTrackPublication, track: RemoteTrack | undefined) => {
      if (identity !== 'phone' || pub.kind !== Track.Kind.Video) return;
      setTracks((prev) => {
        const next = { ...prev };
        if (track) next.camera2 = track;
        else delete next.camera2;
        return next;
      });
    };

    mainRoom
      .on(RoomEvent.TrackSubscribed, (track, pub, p) => putMain(p.identity, pub, track))
      .on(RoomEvent.TrackUnsubscribed, (_t, pub, p) => putMain(p.identity, pub, undefined))
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        if (p.identity === targetIdentity) {
          setTracks((prev) => {
            const next = { ...prev };
            delete next.camera;
            delete next.screen;
            return next;
          });
        }
      });

    phoneRoom
      .on(RoomEvent.TrackSubscribed, (track, pub, p) => putPhone(p.identity, pub, track))
      .on(RoomEvent.TrackUnsubscribed, (_t, pub, p) => putPhone(p.identity, pub, undefined))
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        if (p.identity === 'phone') {
          setTracks((prev) => {
            const next = { ...prev };
            delete next.camera2;
            return next;
          });
        }
      });

    (async () => {
      try {
        const res = await fetch(`/admin/attempts/${attemptId}/live-video`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        if (!res.ok || closed) return;
        const info = await res.json();
        if (!info.enabled || !info.main) return;

        await mainRoom.connect(info.main.url, info.main.token, { autoSubscribe: true });
        if (closed) {
          void mainRoom.disconnect();
          return;
        }
        setReady(true);
        mainRoom.remoteParticipants.forEach((p) => {
          p.on(ParticipantEvent.TrackSubscribed, () => {});
          p.trackPublications.forEach((pub) => pub.track && putMain(p.identity, pub as RemoteTrackPublication, pub.track as RemoteTrack));
        });

        if (info.phone?.url && info.phone?.token) {
          await phoneRoom.connect(info.phone.url, info.phone.token, { autoSubscribe: true });
          if (closed) {
            void phoneRoom.disconnect();
            return;
          }
          phoneRoom.remoteParticipants.forEach((p) => {
            p.on(ParticipantEvent.TrackSubscribed, () => {});
            p.trackPublications.forEach((pub) => pub.track && putPhone(p.identity, pub as RemoteTrackPublication, pub.track as RemoteTrack));
          });
        }
      } catch {
        setReady(false);
      }
    })();

    return () => {
      closed = true;
      void mainRoom.disconnect();
      void phoneRoom.disconnect();
      setTracks({});
      setReady(false);
    };
  }, [attemptId, enabled]);

  return { tracks, ready };
}
