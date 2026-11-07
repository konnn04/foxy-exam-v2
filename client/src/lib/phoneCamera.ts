import QRCode from "qrcode";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMobileViewer, issueMobileCamera, verifyMobileLayout } from "./api";

export type PhoneLink = "idle" | "waiting" | "connected" | "error";
export type Layout = "unknown" | "checking" | "ok" | "bad";

export interface PhoneTelemetry {
  type: string;
  facing?: "environment" | "user";
  portrait?: boolean;
  tiltWarning?: string | null;
  visibility?: string;
}

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
  const phoneTelemetry = useRef<PhoneTelemetry | null>(null);

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

  const connect = useCallback(async (forceNew = false) => {
    setLink("idle");
    setLayout("unknown");
    setError("");
    await leave();
    try {
      // If reconnecting to an in-progress attempt and the phone is already streaming in the room,
      // reuse the existing viewer first unless the student explicitly asked for a new QR code.
      let viewer: { url: string; token: string; room: string } | null = null;
      if (!forceNew) {
        const existing = (await getMobileViewer(examId).catch(() => ({ data: null }))).data;
        if (existing?.connected && existing.viewer) {
          viewer = existing.viewer;
        }
      }
      if (!viewer) {
        const res = (await issueMobileCamera(examId)).data;
        url.current = res.url;
        setQr(await QRCode.toDataURL(res.url, { margin: 1, width: 220, errorCorrectionLevel: "M" }));
        viewer = res.viewer;
      }
      if (!viewer) throw new Error("Máy chủ chưa bật hệ thống phát hình.");
      const r = new Room({ adaptiveStream: true });
      r.on(RoomEvent.TrackSubscribed, (t) => {
        if (t.kind !== Track.Kind.Video) return;
        track.current = t;
        if (video.current) t.attach(video.current);
        setLink("connected");
        // Whenever a new video track is published (e.g. camera switched on phone), reset layout verification!
        setLayout("unknown");
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
        .on(RoomEvent.DataReceived, (payload) => {
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload)) as PhoneTelemetry;
            phoneTelemetry.current = msg;
            if (msg.type === "CAMERA_SWITCHED") {
              setLayout("bad");
              setLayoutMessage("Bạn vừa đổi camera trên điện thoại. Vui lòng đặt lại máy và bấm “Kiểm tra góc đặt”.");
            } else if (msg.type === "PHONE_SCREEN_OFF" || msg.visibility === "hidden") {
              setLayout("bad");
              setLayoutMessage("Màn hình điện thoại đang bị tắt hoặc trình duyệt bị ẩn. Hãy mở lại trang camera trên điện thoại.");
            } else if (msg.portrait) {
              setLayout("bad");
              setLayoutMessage("Điện thoại đang đặt dọc. Hãy xoay ngang điện thoại (Landscape) để thấy bạn và màn hình laptop.");
            } else if (msg.tiltWarning) {
              setLayout("bad");
              setLayoutMessage(msg.tiltWarning);
            }
          } catch {
            /* ignore malformed payload */
          }
        })
        .on(RoomEvent.Disconnected, () => setLink((l) => (l === "connected" ? "waiting" : l)));
      await r.connect(viewer.url, viewer.token);
      room.current = r;
      setLink("waiting");
      // a phone that was already in the room
      let alreadyPublishing = false;
      r.remoteParticipants.forEach((p) =>
        p.trackPublications.forEach((pub) => {
          if (pub.track && pub.kind === Track.Kind.Video) {
            track.current = pub.track as RemoteTrack;
            if (video.current) pub.track.attach(video.current);
            setLink("connected");
            alreadyPublishing = true;
          }
        }),
      );
      if (!forceNew && !url.current && !alreadyPublishing) {
        const res = (await issueMobileCamera(examId)).data;
        url.current = res.url;
        setQr(await QRCode.toDataURL(res.url, { margin: 1, width: 220, errorCorrectionLevel: "M" }));
      }
    } catch (e) {
      setLink("error");
      setError(e instanceof Error ? e.message : "Không tạo được liên kết cho điện thoại.");
    }
  }, [examId, leave]);

  /** Is the candidate (and the laptop) visible in the phone's picture? Checked by the server's object service + local sensor check. */
  const checkLayout = useCallback(async () => {
    const v = video.current;
    if (!v || v.videoWidth === 0) return setLayoutMessage("Chưa có hình từ điện thoại.");
    // 1. Check orientation & telemetry before sending to server
    if (v.videoHeight > v.videoWidth || phoneTelemetry.current?.portrait) {
      setLayout("bad");
      setLayoutMessage("Điện thoại đang đặt dọc. Hãy xoay ngang điện thoại (Landscape) rồi bấm kiểm tra lại.");
      return;
    }
    if (phoneTelemetry.current?.visibility === "hidden") {
      setLayout("bad");
      setLayoutMessage("Trang camera trên điện thoại đang bị ẩn hoặc tắt màn hình. Hãy mở lại trên điện thoại.");
      return;
    }
    if (phoneTelemetry.current?.tiltWarning) {
      setLayout("bad");
      setLayoutMessage(phoneTelemetry.current.tiltWarning);
      return;
    }
    setLayout("checking");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / v.videoWidth);
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(v, 0, 0, canvas.width, canvas.height);

    // 2. Client-side brightness / covered-camera check
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      let sqSum = 0;
      const step = 16 * 4;
      let count = 0;
      for (let i = 0; i < imgData.length; i += step) {
        const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
        sum += lum;
        sqSum += lum * lum;
        count++;
      }
      const mean = sum / Math.max(1, count);
      const std = Math.sqrt(Math.max(0, sqSum / Math.max(1, count) - mean * mean));
      if (mean < 15 || std < 6) {
        setLayout("bad");
        setLayoutMessage("Khung hình từ điện thoại quá tối hoặc camera đang bị che. Hãy bật đèn và đặt điện thoại nhìn vào bạn và laptop.");
        return;
      }
    }

    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.75));
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
