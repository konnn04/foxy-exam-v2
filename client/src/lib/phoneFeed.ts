import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";

export type PhoneState = "off" | "connecting" | "live" | "lost";

/**
 * Watches the phone camera during the exam: joins the phone's private room as a viewer, hands the video out as a
 * MediaStream (shown in the exam window, framed for the AI checks and as evidence) and reports when the phone drops.
 * LiveKit reconnects the viewer by itself; a phone that comes back publishes again and the stream returns.
 */
export class PhoneFeed {
  private room: Room | null = null;
  private stopped = false;

  constructor(
    private onState: (s: PhoneState) => void,
    private onStream: (stream: MediaStream | null) => void,
  ) {}

  async connect(creds: { url: string; token: string }): Promise<void> {
    this.stopped = false;
    this.onState("connecting");
    const room = new Room({ adaptiveStream: false });
    const lost = () => {
      if (this.stopped) return;
      this.onStream(null);
      this.onState("lost");
    };
    const live = (track: { mediaStreamTrack: MediaStreamTrack }) => {
      if (this.stopped) return;
      this.onStream(new MediaStream([track.mediaStreamTrack]));
      this.onState("live");
    };
    room
      .on(RoomEvent.TrackSubscribed, (t) => t.kind === Track.Kind.Video && live(t))
      .on(RoomEvent.TrackUnsubscribed, (t) => t.kind === Track.Kind.Video && lost())
      .on(RoomEvent.ParticipantDisconnected, lost)
      .on(RoomEvent.Disconnected, lost)
      .on(RoomEvent.Reconnecting, () => this.onState("connecting"));
    this.room = room;
    await room.connect(creds.url, creds.token);
    // a phone that was in the room before we joined
    room.remoteParticipants.forEach((p) =>
      p.trackPublications.forEach((pub) => {
        if (pub.track && pub.kind === Track.Kind.Video) live(pub.track);
      }),
    );
    if (room.remoteParticipants.size === 0) this.onState("lost");
  }

  get connected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.onStream(null);
    await this.room?.disconnect().catch(() => {});
    this.room = null;
    this.onState("off");
  }
}
