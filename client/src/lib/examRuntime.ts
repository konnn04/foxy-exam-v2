import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { attachAiEvidence, getMobileViewer, sendAiFrame, type MonitoringConfig, type ViolationType } from "./api";
import { getSession } from "./session";
import { PhoneFeed, type PhoneState } from "./phoneFeed";
import { bypass } from "./dev";
import { useExamGuard } from "./examGuard";
import { getLobbyMedia, releaseLobbyMedia, setLobbyMedia } from "./lobbyMedia";
import { LiveKitPublisher, explain, FAILURE_TEXT, onTrackEnded, openCamera, openScreen, stopStream } from "./media";
import { RealtimeClient, type RtCommand, type RtStatus } from "./realtime";
import { captureFrame, collectEvidence, releaseEvidence } from "./evidence";
import { FaceMonitor, type VisionSample } from "./vision";
import { isLookingAway } from "./vision-core";

export const SPOT_CHECK_SECONDS = 10;

export interface ExamWarning {
  id: string;
  message: string;
}

export type CaptureState = "none" | "ok" | "lost";

/** Offline longer than this and the attempt counts as absent (the server enforces the same limit). */
export const OFFLINE_LIMIT_S = 5 * 60;

/** Looking away this long blurs the exam; facing the screen again for the second value clears it. */
const BLUR_AFTER_MS = 1500;
const UNBLUR_AFTER_MS = 600;

/**
 * Everything an exam window needs besides its own questions:
 *   guard    OS-level monitoring (focus, devices, banned apps, keystrokes, lockdown) -> violations
 *   realtime batched telemetry to the server (1 request/second) with REST fallback
 *   media    camera + screen captured in the lobby, published to LiveKit; losing one blocks the exam
 *   vision   on-device MediaPipe face analysis (faces, distance, gaze) -> attention + violations
 *   commands warnings / pause / force-end sent by a proctor
 *   close    Alt+F4 / X never just closes: the window asks for a confirmation first
 *
 *   const rt = useExamRuntime(config);
 *   await rt.begin(attemptId);   // after the paper loaded
 *   await rt.end();              // on submit / leave: stops everything, releases the camera
 */
