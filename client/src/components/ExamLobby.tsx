import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Check, Cpu, Loader2, Mic, Monitor, MonitorUp, QrCode, RefreshCw, ScanFace, ShieldAlert, Smartphone, Wifi, X } from "lucide-react";
import { Badge, Button, cx } from "./ui";
import { DevPanel } from "./DevPanel";
import { usePhoneCamera } from "../lib/phoneCamera";
import { ApiError, enrollFace, getExam, getFaceChange, getFacePhoneLink, getFaceStatus, getHealth, requestFaceChange, startExam, type ExamDetail } from "../lib/api";
import QRCode from "qrcode";
import { captureFrame } from "../lib/evidence";
import { bypass, IS_DEV } from "../lib/dev";
import { clearPendingExam, getLobbyMedia, releaseLobbyMedia, setLobbyMedia, type PendingExam } from "../lib/lobbyMedia";
import { explain, failureText, listCameras, micMeter, openCamera, openMic, openScreen, setPreferredCamera, getPreferredCamera, stopStream, type CameraInfo } from "../lib/media";
import { FaceMonitor } from "../lib/vision";
import { clearOverlay, drawFaceOverlay } from "../lib/faceOverlay";
import { frontalHint, isFrontal, LivenessChallenge, livenessText, type FrameReading } from "../lib/vision-core";
import { captureDevices, DEFAULT_BANNED_APPS, getProcesses, getSnapshot, screenCount, type SystemSnapshot } from "../lib/monitor";
import { getAuth } from "../lib/authStore";
import { formatDateTime } from "../lib/datetime";
import { saveSession } from "../lib/session";
import { dialog, errorText } from "../lib/dialog";
import { diag } from "../lib/diag";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { translate as t, useI18n } from "../lib/i18n";

type Level = "idle" | "checking" | "ok" | "warn" | "fail";

interface Check {
  id: "network" | "exam" | "display" | "apps" | "camera" | "face" | "liveness" | "enroll" | "phone" | "mic" | "screen";
  label: string;
  level: Level;
  detail: string;
  /** A failing required check blocks the start button. */
  required: boolean;
}

const ORDER: Check["id"][] = ["network", "exam", "display", "apps", "camera", "face", "liveness", "enroll", "phone", "mic", "screen"];

const matchesBanned = (name: string) => {
  const n = name.toLowerCase().replace(/\.exe$/, "");
  return DEFAULT_BANNED_APPS.some((b) => (b.endsWith("*") ? n.startsWith(b.slice(0, -1)) : n === b));
};

/**
 * Pre-exam setup ("phòng chờ"): verifies the machine BEFORE an attempt exists, so the exam clock only starts
 * when the student presses "Bắt đầu". Camera / screen captured here are kept for the exam screen (same window)
 * and published to the proctors. In dev builds every step can be bypassed with the DEV panel.
 */
