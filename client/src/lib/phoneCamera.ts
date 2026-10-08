import QRCode from "qrcode";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { issueMobileCamera, verifyMobileLayout } from "./api";

export type PhoneLink = "idle" | "waiting" | "connected" | "error";
export type Layout = "unknown" | "checking" | "ok" | "bad";

/**
 * The lobby side of the extra camera: asks the server for a link (shown as a QR code), joins the private room the phone
 * publishes into to show its preview and checks that the candidate and the laptop are in the picture. The phone stays in
 * that room for the whole exam (the exam window keeps watching it, see phoneFeed.ts).
 */
export function usePhoneCamera(examId: number) {
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState<PhoneLink>("idle");
  const [layout, setLayout] = useState<Layout>("unknown");
  const [layoutMessage, setLayoutMessage] = useState("");
  const [error, setError] = useState("");
  const room = useRef<Room | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const track = useRef<RemoteTrack | null>(null);
  const url = useRef("");

  const attach = useCallback((el: HTMLVideoElement | null) => {
    video.current = el;
    if (el && track.current) track.current.attach(el);
  }, []);

  const leave = useCallback(async () => {
    track.current?.detach();
    track.current = null;
    await room.current?.disconnect().catch(() => {});
    room.current = null;
  }, []);

  const connect = useCallback(async () => {
    setLink("idle");
    setLayout("unknown");
    setError("");
    await leave();
    try {
      const res = (await issueMobileCamera(examId)).data;
      url.current = res.url;
      setQr(await QRCode.toDataURL(res.url, { margin: 1, width: 220, errorCorrectionLevel: "M" }));
      if (!res.viewer) throw new Error("Máy chủ chưa bật hệ thống phát hình.");
      const r = new Room({ adaptiveStream: true });
      r.on(RoomEvent.TrackSubscribed, (t) => {
        if (t.kind !== Track.Kind.Video) return;
        track.current = t;
        if (video.current) t.attach(video.current);
        setLink("connected");
      })
        .on(RoomEvent.TrackUnsubscribed, () => {
          track.current = null;
          setLink("waiting");
          setLayout("unknown");
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          track.current = null;
          setLink("waiting");
          setLayout("unknown");
        })
        .on(RoomEvent.Disconnected, () => setLink((l) => (l === "connected" ? "waiting" : l)));
      await r.connect(res.viewer.url, res.viewer.token);
      room.current = r;
      setLink("waiting");
      // a phone that was already in the room
      r.remoteParticipants.forEach((p) =>
        p.trackPublications.forEach((pub) => {
          if (pub.track && pub.kind === Track.Kind.Video) {
            track.current = pub.track as RemoteTrack;
            if (video.current) pub.track.attach(video.current);
            setLink("connected");
          }
        }),
      );
    } catch (e) {
      setLink("error");
      setError(e instanceof Error ? e.message : "Không tạo được liên kết cho điện thoại.");
    }
  }, [examId, leave]);

  /** Is the candidate (and the laptop) visible in the phone's picture? Checked by the server's object service. */
  const checkLayout = useCallback(async () => {
    const v = video.current;
    if (!v || v.videoWidth === 0) return setLayoutMessage("Chưa có hình từ điện thoại.");
    setLayout("checking");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / v.videoWidth);
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.7));
    if (!blob) return setLayout("unknown");
    try {
      const res = await verifyMobileLayout(examId, blob);
      setLayout(res.ok ? "ok" : "bad");
      setLayoutMessage(res.message);
    } catch (e) {
      setLayout("bad");
      setLayoutMessage(e instanceof Error ? e.message : "Không kiểm tra được góc đặt điện thoại.");
    }
  }, [examId]);

  useEffect(() => () => void leave(), [leave]);

  return { qr, link, layout, layoutMessage, error, connect, checkLayout, attach, leave, url: url.current };
}