export function useExamRuntime(config: Partial<MonitoringConfig> | null | undefined) {
  const [status, setStatus] = useState<RtStatus>("off");
  const [warning, setWarning] = useState<ExamWarning | null>(null);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const [mediaState, setMediaState] = useState<"none" | "connecting" | "connected" | "reconnecting" | "disconnected">("none");
  const [camera, setCamera] = useState<CaptureState>("none");
  const [screen, setScreen] = useState<CaptureState>("none");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [sample, setSample] = useState<VisionSample | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [offlineFor, setOfflineFor] = useState(0);
  const [closeRequested, setCloseRequested] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const publisher = useRef<LiveKitPublisher | null>(null);
  const vision = useRef<FaceMonitor | null>(null);
  const offTracks = useRef<(() => void)[]>([]);
  const active = useRef(false);
  const aiTimer = useRef<number | undefined>(undefined);
  const cfgRef = useRef(config);
  cfgRef.current = config ?? cfgRef.current;
  const [blurred, setBlurred] = useState(false);
  const [phoneState, setPhoneState] = useState<PhoneState>("off");
  const [phoneStream, setPhoneStream] = useState<MediaStream | null>(null);
  const [spot, setSpot] = useState<{ left: number } | null>(null);
  const phoneFeed = useRef<PhoneFeed | null>(null);
  const phoneRef = useRef<MediaStream | null>(null);
  const phoneEverLive = useRef(false);
  const lastPhoneLoss = useRef(0);
  const spotTimer = useRef<number | undefined>(undefined);
  const spotTick = useRef<number | undefined>(undefined);
  const badSince = useRef<number | null>(null);
  const goodSince = useRef<number | null>(null);

  const client = useMemo(
    () =>
      new RealtimeClient({
        onStatus: setStatus,
        onEnd: (s) => setEnded(s),
        onCommand: (cmd: RtCommand) => {
          if (cmd.type === "WARN") setWarning({ id: cmd.id, message: cmd.message || "Giám thị nhắc nhở bạn." });
          else if (cmd.type === "PAUSE") setPaused(true);
          else if (cmd.type === "RESUME") setPaused(false);
          else if (cmd.type === "FORCE_END") setEnded("force_ended");
        },
      }),
    [],
  );

  const guard = useExamGuard(config, client);
  const needCamera = Boolean(config?.ai_face_check) && !bypass("camera");
  const needScreen = Boolean(config?.require_screen) && !bypass("screen");

  // --- capture tracks: losing one is a violation, and a blocker when the exam requires it ---------------
  const watchTracks = useCallback(() => {
    offTracks.current.forEach((f) => f());
    offTracks.current = [];
    const media = getLobbyMedia();
    setCamera(media.camera ? "ok" : "none");
    setScreen(media.screen ? "ok" : "none");
    offTracks.current.push(
      onTrackEnded(media.camera, () => {
        if (!active.current) return;
        setCamera("lost");
        client.setState({ camera: false });
        guard.report("CAMERA_LOST", "HIGH", "Camera bị tắt hoặc rút ra giữa giờ thi");
      }),
      onTrackEnded(media.screen, () => {
        if (!active.current) return;
        setScreen("lost");
        client.setState({ screen: false });
        guard.report("SCREEN_SHARE_STOPPED", "HIGH", "Chia sẻ màn hình bị dừng giữa giờ thi");
      }),
    );
  }, [client, guard]);

  const startVision = useCallback(
    async (stream: MediaStream) => {
      vision.current?.stop();
      vision.current = null;
      // the config may still be the previous render's: read the latest one. A dev camera bypass only means "not required" - a camera that is open is still analysed
      if (!cfgRef.current?.ai_face_check) return;
      const m = new FaceMonitor(
        (s) => {
          setSample(s);
          client.setState({ attention: s.attention, faces: s.faces });
        },
        (e) => guard.report(e.kind, e.severity, e.message, { seconds: e.seconds }),
      );
      try {
        const delegate = await m.start(stream);
        console.info(`[vision] MediaPipe chạy bằng ${delegate}`);
        vision.current = m;
        setVisionError(null);
      } catch (err) {
        // the exam goes on; the proctor still sees the camera, only the on-device analysis is off
        m.stop();
        console.error("[vision] MediaPipe không chạy:", err);
        setVisionError(err instanceof Error ? err.message : "Không bật được phân tích khuôn mặt");
      }
    },
    [client, guard],
  );

  /** Watches the linked phone for the whole exam; losing it is a violation (and a blocker when the exam requires it). */
  const startPhone = useCallback(async () => {
    const examId = getSession()?.exam.id;
    if (!examId || (cfgRef.current?.extra_camera ?? "off") === "off") return;
    try {
      const res = (await getMobileViewer(examId)).data;
      if (!res?.viewer) return;
      const feed = new PhoneFeed(
        (s) => {
          setPhoneState(s);
          if (s === "live") phoneEverLive.current = true;
          const now = Date.now();
          if (s === "lost" && phoneEverLive.current && active.current && now - lastPhoneLoss.current > 30_000) {
            lastPhoneLoss.current = now;
            guard.report("PHONE_DISCONNECTED", "HIGH", "Camera phụ (điện thoại) mất kết nối");
          }
        },
        (stream) => {
          phoneRef.current = stream;
          setPhoneStream(stream);
          setLobbyMedia({ phone: stream });
        },
      );
      phoneFeed.current = feed;
      await feed.connect(res.viewer);
    } catch (err) {
      console.warn("[runtime] phone camera feed failed:", err);
      setPhoneState("lost");
    }
  }, [guard]);

  /** At random moments the candidate must look at the phone camera for 10 s; not doing so is a violation. */
  const scheduleSpotCheck = useCallback(() => {
    window.clearTimeout(spotTimer.current);
    if (!cfgRef.current?.extra_camera_spot_check) return;
    const run = async () => {
      const stream = phoneRef.current;
      if (!active.current) return;
      if (!stream) {
        spotTimer.current = window.setTimeout(() => void run(), 60_000); // phone not visible right now: ask again soon
        return;
      }
      let ok = 0;
      let total = 0;
      const monitor = new FaceMonitor(
        (s) => {
          total += 1;
          if (s.faces === 1 && !isLookingAway(s)) ok += 1;
        },
        () => {},
      );
      try {
        await monitor.start(stream);
      } catch {
        monitor.stop();
        spotTimer.current = window.setTimeout(() => void run(), 15 * 60_000); // cannot analyse here: never punish the candidate for it
        return;
      }
      let left = SPOT_CHECK_SECONDS;
      setSpot({ left });
      spotTick.current = window.setInterval(() => {
        left -= 1;
        setSpot({ left });
        if (left > 0) return;
        window.clearInterval(spotTick.current);
        monitor.stop();
        setSpot(null);
        if (active.current && total >= 8 && ok / total < 0.4) {
          guard.report("SPOT_CHECK_FAILED", "MEDIUM", `Không nhìn camera phụ khi được yêu cầu (${ok}/${total} khung hình)`, { frames_ok: ok, frames_total: total });
        }
        spotTimer.current = window.setTimeout(() => void run(), (8 + Math.random() * 10) * 60_000);
      }, 1000);
    };
    spotTimer.current = window.setTimeout(() => void run(), (6 + Math.random() * 8) * 60_000);
  }, [guard]);

  /** Every ~40 s one camera frame goes to the server's AI checks; when it flags something the picture is attached as evidence. */
  const startAiFrames = useCallback(() => {
    window.clearTimeout(aiTimer.current);
    const c = cfgRef.current;
    if (!c?.ai_identity && !c?.ai_objects && !(c?.extra_camera_objects && (c.extra_camera ?? "off") !== "off")) return;
    const tick = async () => {
      if (!active.current) return;
      try {
        const withPhone = (cfgRef.current?.extra_camera ?? "off") !== "off";
        const blob = await captureFrame("camera");
        if (blob && (cfgRef.current?.ai_identity || cfgRef.current?.ai_objects)) {
          const res = await sendAiFrame(blob);
          if (res.violation_ids?.length) {
            const kind: ViolationType = res.prohibited.length ? "PROHIBITED_DEVICE" : "FACE_MISMATCH";
            const set = await collectEvidence(client, kind, withPhone, { camera: blob });
            if (set.primary) await attachAiEvidence(res.violation_ids, set.primary, set.all);
          }
        }
        if (withPhone && cfgRef.current?.extra_camera_objects) {
          const shot = await captureFrame("phone");
          if (shot) {
            const res = await sendAiFrame(shot, "phone");
            if (res.violation_ids?.length) {
              const set = await collectEvidence(client, "PROHIBITED_DEVICE", true, { phone: shot });
              if (set.primary) await attachAiEvidence(res.violation_ids, set.primary, set.all);
            }
          }
        }
      } catch {
        /* a missed frame is just a missed frame */
      }
      aiTimer.current = window.setTimeout(() => void tick(), 35_000 + Math.random() * 10_000);
    };
    aiTimer.current = window.setTimeout(() => void tick(), 8_000);
  }, [client]);

  const begin = useCallback(
    async (attemptId: number, cfg?: Partial<MonitoringConfig> | null) => {
      if (cfg) cfgRef.current = cfg;
      setEnded(null);
      setPaused(false);
      setWarning(null);
      setRestoreError(null);
      active.current = true;
      const live = await client.start(attemptId); // false => REST fallback
      const media = getLobbyMedia();
      client.setState({ camera: !!media.camera, screen: !!media.screen });
      setCameraStream(media.camera);
      watchTracks();

      const lk = live ? client.livekit : null;
      if (lk && (media.camera || media.screen)) {
        try {
          const pub = new LiveKitPublisher(setMediaState);
          await pub.connect(lk);
          if (media.camera) await pub.publish("camera", media.camera);
          if (media.screen) {
            await pub.publish("screen", media.screen);
            await pub.publishAudio(media.screen);
          }
          publisher.current = pub;
        } catch (err) {
          console.warn("[runtime] LiveKit publish failed (exam continues, telemetry still flows):", err);
          setMediaState("disconnected");
        }
      }
      if (media.camera) void startVision(media.camera);
      startAiFrames();
      void startPhone().then(scheduleSpotCheck);
      await guard.start(cfgRef.current);
    },
    [client, guard, startAiFrames, startPhone, scheduleSpotCheck, startVision, watchTracks],
  );

  const end = useCallback(async () => {
    active.current = false;
    window.clearTimeout(aiTimer.current);
    window.clearTimeout(spotTimer.current);
    window.clearInterval(spotTick.current);
    setSpot(null);
    await phoneFeed.current?.stop();
    phoneFeed.current = null;
    phoneEverLive.current = false;
    offTracks.current.forEach((f) => f());
    offTracks.current = [];
    vision.current?.stop();
    vision.current = null;
    setBlurred(false);
    badSince.current = goodSince.current = null;
    await guard.stop();
    await client.stop();
    await publisher.current?.disconnect();
    publisher.current = null;
    releaseEvidence();
    releaseLobbyMedia();
    setCameraStream(null);
    setCamera("none");
    setScreen("none");
    setSample(null);
  }, [client, guard]);

  /** Re-open the camera after it was lost (needs the student's click for the permission prompt). */
  const restoreCamera = useCallback(async () => {
    setRestoreError(null);
    try {
      stopStream(getLobbyMedia().camera);
      const s = await openCamera();
      setLobbyMedia({ camera: s });
      setCameraStream(s);
      await publisher.current?.publish("camera", s).catch(() => {});
      client.setState({ camera: true });
      watchTracks();
      void startVision(s);
    } catch (e) {
      setRestoreError(FAILURE_TEXT[explain(e)]);
    }
  }, [client, startVision, watchTracks]);

  const restoreScreen = useCallback(async () => {
    setRestoreError(null);
    try {
      stopStream(getLobbyMedia().screen);
      const s = await openScreen();
      setLobbyMedia({ screen: s });
      await publisher.current?.publish("screen", s).catch(() => {});
      await publisher.current?.publishAudio(s);
      client.setState({ screen: true });
      watchTracks();
    } catch (e) {
      setRestoreError(FAILURE_TEXT[explain(e)]);
    }
  }, [client, watchTracks]);

  // --- the exam content blurs while the candidate is not facing the screen (no violation: the tracker reports separately) ---
  useEffect(() => {
    if (!sample || !active.current) return;
    const now = Date.now();
    const away = sample.faces === 0 || (sample.faces === 1 && isLookingAway(sample));
    if (away) {
      goodSince.current = null;
      badSince.current ??= now;
      if (now - badSince.current >= BLUR_AFTER_MS) setBlurred(true);
    } else {
      badSince.current = null;
      goodSince.current ??= now;
      if (now - goodSince.current >= UNBLUR_AFTER_MS) setBlurred(false);
    }
  }, [sample]);

  // --- connection loss: after 5 minutes the candidate is absent (the server closes the attempt as well) ------
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!active.current) return;
      const down = !navigator.onLine || status === "degraded";
      setOfflineFor((s) => (down ? s + 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [status]);
  useEffect(() => {
    if (offlineFor >= OFFLINE_LIMIT_S) setEnded("absent");
  }, [offlineFor]);

  // --- Alt+F4 / X on the exam window: Rust emits instead of closing -----------------------------------------
  useEffect(() => {
    const un = getCurrentWindow().listen("exam://close-requested", () => setCloseRequested(true));
    return () => void un.then((f) => f());
  }, []);

  // a window that goes away mid-exam must not leave the camera light on
  useEffect(() => {
    const stop = () => releaseLobbyMedia();
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, []);

  const needPhone = cfgRef.current?.extra_camera === "required";
  const blocker =
    needCamera && camera === "lost"
      ? ({ kind: "camera", text: "Camera đã bị tắt. Bật lại camera để tiếp tục làm bài." } as const)
      : needScreen && screen === "lost"
        ? ({ kind: "screen", text: "Bạn đã dừng chia sẻ màn hình. Chia sẻ lại để tiếp tục làm bài." } as const)
        : needPhone && phoneState === "lost" && active.current
          ? ({ kind: "phone", text: "Camera phụ (điện thoại) đã mất kết nối. Mở lại trang camera trên điện thoại, đặt đúng góc rồi bài thi sẽ tự mở lại." } as const)
          : null;

  return {
    guard,
    status,
    mediaState,
    warning,
    dismissWarning: () => setWarning(null),
    paused,
    ended,
    begin,
    end,
    setQuestion: (n: number) => client.setState({ question: n }),
    camera,
    screen,
    cameraStream,
    sample,
    visionError,
    blurred,
    needs: { camera: Boolean(config?.ai_face_check), mic: Boolean(config?.require_mic), screen: Boolean(config?.require_screen), phone: (config?.extra_camera ?? "off") !== "off" },
    blocker,
    phone: { state: phoneState, stream: phoneStream },
    spot,
    restoreCamera,
    restoreScreen,
    restoreError,
    offlineFor,
    closeRequested,
    dismissClose: () => setCloseRequested(false),
  };
}