export default function ExamLobby({
  pending,
  onStarted,
  onCancel,
}: {
  pending: PendingExam;
  onStarted: () => void;
  onCancel: () => void;
}) {
  useI18n(); // re-render when the language changes (texts below use the global translate)
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [checks, setChecks] = useState<Record<Check["id"], Check>>(() => initial());
  const [level, setLevel] = useState(0);
  const [starting, setStarting] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [screenBusy, setScreenBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stopMeter = useRef<(() => void) | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const startedRef = useRef(false);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>(() => getPreferredCamera() ?? "");
  const face = useRef<FaceMonitor | null>(null);
  const liveFeed = useRef<((r: FrameReading) => void) | null>(null);

  const set = useCallback((id: Check["id"], patch: Partial<Check>) => setChecks((c) => ({ ...c, [id]: { ...c[id], ...patch } })), []);

  const cfg = detail?.monitoring_config ?? null;
  const needCamera = Boolean(cfg?.ai_face_check) && !bypass("camera");
  const needMic = Boolean(cfg?.require_mic);
  const needScreen = Boolean(cfg?.require_screen) && !bypass("screen");
  // what the exam asks for decides what the student sees: nothing optional is offered
  const wantCamera = Boolean(cfg?.ai_face_check);
  const wantMic = Boolean(cfg?.require_mic);
  const wantScreen = Boolean(cfg?.require_screen);
  const wantIdentity = Boolean(cfg?.ai_identity);
  const wantPhone = (cfg?.extra_camera ?? "off") !== "off";
  const needPhone = cfg?.extra_camera === "required";
  const [enrolling, setEnrolling] = useState(false);
  const phone = usePhoneCamera(pending.id);

  const attachPreview = useCallback((s: MediaStream | null) => {
    if (video.current) video.current.srcObject = s;
  }, []);

  const stopFace = useCallback(() => {
    face.current?.stop();
    face.current = null;
    clearOverlay(overlay.current);
  }, []);

  /** Watches the preview with MediaPipe: the exam can start only while exactly one face is in front of the camera. */
  const watchFace = useCallback(
    async (stream: MediaStream, required: boolean) => {
      stopFace();
      set("face", { level: "checking", detail: t("lobby.face.checking"), required });
      let seen = 0;
      let missed = 0;
      let ok = false;
      let gotSample = false;
      let gaveUp = false;
      // the analysis cannot run on this machine: do not lock the candidate out, the proctor still sees the camera
      const giveUp = (why: string) => {
        if (gaveUp) return;
        gaveUp = true;
        diag(`lobby: face analysis skipped (${why})`);
        face.current?.stop();
        face.current = null;
        clearOverlay(overlay.current);
        liveFeed.current = null;
        set("face", { level: "warn", detail: t("lobby.face.skip"), required: false });
      };
      const m = new FaceMonitor(
        (s) => {
          gotSample = true;
          liveFeed.current?.(s);
          drawFaceOverlay(overlay.current, video.current, s.landmarks, s.faces > 1 ? "bad" : isFrontal(s) ? "ok" : "warn");
          if (isFrontal(s)) {
            seen += 1;
            missed = 0;
          } else {
            missed += 1;
            seen = 0;
          }
          if (!ok && seen >= 3) {
            ok = true;
            set("face", { level: "ok", detail: t("lobby.face.ok"), required });
          } else if ((ok && missed >= 6) || (!ok && missed >= 3)) {
            ok = false;
            set("face", { level: "fail", detail: frontalHint(s), required });
          }
        },
        () => {},
      );
      try {
        m.onFailure = (err) => giveUp(`detection kept failing: ${err instanceof Error ? err.message : String(err)}`);
        await m.start(stream);
        face.current = m;
        // no reading at all after a while: it is stuck, not slow
        window.setTimeout(() => {
          if (!gotSample && face.current === m) giveUp("no reading after 12s");
        }, 12_000);
      } catch (e) {
        // the analysis itself cannot run on this machine: do not lock the candidate out, the proctor still sees the camera
        m.stop();
        console.error("[lobby] MediaPipe failed to start:", e);
        diag(`lobby: face analysis could not start (${e instanceof Error ? e.message : String(e)})`);
        set("face", { level: "warn", detail: t("lobby.face.skip"), required: false });
      }
    },
    [set, stopFace],
  );

  /** Liveness: blink twice and turn the head (random order, 10 s per step). Required when the exam checks identity. */
  const startLiveness = useCallback(() => {
    const challenge = new LivenessChallenge();
    const required = Boolean(cfg?.ai_identity);
    let lastText = "";
    const show = (detail: string, level: Level = "checking") => set("liveness", { level, detail, required });
    show(t("lobby.liveness.step", { n: 1, text: livenessText(challenge.steps[0]) }));
    liveFeed.current = (r) => {
      const st = challenge.update(r, performance.now() / 1000);
      if (st.done) {
        liveFeed.current = null;
        show(t("lobby.liveness.done"), "ok");
      } else if (st.failed) {
        liveFeed.current = null;
        show(t("lobby.liveness.failed"), "fail");
      } else if (st.step) {
        const text = t("lobby.liveness.step", { n: challenge.steps.indexOf(st.step) + 1, text: livenessText(st.step) });
        if (text !== lastText) {
          lastText = text;
          show(text);
        }
      }
    };
  }, [cfg?.ai_identity, set]);

  const runCamera = useCallback(
    async (required: boolean, deviceId?: string) => {
      if (bypass("camera")) {
        set("face", { level: "warn", detail: t("lobby.cam.devBypassFace"), required: false });
        return set("camera", { level: "warn", detail: t("lobby.cam.devBypass"), required: false });
      }
      stopFace();
      set("camera", { level: "checking", detail: t("lobby.cam.opening"), required });
      set("face", { level: "idle", detail: t("lobby.face.waitCamera"), required });
      liveFeed.current = null;
      set("liveness", { level: "idle", detail: t("lobby.liveness.idle"), required: Boolean(cfg?.ai_identity) && required });
      try {
        stopStream(getLobbyMedia().camera);
        const s = await openCamera(deviceId ?? (cameraId || null));
        setLobbyMedia({ camera: s });
        attachPreview(s);
        const track = s.getVideoTracks()[0];
        const used = track?.getSettings().deviceId;
        if (used) {
          setCameraId(used);
          setPreferredCamera(used);
        }
        // labels are readable only after permission: refresh the list now
        void listCameras().then(setCameras).catch(() => {});
        set("camera", { level: "ok", detail: track?.label || t("lobby.cam.working"), required });
        void watchFace(s, required);
      } catch (e) {
        set("camera", { level: required ? "fail" : "warn", detail: failureText(explain(e)), required });
        set("face", { level: "idle", detail: t("lobby.face.waitCamera"), required });
        liveFeed.current = null;
        set("liveness", { level: "idle", detail: t("lobby.liveness.idle"), required: Boolean(cfg?.ai_identity) && required });
      }
    },
    [attachPreview, cameraId, set, stopFace, watchFace],
  );

  const runMic = useCallback(
    async (required: boolean) => {
      set("mic", { level: "checking", detail: t("lobby.mic.opening"), required });
      try {
        stopMeter.current?.();
        stopStream(micStream.current);
        const s = await openMic();
        micStream.current = s;
        stopMeter.current = micMeter(s, setLevel);
        set("mic", { level: "ok", detail: s.getAudioTracks()[0]?.label || t("lobby.mic.working"), required });
      } catch (e) {
        set("mic", { level: required ? "fail" : "warn", detail: failureText(explain(e)), required });
      }
    },
    [set],
  );

  const shareScreen = useCallback(async () => {
    setScreenBusy(true);
    try {
      stopStream(getLobbyMedia().screen);
      const s = await openScreen();
      setLobbyMedia({ screen: s });
      set("screen", { level: "ok", detail: s.getAudioTracks().length > 0 ? t("lobby.screen.sharedAudio") : t("lobby.screen.shared"), required: needScreen });
      s.getVideoTracks()[0]?.addEventListener("ended", () => set("screen", { level: needScreen ? "fail" : "warn", detail: t("lobby.screen.stopped"), required: needScreen }));
    } catch (e) {
      set("screen", { level: needScreen ? "fail" : "warn", detail: `${failureText(explain(e))}${needScreen ? "" : t("lobby.optionalSuffix")}`, required: needScreen });
    } finally {
      setScreenBusy(false);
    }
  }, [set, needScreen]);

  const runAll = useCallback(async () => {
    setError(null);
    setChecks(initial());
    let d: ExamDetail | null = null;

    // 1. network + clock
    set("network", { level: "checking", detail: t("lobby.net.connecting") });
    try {
      const t0 = Date.now();
      const h = await getHealth();
      const ms = Date.now() - t0;
      const skew = h.timestamp ? Math.abs(Date.now() - new Date(h.timestamp).getTime()) : 0;
      set("network", skew > 120_000 ? { level: "warn", detail: t("lobby.net.skew", { s: Math.round(skew / 1000) }) } : { level: "ok", detail: t("lobby.net.ok", { ms }) });
    } catch {
      set("network", bypass("network") ? { level: "warn", detail: t("lobby.net.devBypass") } : { level: "fail", detail: t("lobby.net.fail") });
    }

    // 2. exam: schedule, enrolment, AI availability
    set("exam", { level: "checking", detail: t("lobby.exam.checking") });
    try {
      d = (await getExam(pending.id)).data;
      setDetail(d);
      const now = Date.now();
      if (d.start_time && now < new Date(d.start_time).getTime()) set("exam", { level: "fail", detail: t("lobby.exam.notOpen", { at: formatDateTime(d.start_time) }) });
      else if (d.end_time && now > new Date(d.end_time).getTime()) set("exam", { level: "fail", detail: t("lobby.exam.closed") });
      else if (!d.can_start) set("exam", { level: "fail", detail: d.ai_service?.message || t("lobby.exam.cantStart") });
      else set("exam", { level: "ok", detail: t("lobby.exam.ok", { min: d.duration_minutes, code: d.code }) });
    } catch (e) {
      set("exam", { level: "fail", detail: e instanceof ApiError ? e.message : t("lobby.exam.loadFail") });
    }

    // 3 + 4. displays and banned apps (Rust monitor)
    set("display", { level: "checking", detail: t("lobby.display.checking") });
    set("apps", { level: "checking", detail: t("lobby.apps.checking") });
    let snap: SystemSnapshot | null = null;
    try {
      snap = await getSnapshot();
    } catch {
      /* not running inside Tauri (plain browser dev) */
    }
    if (!snap) {
      set("display", { level: "warn", detail: t("lobby.display.noInfo"), required: false });
      set("apps", { level: "warn", detail: t("lobby.apps.noInfo"), required: false });
    } else {
      const n = screenCount(snap.displays, snap.devices);
      const cards = captureDevices(snap.devices);
      set(
        "display",
        bypass("devices")
          ? { level: n <= 1 && cards.length === 0 ? "ok" : "warn", detail: n <= 1 && cards.length === 0 ? t("lobby.display.one") : t("lobby.display.devBypass", { n, c: cards.length }) }
          : cards.length > 0
            ? { level: "fail", detail: t("lobby.display.capture", { names: cards.map((c) => c.name).join(", ") }) }
            : n > 1
              ? { level: "fail", detail: t("lobby.display.multi", { n }) }
              : { level: "ok", detail: t("lobby.display.one") },
      );
      try {
        const bad = [...new Set((await getProcesses()).map((p) => p.name).filter(matchesBanned))];
        set("apps", bad.length === 0 ? { level: "ok", detail: t("lobby.apps.none") } : bypass("devices") ? { level: "warn", detail: t("lobby.apps.devBypass", { names: bad.join(", ") }) } : { level: "fail", detail: t("lobby.apps.close", { names: bad.join(", ") }) });
      } catch {
        set("apps", { level: "warn", detail: t("lobby.apps.noList"), required: false });
      }
    }

    // 5 + 6 + 7. media (needs the exam config for "required")
    const reqCam = Boolean(d?.monitoring_config?.ai_face_check) && !bypass("camera");
    // the camera and microphone are opened only when the student asks, never silently on entering the lobby
    set("camera", { level: "idle", detail: reqCam ? t("lobby.cam.requiredPrompt") : t("lobby.cam.optionalPrompt"), required: reqCam });
    set("face", { level: "idle", detail: t("lobby.face.turnOnCamera"), required: reqCam });
    set("liveness", { level: "idle", detail: t("lobby.liveness.idle"), required: Boolean(d?.monitoring_config?.ai_identity) && reqCam });
    if (d?.monitoring_config?.ai_identity) {
      try {
        const st = (await getFaceStatus()).data;
        set("enroll", st.enrolled ? { level: "ok", detail: t("lobby.enroll.have"), required: true } : { level: "fail", detail: t("lobby.enroll.missing"), required: true });
      } catch {
        set("enroll", { level: "fail", detail: t("lobby.enroll.statusFail"), required: true });
      }
    }
    set("mic", { level: "idle", detail: t("lobby.mic.prompt"), required: Boolean(d?.monitoring_config?.require_mic) });
    if (bypass("screen")) set("screen", { level: "warn", detail: t("lobby.screen.devBypass"), required: false });
    else if (d?.monitoring_config?.require_screen) set("screen", { level: "idle", detail: t("lobby.screen.requiredPrompt"), required: true });
    else set("screen", { level: "idle", detail: t("lobby.screen.optionalPrompt"), required: false });
  }, [pending.id, runCamera, runMic, set]);

  useEffect(() => {
    diag("lobby mounted");
    const refreshCameras = () => void listCameras().then(setCameras).catch(() => {});
    refreshCameras();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshCameras);
    void runAll();
    // the lobby holds the camera: let go of it whenever the window is hidden or the lobby ends without an exam
    const onHide = () => document.visibilityState === "hidden" && !startedRef.current && releaseLobbyMedia();
    document.addEventListener("visibilitychange", onHide);
    const closing = getCurrentWindow().listen("exam://close-requested", async () => {
      const leave = await dialog.confirm({ title: t("lobby.dlg.leaveTitle"), text: t("lobby.dlg.leaveText"), confirmLabel: t("lobby.dlg.leave"), tone: "warning" });
      if (leave) cancelRef.current();
    });
    return () => {
      diag("lobby unmounted");
      navigator.mediaDevices.removeEventListener?.("devicechange", refreshCameras);
      face.current?.stop();
      face.current = null;
      document.removeEventListener("visibilitychange", onHide);
      void closing.then((off) => off());
      stopMeter.current?.();
      stopStream(micStream.current); // the lobby mic is only a test; the exam does not record audio
      if (!startedRef.current) releaseLobbyMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => attachPreview(getLobbyMedia().camera), [checks.camera.level, attachPreview]);

  useEffect(() => {
    if (!wantPhone) return;
    const bad = needPhone ? "fail" : "warn";
    if (phone.link === "idle") set("phone", { level: needPhone ? "fail" : "idle", detail: t("lobby.phone.idle"), required: needPhone });
    else if (phone.link === "error") set("phone", { level: bad, detail: phone.error || t("lobby.phone.linkFail"), required: needPhone });
    else if (phone.link === "waiting") set("phone", { level: bad, detail: t("lobby.phone.waiting"), required: needPhone });
    else if (phone.layout === "ok") set("phone", { level: "ok", detail: phone.layoutMessage || t("lobby.phone.good"), required: needPhone });
    else if (phone.layout === "bad") set("phone", { level: bad, detail: phone.layoutMessage, required: needPhone });
    else set("phone", { level: "checking", detail: t("lobby.phone.checking"), required: needPhone });
  }, [wantPhone, needPhone, phone.link, phone.layout, phone.layoutMessage, phone.error, set]);

  // the link is created as soon as the exam is known to want a phone
  const autoLink = useRef(false);
  useEffect(() => {
    if (wantPhone && phone.link === "idle" && !autoLink.current && detail) {
      autoLink.current = true;
      void phone.connect();
    }
  }, [wantPhone, phone, detail]);

  // a phone that just connected gets its placement checked after a moment (time to put it down)
  useEffect(() => {
    if (phone.link !== "connected" || phone.layout !== "unknown") return;
    const t = window.setTimeout(() => void phone.checkLayout(), 3000);
    return () => window.clearTimeout(t);
  }, [phone.link, phone.layout, phone.checkLayout]);

  // face enrolment from the phone: a single-use QR; the lobby checks the status (every few seconds, only while the QR is open)
  const [faceQr, setFaceQr] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [changeState, setChangeState] = useState<string | null>(null);

  useEffect(() => {
    getFaceChange()
      .then((r) => r.data && setChangeState(r.data.status === "PENDING" ? t("lobby.change.pending") : r.data.status === "REJECTED" ? `${t("lobby.change.rejected")}${r.data.note ? `: ${r.data.note}` : "."}` : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!faceQr) return;
    const poll = window.setInterval(() => {
      void getFaceStatus()
        .then((r) => {
          if (!r.data.enrolled) return;
          setFaceQr(null);
          set("enroll", { level: "ok", detail: t("lobby.enroll.fromPhone"), required: true });
        })
        .catch(() => {});
    }, 3000);
    const stop = window.setTimeout(() => setFaceQr(null), 10 * 60_000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, [faceQr, set]);

  const openPhoneEnroll = useCallback(async () => {
    try {
      const r = await getFacePhoneLink();
      setFaceQr(await QRCode.toDataURL(r.data.url, { margin: 1, width: 264 }));
    } catch (e) {
      void dialog.alert({ title: t("lobby.dlg.qrFailTitle"), text: errorText(e, t("lobby.dlg.retryLater")), tone: "danger" });
    }
  }, []);

  const sendChange = useCallback(async () => {
    try {
      const r = await requestFaceChange(changeReason.trim());
      setChangeOpen(false);
      setChangeReason("");
      setChangeState(t("lobby.change.pending"));
      void dialog.alert({ title: t("lobby.dlg.sentTitle"), text: r.message, tone: "success" });
    } catch (e) {
      void dialog.alert({ title: t("lobby.dlg.sendFailTitle"), text: errorText(e, t("lobby.dlg.retryLater")), tone: "danger" });
    }
  }, [changeReason]);

  const enroll = useCallback(async () => {
    setEnrolling(true);
    try {
      const blob = await captureFrame("camera");
      if (!blob) throw new Error(t("lobby.dlg.noFrame"));
      await enrollFace(blob);
      set("enroll", { level: "ok", detail: t("lobby.enroll.done"), required: true });
      void dialog.alert({ title: t("lobby.dlg.enrolledTitle"), text: t("lobby.dlg.enrolledText"), tone: "success" });
    } catch (e) {
      void dialog.alert({ title: t("lobby.dlg.enrollFailTitle"), text: errorText(e, t("lobby.dlg.retryLater")), tone: "danger" });
    } finally {
      setEnrolling(false);
    }
  }, [set]);

  const blockers = ORDER.map((id) => checks[id]).filter((c) => c.required && c.level !== "ok" && c.level !== "warn");
  const checking = ORDER.some((id) => checks[id].level === "checking");
  // a required check that only warned (e.g. dev bypass) does not block; "fail" and "idle" on required ones do
  const ready = !checking && blockers.length === 0 && checks.exam.level === "ok" && checks.network.level !== "fail" && checks.display.level !== "fail" && checks.apps.level !== "fail";

  const start = useCallback(async () => {
    const auth = getAuth();
    if (!auth) return void dialog.alert({ title: t("lobby.dlg.expiredTitle"), text: t("lobby.dlg.expiredText"), tone: "warning" });
    setStarting(true);
    setError(null);
    try {
      if (needScreen && !getLobbyMedia().screen?.active) await shareScreen();
      if (needScreen && !getLobbyMedia().screen?.active) {
        setStarting(false);
        return void dialog.alert({ title: t("lobby.dlg.noScreenTitle"), text: t("lobby.dlg.noScreenText"), tone: "warning" });
      }
      const res = (await startExam(pending.id)).data;
      saveSession({
        token: auth.token,
        attemptId: res.attempt_id,
        attemptNumber: res.attempt_number,
        maxAttempts: null,
        student: { id: auth.user.id, username: auth.user.username, name: auth.user.name },
        exam: { id: res.exam.id, title: res.exam.title, code: res.exam.code, type: res.exam.type, duration_minutes: res.duration_minutes, monitoring_config: res.exam.monitoring_config },
      });
      clearPendingExam();
      startedRef.current = true;
      onStarted();
    } catch (e) {
      const text = e instanceof ApiError ? e.message : errorText(e, t("lobby.dlg.cantEnterText"));
      setError(text);
      void dialog.alert({ title: t("lobby.dlg.cantEnterTitle"), text, tone: "danger" });
    } finally {
      setStarting(false);
    }
  }, [onStarted, pending.id, needScreen, shareScreen]);

  // dev: "setup" bypass goes straight in as soon as the exam detail is known
  const auto = useRef(false);
  useEffect(() => {
    if (IS_DEV && bypass("setup") && checks.exam.level === "ok" && !auto.current) {
      auto.current = true;
      void start();
    }
  }, [checks.exam.level, start]);

  const cancel = () => {
    diag("lobby cancel");
    releaseLobbyMedia();
    clearPendingExam();
    onCancel();
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  const isResuming = Boolean(pending.resuming || detail?.latest_attempt?.status === "IN_PROGRESS");

  return (
    <div className="flex h-screen flex-col bg-app text-fg">
      <div className={cx("flex h-7 shrink-0 items-center gap-2 px-4 text-[11px]", isResuming ? "bg-danger-soft text-danger font-medium" : "bg-surface-3 text-muted")}>
        <ShieldAlert size={12} />
        {isResuming
          ? t("lobby.title.resumeBar")
          : t("lobby.title.bar")}
        {IS_DEV && <span className="ml-auto font-mono text-warning">DEV</span>}
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 gap-6 overflow-y-auto p-6">
        <section className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{pending.title}</h1>
            {isResuming && <Badge tone="danger">{t("lobby.badge.resuming")}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {pending.code}
            {detail ? ` · ${detail.course?.name ?? ""} · ${t("lobby.minutes", { n: detail.duration_minutes })}` : ""}
          </p>
          {detail?.description && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-xs text-muted">{detail.description}</p>}

          <h2 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{t("lobby.section.devices")}</h2>
          <ul className="space-y-1.5">
            <Row c={checks.network} icon={<Wifi size={14} />} />
            <Row c={checks.exam} icon={<ShieldAlert size={14} />} />
            <Row c={checks.display} icon={<Monitor size={14} />} />
            <Row c={checks.apps} icon={<Cpu size={14} />} />
            {wantCamera && <Row c={{ ...checks.camera, required: needCamera }} icon={<Camera size={14} />} action={checks.camera.level !== "ok" && checks.camera.level !== "checking" ? <Button size="sm" onClick={() => void runCamera(needCamera)}>{checks.camera.level === "idle" ? t("lobby.cam.on") : t("lobby.retry")}</Button> : undefined} />}
            {wantCamera && cameras.length > 1 && (
              <li className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                <Camera size={14} className="text-muted" />
                <span className="text-muted">{t("lobby.cam.pick")}</span>
                <select
                  value={cameraId}
                  onChange={(e) => {
                    setCameraId(e.target.value);
                    void runCamera(needCamera, e.target.value);
                  }}
                  className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 text-xs text-fg outline-none"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </li>
            )}
            {wantCamera && <Row c={{ ...checks.face, required: needCamera }} icon={<ScanFace size={14} />} />}
            {wantCamera && (
              <Row
                c={{ ...checks.liveness, required: wantIdentity && needCamera }}
                icon={<ScanFace size={14} />}
                action={
                  checks.liveness.level !== "ok" && checks.liveness.level !== "checking" ? (
                    <Button size="sm" disabled={checks.face.level !== "ok"} onClick={startLiveness}>
                      {checks.liveness.level === "fail" ? t("lobby.retry") : t("lobby.start")}
                    </Button>
                  ) : undefined
                }
              />
            )}
            {wantIdentity && (
              <Row
                c={{ ...checks.enroll, required: true }}
                icon={<ScanFace size={14} />}
                action={
                  checks.enroll.level !== "ok" ? (
                    <span className="flex gap-1.5">
                      <Button size="sm" loading={enrolling} disabled={checks.face.level !== "ok"} onClick={() => void enroll()}>
                        {t("lobby.enroll.register")}
                      </Button>
                      <Button size="sm" icon={<Smartphone size={12} />} onClick={() => void openPhoneEnroll()}>
                        {t("lobby.enroll.byPhone")}
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => setChangeOpen((o) => !o)}>
                      {t("lobby.enroll.change")}
                    </Button>
                  )
                }
              />
            )}
            {wantIdentity && faceQr && (
              <li className="flex items-center gap-4 rounded-lg border border-line bg-surface p-3">
                <img src={faceQr} alt={t("lobby.enroll.qrAlt")} className="h-[132px] w-[132px] shrink-0 rounded-md bg-white p-1" />
                <div className="min-w-0 space-y-1 text-[11px] leading-relaxed text-muted">
                  <p className="text-xs font-medium text-fg">{t("lobby.enroll.qrTitle")}</p>
                  <p>{t("lobby.enroll.qrHelp")}</p>
                  <button type="button" className="text-accent hover:underline" onClick={() => void openPhoneEnroll()}>
                    {t("lobby.newCode")}
                  </button>
                </div>
              </li>
            )}
            {wantIdentity && changeState && <li className="rounded-lg border border-line bg-surface px-3 py-2 text-[11px] text-muted">{changeState}</li>}
            {wantIdentity && changeOpen && checks.enroll.level === "ok" && (
              <li className="space-y-2 rounded-lg border border-line bg-surface p-3">
                <p className="text-xs font-medium text-fg">{t("lobby.change.reasonTitle")}</p>
                <textarea
                  value={changeReason}
                  maxLength={500}
                  onChange={(e) => setChangeReason(e.target.value)}
                  className="h-16 w-full rounded-md border border-line bg-surface-2 p-2 text-xs text-fg outline-none"
                  placeholder={t("lobby.change.placeholder")}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" disabled={changeReason.trim().length < 5} onClick={() => void sendChange()}>
                    {t("lobby.change.send")}
                  </Button>
                  <Button size="sm" onClick={() => setChangeOpen(false)}>
                    {t("lobby.cancel")}
                  </Button>
                </div>
              </li>
            )}
            {wantPhone && (
              <Row
                c={{ ...checks.phone, required: needPhone }}
                icon={<Smartphone size={14} />}
                action={
                  phone.link === "idle" || phone.link === "error" ? (
                    <Button size="sm" icon={<QrCode size={12} />} onClick={() => void phone.connect(true)}>
                      {t("lobby.phone.qr")}
                    </Button>
                  ) : phone.link === "connected" ? (
                    <span className="flex gap-1.5">
                      <Button size="sm" loading={phone.layout === "checking"} onClick={() => void phone.checkLayout()}>
                        {t("lobby.phone.checkLayout")}
                      </Button>
                      <Button size="sm" icon={<QrCode size={12} />} onClick={() => void phone.connect(true)}>
                        {t("lobby.phone.change")}
                      </Button>
                    </span>
                  ) : undefined
                }
              />
            )}
            {wantPhone && phone.qr && phone.link !== "connected" && (
              <li className="flex items-center gap-4 rounded-lg border border-line bg-surface p-3">
                <img src={phone.qr} alt={t("lobby.phone.qrAlt")} className="h-[132px] w-[132px] shrink-0 rounded-md bg-white p-1" />
                <div className="min-w-0 space-y-1 text-[11px] leading-relaxed text-muted">
                  <p className="text-xs font-medium text-fg">{t("lobby.enroll.qrTitle")}</p>
                  <p>{t("lobby.phone.step1")}</p>
                  <p>{t("lobby.phone.step2")}</p>
                  <p>{t("lobby.phone.step3")}</p>
                  <button type="button" className="text-accent hover:underline" onClick={() => void phone.connect(true)}>
                    {t("lobby.newCode")}
                  </button>
                </div>
              </li>
            )}
            {wantMic && <Row c={{ ...checks.mic, required: needMic }} icon={<Mic size={14} />} action={checks.mic.level !== "ok" && checks.mic.level !== "checking" ? <Button size="sm" onClick={() => void runMic(needMic)}>{checks.mic.level === "idle" ? t("lobby.mic.test") : t("lobby.retry")}</Button> : undefined} />}
            {wantScreen && <Row
              c={{ ...checks.screen, required: needScreen }}
              icon={<MonitorUp size={14} />}
              action={
                !bypass("screen") && (
                  <Button size="sm" loading={screenBusy} onClick={() => void shareScreen()}>
                    {t("lobby.screen.share")}
                  </Button>
                )
              }
            />}
          </ul>

          <div className="mt-5 flex items-center gap-2">
            <Button icon={<RefreshCw size={13} />} onClick={() => void runAll()} disabled={checking || starting}>
              {t("lobby.recheck")}
            </Button>
            <Button onClick={cancel} disabled={starting}>
              {t("lobby.back")}
            </Button>
          </div>
        </section>

        <aside className="w-[300px] shrink-0 space-y-3">
          {wantCamera && (
            <div className="relative overflow-hidden rounded-xl border border-line bg-black">
              <video ref={video} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
              {/* what MediaPipe recognised, drawn over the picture */}
              <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
            </div>
          )}
          {wantPhone && phone.link === "connected" && (
            <div className="overflow-hidden rounded-xl border border-line bg-black">
              <video ref={phone.attach} autoPlay muted playsInline className="aspect-video w-full object-cover" />
              <p className="bg-surface px-2.5 py-1 text-[10px] text-muted">{t("lobby.phone.preview")}</p>
            </div>
          )}
          {wantMic && <div className="rounded-xl border border-line bg-surface p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted">
              <Mic size={12} /> {t("lobby.mic.level")}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-success transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>}
          <ul className="space-y-1 rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-muted">
            {wantCamera && <li>{t("lobby.tip.light")}</li>}
            <li>{t("lobby.tip.apps")}</li>
            <li>{t("lobby.tip.display")}</li>
            <li>{t("lobby.tip.focus")}</li>
          </ul>

          <Button variant="primary" size="lg" className="w-full" disabled={!ready} loading={starting} onClick={() => void start()}>
            {isResuming ? t("lobby.cta.resume") : t("lobby.cta.start")}
          </Button>
          {!ready && !checking && <p className="text-center text-[11px] text-danger">{t("lobby.fixRed")}</p>}
        </aside>
      </div>
      <DevPanel />
    </div>
  );
}

function initial(): Record<Check["id"], Check> {
  const mk = (id: Check["id"], required: boolean): Check => ({ id, label: id, level: "idle", detail: t("lobby.notChecked"), required });
  return {
    network: mk("network", true),
    exam: mk("exam", true),
    display: mk("display", true),
    apps: mk("apps", true),
    camera: mk("camera", false),
    face: mk("face", false),
    liveness: mk("liveness", false),
    enroll: mk("enroll", false),
    phone: mk("phone", false),
    mic: mk("mic", false),
    screen: mk("screen", false),
  };
}

const TONE: Record<Level, string> = {
  idle: "border-line bg-surface text-muted",
  checking: "border-line bg-surface text-muted",
  ok: "border-success/30 bg-success-soft text-fg",
  warn: "border-warning/40 bg-warning-soft text-fg",
  fail: "border-danger/40 bg-danger-soft text-danger",
};

function Row({ c, icon, action }: { c: Check; icon: ReactNode; action?: ReactNode }) {
  return (
    <li className={cx("flex items-center gap-3 rounded-lg border px-3 py-2 text-xs", TONE[c.level])}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {t(`lobby.check.${c.id}`)} {c.required && <Badge tone="neutral">{t("lobby.required")}</Badge>}
        </p>
        <p className="truncate text-[11px] opacity-80">{c.detail}</p>
      </div>
      {action}
      <span className="shrink-0">
        {c.level === "checking" ? <Loader2 size={14} className="animate-spin" /> : c.level === "ok" ? <Check size={14} className="text-success" /> : c.level === "fail" ? <X size={14} /> : null}
      </span>
    </li>
  );
}
