import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MonitoringConfig } from "./api";
import { useExamGuard } from "./examGuard";
import { LiveKitPublisher, onTrackEnded } from "./media";
import { getLobbyMedia, releaseLobbyMedia } from "./lobbyMedia";
import { RealtimeClient, type RtCommand, type RtStatus } from "./realtime";

export interface ExamWarning {
  id: string;
  message: string;
}

/**
 * Everything an exam window needs besides its own questions:
 *   guard    – OS-level monitoring (focus, devices, banned apps, keystrokes) → violations
 *   realtime – the batched telemetry channel to the server (1 request/second) with REST fallback
 *   media    – camera + screen captured in the lobby are published to LiveKit while the exam runs
 *   commands – warnings / pause / force-end sent by a proctor
 *
 *   const rt = useExamRuntime(config);
 *   await rt.begin(attemptId);   // after the paper loaded
 *   await rt.end();              // on submit / leave
 *   rt.ended → leave the room    rt.warning → show banner     rt.paused → block the paper
 */
export function useExamRuntime(config: Partial<MonitoringConfig> | null | undefined) {
  const [status, setStatus] = useState<RtStatus>("off");
  const [warning, setWarning] = useState<ExamWarning | null>(null);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const [mediaState, setMediaState] = useState<"none" | "connecting" | "connected" | "reconnecting" | "disconnected">("none");

  const publisher = useRef<LiveKitPublisher | null>(null);
  const offTracks = useRef<(() => void)[]>([]);

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

  const begin = useCallback(
    async (attemptId: number) => {
      setEnded(null);
      setPaused(false);
      setWarning(null);
      const live = await client.start(attemptId); // false => REST fallback, nothing else to do
      const media = getLobbyMedia();
      client.setState({ camera: !!media.camera, screen: !!media.screen });

      // keep the proctor informed when a capture dies mid-exam
      offTracks.current.push(
        onTrackEnded(media.camera, () => {
          client.setState({ camera: false });
          guard.report("DEVICE_CHANGED", "HIGH", "Camera bị tắt hoặc rút ra giữa giờ thi");
        }),
        onTrackEnded(media.screen, () => {
          client.setState({ screen: false });
          guard.report("PROHIBITED_DEVICE", "HIGH", "Chia sẻ màn hình bị dừng giữa giờ thi");
        }),
      );

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
      await guard.start();
    },
    [client, guard],
  );

  const end = useCallback(async () => {
    offTracks.current.forEach((f) => f());
    offTracks.current = [];
    await guard.stop();
    await client.stop();
    await publisher.current?.disconnect();
    publisher.current = null;
    releaseLobbyMedia();
  }, [client, guard]);

  // closing the window mid-exam must not leave the camera light on
  useEffect(() => () => void releaseLobbyMedia(), []);

  return { guard, status, mediaState, warning, dismissWarning: () => setWarning(null), paused, ended, begin, end, setQuestion: (n: number) => client.setState({ question: n }) };
}
