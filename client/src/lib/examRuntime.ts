import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MonitoringConfig } from "./api";
import { bypass } from "./dev";
import { useExamGuard } from "./examGuard";
import { getLobbyMedia, releaseLobbyMedia, setLobbyMedia } from "./lobbyMedia";
import { LiveKitPublisher, explain, FAILURE_TEXT, onTrackEnded, openCamera, openScreen, stopStream } from "./media";
import { RealtimeClient, type RtCommand, type RtStatus } from "./realtime";
import { FaceMonitor, type VisionSample } from "./vision";

export interface ExamWarning {
  id: string;
  message: string;
}

export type CaptureState = "none" | "ok" | "lost";

/** Offline longer than this and the attempt counts as absent (the server enforces the same limit). */
export const OFFLINE_LIMIT_S = 5 * 60;

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
      if (!config?.ai_face_check || bypass("camera")) return;
      const m = new FaceMonitor(
        (s) => {
          setSample(s);
          client.setState({ attention: s.attention, faces: s.faces });
        },
        (e) => guard.report(e.kind, e.severity, e.message, { seconds: e.seconds }),
      );
      try {
        await m.start(stream);
        vision.current = m;
        setVisionError(null);
      } catch (err) {
        // the exam goes on; the proctor still sees the camera, only the on-device analysis is off
        m.stop();
        setVisionError(err instanceof Error ? err.message : "Không bật được phân tích khuôn mặt");
      }
    },
    [client, config?.ai_face_check, guard],
  );

  const begin = useCallback(
    async (attemptId: number) => {
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
          if (media.screen) await pub.publish("screen", media.screen);
          publisher.current = pub;
        } catch (err) {
          console.warn("[runtime] LiveKit publish failed (exam continues, telemetry still flows):", err);
          setMediaState("disconnected");
        }
      }
      if (media.camera) void startVision(media.camera);
      await guard.start();
    },
    [client, guard, startVision, watchTracks],
  );

  const end = useCallback(async () => {
    active.current = false;
    offTracks.current.forEach((f) => f());
    offTracks.current = [];
    vision.current?.stop();
    vision.current = null;
    await guard.stop();
    await client.stop();
    await publisher.current?.disconnect();
    publisher.current = null;
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
      client.setState({ screen: true });
      watchTracks();
    } catch (e) {
      setRestoreError(FAILURE_TEXT[explain(e)]);
    }
  }, [client, watchTracks]);

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

  const blocker =
    needCamera && camera === "lost"
      ? ({ kind: "camera", text: "Camera đã bị tắt. Bật lại camera để tiếp tục làm bài." } as const)
      : needScreen && screen === "lost"
        ? ({ kind: "screen", text: "Bạn đã dừng chia sẻ màn hình. Chia sẻ lại để tiếp tục làm bài." } as const)
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
    blocker,
    restoreCamera,
    restoreScreen,
    restoreError,
    offlineFor,
    closeRequested,
    dismissClose: () => setCloseRequested(false),
  };
}
