import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Check, Cpu, Loader2, Mic, Monitor, MonitorUp, QrCode, RefreshCw, ScanFace, ShieldAlert, Smartphone, Wifi, X } from "lucide-react";
import { Badge, Button, cx } from "./ui";
import { DevPanel } from "./DevPanel";
import { usePhoneCamera } from "../lib/phoneCamera";
import { ApiError, enrollFace, getExam, getFaceStatus, getHealth, startExam, type ExamDetail } from "../lib/api";
import { captureFrame } from "../lib/evidence";
import { bypass, IS_DEV } from "../lib/dev";
import { clearPendingExam, getLobbyMedia, releaseLobbyMedia, setLobbyMedia, type PendingExam } from "../lib/lobbyMedia";
import { explain, FAILURE_TEXT, listCameras, micMeter, openCamera, openMic, openScreen, setPreferredCamera, getPreferredCamera, stopStream, type CameraInfo } from "../lib/media";
import { FaceMonitor } from "../lib/vision";
import { frontalHint, isFrontal } from "../lib/vision-core";
import { captureDevices, DEFAULT_BANNED_APPS, getProcesses, getSnapshot, screenCount, type SystemSnapshot } from "../lib/monitor";
import { getAuth } from "../lib/authStore";
import { formatDateTime } from "../lib/datetime";
import { saveSession } from "../lib/session";
import { dialog, errorText } from "../lib/dialog";
import { diag } from "../lib/diag";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Level = "idle" | "checking" | "ok" | "warn" | "fail";

interface Check {
  id: "network" | "exam" | "display" | "apps" | "camera" | "face" | "enroll" | "phone" | "mic" | "screen";
  label: string;
  level: Level;
  detail: string;
  /** A failing required check blocks the start button. */
  required: boolean;
}

const ORDER: Check["id"][] = ["network", "exam", "display", "apps", "camera", "face", "enroll", "phone", "mic", "screen"];

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
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [checks, setChecks] = useState<Record<Check["id"], Check>>(() => initial());
  const [level, setLevel] = useState(0);
  const [starting, setStarting] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [screenBusy, setScreenBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stopMeter = useRef<(() => void) | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const startedRef = useRef(false);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>(() => getPreferredCamera() ?? "");
  const face = useRef<FaceMonitor | null>(null);

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
  }, []);

  /** Watches the preview with MediaPipe: the exam can start only while exactly one face is in front of the camera. */
  const watchFace = useCallback(
    async (stream: MediaStream, required: boolean) => {
      stopFace();
      set("face", { level: "checking", detail: "Đang kiểm tra… ngồi thẳng, nhìn vào camera, thấy rõ hai mắt", required });
      let seen = 0;
      let missed = 0;
      let ok = false;
      const m = new FaceMonitor(
        (s) => {
          if (isFrontal(s)) {
            seen += 1;
            missed = 0;
          } else {
            missed += 1;
            seen = 0;
          }
          if (!ok && seen >= 3) {
            ok = true;
            set("face", { level: "ok", detail: "Khuôn mặt thẳng, thấy rõ hai mắt", required });
          } else if ((ok && missed >= 6) || (!ok && missed >= 3)) {
            ok = false;
            set("face", { level: "fail", detail: frontalHint(s), required });
          }
        },
        () => {},
      );
      try {
        await m.start(stream);
        face.current = m;
      } catch (e) {
        // the analysis itself cannot run on this machine: do not lock the candidate out, the proctor still sees the camera
        m.stop();
        console.error("[lobby] MediaPipe không chạy:", e);
        set("face", { level: "warn", detail: "Không phân tích được khuôn mặt trên máy này — bỏ qua bước này", required: false });
      }
    },
    [set, stopFace],
  );

  const runCamera = useCallback(
    async (required: boolean, deviceId?: string) => {
      if (bypass("camera")) {
        set("face", { level: "warn", detail: "Dev: bỏ qua nhận diện khuôn mặt", required: false });
        return set("camera", { level: "warn", detail: "Dev: bỏ qua camera", required: false });
      }
      stopFace();
      set("camera", { level: "checking", detail: "Đang mở camera…", required });
      set("face", { level: "idle", detail: "Chờ camera", required });
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
        set("camera", { level: "ok", detail: track?.label || "Camera hoạt động", required });
        void watchFace(s, required);
      } catch (e) {
        set("camera", { level: required ? "fail" : "warn", detail: FAILURE_TEXT[explain(e)], required });
        set("face", { level: "idle", detail: "Chờ camera", required });
      }
    },
    [attachPreview, cameraId, set, stopFace, watchFace],
  );

  const runMic = useCallback(
    async (required: boolean) => {
      set("mic", { level: "checking", detail: "Đang mở micro…", required });
      try {
        stopMeter.current?.();
        stopStream(micStream.current);
        const s = await openMic();
        micStream.current = s;
        stopMeter.current = micMeter(s, setLevel);
        set("mic", { level: "ok", detail: s.getAudioTracks()[0]?.label || "Micro hoạt động — hãy nói thử", required });
      } catch (e) {
        set("mic", { level: required ? "fail" : "warn", detail: FAILURE_TEXT[explain(e)], required });
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
      set("screen", { level: "ok", detail: s.getAudioTracks().length > 0 ? "Đã chia sẻ toàn màn hình (có âm thanh)" : "Đã chia sẻ toàn màn hình", required: needScreen });
      s.getVideoTracks()[0]?.addEventListener("ended", () => set("screen", { level: needScreen ? "fail" : "warn", detail: "Đã dừng chia sẻ màn hình", required: needScreen }));
    } catch (e) {
      set("screen", { level: needScreen ? "fail" : "warn", detail: `${FAILURE_TEXT[explain(e)]}${needScreen ? "" : " (không bắt buộc)"}`, required: needScreen });
    } finally {
      setScreenBusy(false);
    }
  }, [set, needScreen]);

  const runAll = useCallback(async () => {
    setError(null);
    setChecks(initial());
    let d: ExamDetail | null = null;

    // 1. network + clock
    set("network", { level: "checking", detail: "Đang kết nối máy chủ…" });
    try {
      const t0 = Date.now();
      const h = await getHealth();
      const ms = Date.now() - t0;
      const skew = h.timestamp ? Math.abs(Date.now() - new Date(h.timestamp).getTime()) : 0;
      set("network", skew > 120_000 ? { level: "warn", detail: `Đồng hồ máy lệch ${Math.round(skew / 1000)}s so với máy chủ` } : { level: "ok", detail: `Máy chủ phản hồi ${ms} ms` });
    } catch {
      set("network", bypass("network") ? { level: "warn", detail: "Dev: bỏ qua lỗi mạng" } : { level: "fail", detail: "Không kết nối được máy chủ FoxyExam" });
    }

    // 2. exam: schedule, enrolment, AI availability
    set("exam", { level: "checking", detail: "Đang kiểm tra kỳ thi…" });
    try {
      d = (await getExam(pending.id)).data;
      setDetail(d);
      const now = Date.now();
      if (d.start_time && now < new Date(d.start_time).getTime()) set("exam", { level: "fail", detail: `Kỳ thi chưa mở (bắt đầu ${formatDateTime(d.start_time)})` });
      else if (d.end_time && now > new Date(d.end_time).getTime()) set("exam", { level: "fail", detail: "Kỳ thi đã đóng" });
      else if (!d.can_start) set("exam", { level: "fail", detail: d.ai_service?.message || "Chưa thể bắt đầu kỳ thi này" });
      else set("exam", { level: "ok", detail: `${d.duration_minutes} phút · mã ${d.code}` });
    } catch (e) {
      set("exam", { level: "fail", detail: e instanceof ApiError ? e.message : "Không tải được thông tin kỳ thi" });
    }

    // 3 + 4. displays and banned apps (Rust monitor)
    set("display", { level: "checking", detail: "Đang kiểm tra màn hình…" });
    set("apps", { level: "checking", detail: "Đang kiểm tra ứng dụng…" });
    let snap: SystemSnapshot | null = null;
    try {
      snap = await getSnapshot();
    } catch {
      /* not running inside Tauri (plain browser dev) */
    }
    if (!snap) {
      set("display", { level: "warn", detail: "Không đọc được thông tin màn hình (ngoài Tauri)", required: false });
      set("apps", { level: "warn", detail: "Không đọc được danh sách tiến trình (ngoài Tauri)", required: false });
    } else {
      const n = screenCount(snap.displays, snap.devices);
      const cards = captureDevices(snap.devices);
      set(
        "display",
        bypass("devices")
          ? { level: n <= 1 && cards.length === 0 ? "ok" : "warn", detail: n <= 1 && cards.length === 0 ? "1 màn hình" : `Dev: bỏ qua ${n} màn hình / ${cards.length} capture` }
          : cards.length > 0
            ? { level: "fail", detail: `Có thiết bị capture/video-in: ${cards.map((c) => c.name).join(", ")} — hãy rút ra` }
            : n > 1
              ? { level: "fail", detail: `Đang có ${n} màn hình (kể cả màn nhân bản / màn ảo) — hãy rút màn hình phụ` }
              : { level: "ok", detail: "1 màn hình" },
      );
      try {
        const bad = [...new Set((await getProcesses()).map((p) => p.name).filter(matchesBanned))];
        set("apps", bad.length === 0 ? { level: "ok", detail: "Không có ứng dụng bị cấm" } : bypass("devices") ? { level: "warn", detail: `Dev: bỏ qua ${bad.join(", ")}` } : { level: "fail", detail: `Hãy đóng: ${bad.join(", ")}` });
      } catch {
        set("apps", { level: "warn", detail: "Không đọc được danh sách tiến trình", required: false });
      }
    }

    // 5 + 6 + 7. media (needs the exam config for "required")
    const reqCam = Boolean(d?.monitoring_config?.ai_face_check) && !bypass("camera");
    // the camera and microphone are opened only when the student asks, never silently on entering the lobby
    set("camera", { level: "idle", detail: reqCam ? "Bắt buộc — nhấn “Bật camera” để kiểm tra" : "Nhấn “Bật camera” để kiểm tra (không bắt buộc)", required: reqCam });
    set("face", { level: "idle", detail: "Bật camera để nhận diện khuôn mặt", required: reqCam });
    if (d?.monitoring_config?.ai_identity) {
      try {
        const st = (await getFaceStatus()).data;
        set("enroll", st.enrolled ? { level: "ok", detail: "Đã có khuôn mặt tham chiếu của bạn", required: true } : { level: "fail", detail: "Bạn chưa đăng ký khuôn mặt — bật camera, nhìn thẳng rồi bấm “Đăng ký”", required: true });
      } catch {
        set("enroll", { level: "fail", detail: "Không kiểm tra được trạng thái đăng ký khuôn mặt", required: true });
      }
    }
    set("mic", { level: "idle", detail: "Nhấn “Kiểm tra micro” để thử", required: Boolean(d?.monitoring_config?.require_mic) });
    if (bypass("screen")) set("screen", { level: "warn", detail: "Dev: bỏ qua chia sẻ màn hình", required: false });
    else if (d?.monitoring_config?.require_screen) set("screen", { level: "idle", detail: "Bắt buộc chia sẻ TOÀN MÀN HÌNH — nhấn “Chia sẻ màn hình”", required: true });
    else set("screen", { level: "idle", detail: "Nhấn “Chia sẻ màn hình” để giám thị theo dõi bài làm (khuyến nghị)", required: false });
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
      const leave = await dialog.confirm({ title: "Rời phòng chờ?", text: "Bạn chưa bắt đầu làm bài. Camera và chia sẻ màn hình sẽ được tắt.", confirmLabel: "Rời đi", tone: "warning" });
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
    if (phone.link === "idle") set("phone", { level: needPhone ? "fail" : "idle", detail: "Nhấn “Tạo mã QR”, rồi quét bằng điện thoại", required: needPhone });
    else if (phone.link === "error") set("phone", { level: bad, detail: phone.error || "Không tạo được liên kết", required: needPhone });
    else if (phone.link === "waiting") set("phone", { level: bad, detail: "Đang chờ điện thoại — quét mã QR và bật camera", required: needPhone });
    else if (phone.layout === "ok") set("phone", { level: "ok", detail: phone.layoutMessage || "Điện thoại đã kết nối, góc đặt phù hợp", required: needPhone });
    else if (phone.layout === "bad") set("phone", { level: bad, detail: phone.layoutMessage, required: needPhone });
    else set("phone", { level: "checking", detail: "Điện thoại đã kết nối — đang kiểm tra góc đặt…", required: needPhone });
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

  const enroll = useCallback(async () => {
    setEnrolling(true);
    try {
      const blob = await captureFrame("camera");
      if (!blob) throw new Error("Chưa có hình từ camera.");
      await enrollFace(blob);
      set("enroll", { level: "ok", detail: "Đã đăng ký khuôn mặt của bạn", required: true });
      void dialog.alert({ title: "Đã đăng ký khuôn mặt", text: "Khuôn mặt này sẽ được dùng để xác thực bạn trong kỳ thi. Muốn đổi, hãy nhờ giảng viên mở khoá.", tone: "success" });
    } catch (e) {
      void dialog.alert({ title: "Chưa đăng ký được khuôn mặt", text: errorText(e, "Thử lại sau."), tone: "danger" });
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
    if (!auth) return void dialog.alert({ title: "Phiên đăng nhập đã hết hạn", text: "Hãy đăng nhập lại để vào thi.", tone: "warning" });
    setStarting(true);
    setError(null);
    try {
      if (needScreen && !getLobbyMedia().screen?.active) await shareScreen();
      if (needScreen && !getLobbyMedia().screen?.active) {
        setStarting(false);
        return void dialog.alert({ title: "Chưa chia sẻ màn hình", text: "Kỳ thi này bắt buộc chia sẻ toàn màn hình. Nhấn “Bắt đầu” lần nữa và chọn Toàn màn hình (Entire screen).", tone: "warning" });
      }
      const res = (await startExam(pending.id)).data;
      saveSession({
        token: auth.token,
        attemptId: res.attempt_id,
        attemptNumber: res.attempt_number,
        maxAttempts: null,
        student: { id: auth.user.id, username: auth.user.username, name: auth.user.name },
        exam: { id: res.exam.id, title: res.exam.title, code: res.exam.code, duration_minutes: res.duration_minutes, monitoring_config: res.exam.monitoring_config },
      });
      clearPendingExam();
      startedRef.current = true;
      onStarted();
    } catch (e) {
      const text = e instanceof ApiError ? e.message : errorText(e, "Không vào được phòng thi.");
      setError(text);
      void dialog.alert({ title: "Không vào được phòng thi", text, tone: "danger" });
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

  return (
    <div className="flex h-screen flex-col bg-app text-fg">
      <div className="flex h-7 shrink-0 items-center gap-2 bg-surface-3 px-4 text-[11px] text-muted">
        <ShieldAlert size={12} /> Chuẩn bị vào phòng thi — đồng hồ làm bài chỉ chạy khi bạn bấm “Bắt đầu”
        {IS_DEV && <span className="ml-auto font-mono text-warning">DEV</span>}
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 gap-6 overflow-y-auto p-6">
        <section className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">{pending.title}</h1>
          <p className="mt-0.5 text-xs text-muted">
            {pending.code}
            {detail ? ` · ${detail.course?.name ?? ""} · ${detail.duration_minutes} phút` : ""}
          </p>
          {detail?.description && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-xs text-muted">{detail.description}</p>}

          <h2 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Kiểm tra thiết bị</h2>
          <ul className="space-y-1.5">
            <Row c={checks.network} icon={<Wifi size={14} />} />
            <Row c={checks.exam} icon={<ShieldAlert size={14} />} />
            <Row c={checks.display} icon={<Monitor size={14} />} />
            <Row c={checks.apps} icon={<Cpu size={14} />} />
            {wantCamera && <Row c={{ ...checks.camera, required: needCamera }} icon={<Camera size={14} />} action={checks.camera.level !== "ok" && checks.camera.level !== "checking" ? <Button size="sm" onClick={() => void runCamera(needCamera)}>{checks.camera.level === "idle" ? "Bật camera" : "Thử lại"}</Button> : undefined} />}
            {wantCamera && cameras.length > 1 && (
              <li className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                <Camera size={14} className="text-muted" />
                <span className="text-muted">Chọn camera</span>
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
            {wantIdentity && (
              <Row
                c={{ ...checks.enroll, required: true }}
                icon={<ScanFace size={14} />}
                action={
                  checks.enroll.level !== "ok" ? (
                    <Button size="sm" loading={enrolling} disabled={checks.face.level !== "ok"} onClick={() => void enroll()}>
                      Đăng ký
                    </Button>
                  ) : undefined
                }
              />
            )}
            {wantPhone && (
              <Row
                c={{ ...checks.phone, required: needPhone }}
                icon={<Smartphone size={14} />}
                action={
                  phone.link === "idle" || phone.link === "error" ? (
                    <Button size="sm" icon={<QrCode size={12} />} onClick={() => void phone.connect()}>
                      Tạo mã QR
                    </Button>
                  ) : phone.link === "connected" ? (
                    <Button size="sm" loading={phone.layout === "checking"} onClick={() => void phone.checkLayout()}>
                      Kiểm tra góc đặt
                    </Button>
                  ) : undefined
                }
              />
            )}
            {wantPhone && phone.qr && phone.link !== "connected" && (
              <li className="flex items-center gap-4 rounded-lg border border-line bg-surface p-3">
                <img src={phone.qr} alt="Mã QR kết nối điện thoại" className="h-[132px] w-[132px] shrink-0 rounded-md bg-white p-1" />
                <div className="min-w-0 space-y-1 text-[11px] leading-relaxed text-muted">
                  <p className="text-xs font-medium text-fg">Quét bằng camera điện thoại</p>
                  <p>1. Mở liên kết, cho phép camera.</p>
                  <p>2. Đặt điện thoại nằm ngang ở góc bàn, thấy bạn và màn hình laptop.</p>
                  <p>3. Cắm sạc, giữ màn hình sáng suốt giờ thi.</p>
                  <button type="button" className="text-accent hover:underline" onClick={() => void phone.connect()}>
                    Tạo mã mới
                  </button>
                </div>
              </li>
            )}
            {wantMic && <Row c={{ ...checks.mic, required: needMic }} icon={<Mic size={14} />} action={checks.mic.level !== "ok" && checks.mic.level !== "checking" ? <Button size="sm" onClick={() => void runMic(needMic)}>{checks.mic.level === "idle" ? "Kiểm tra micro" : "Thử lại"}</Button> : undefined} />}
            {wantScreen && <Row
              c={{ ...checks.screen, required: needScreen }}
              icon={<MonitorUp size={14} />}
              action={
                !bypass("screen") && (
                  <Button size="sm" loading={screenBusy} onClick={() => void shareScreen()}>
                    Chia sẻ màn hình
                  </Button>
                )
              }
            />}
          </ul>

          <div className="mt-5 flex items-center gap-2">
            <Button icon={<RefreshCw size={13} />} onClick={() => void runAll()} disabled={checking || starting}>
              Kiểm tra lại
            </Button>
            <Button onClick={cancel} disabled={starting}>
              Quay lại
            </Button>
          </div>
        </section>

        <aside className="w-[300px] shrink-0 space-y-3">
          {wantCamera && (
            <div className="overflow-hidden rounded-xl border border-line bg-black">
              <video ref={video} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
            </div>
          )}
          {wantPhone && phone.link === "connected" && (
            <div className="overflow-hidden rounded-xl border border-line bg-black">
              <video ref={phone.attach} autoPlay muted playsInline className="aspect-video w-full object-cover" />
              <p className="bg-surface px-2.5 py-1 text-[10px] text-muted">Hình từ điện thoại</p>
            </div>
          )}
          {wantMic && <div className="rounded-xl border border-line bg-surface p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted">
              <Mic size={12} /> Mức âm thanh
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-success transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>}
          <ul className="space-y-1 rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-muted">
            {wantCamera && <li>• Ngồi nơi đủ sáng, thấy rõ mặt.</li>}
            <li>• Đóng mọi ứng dụng khác (chat, quay màn hình, điều khiển từ xa).</li>
            <li>• Chỉ dùng một màn hình, không cắm thêm bàn phím.</li>
            <li>• Trong giờ thi mọi thao tác rời cửa sổ đều được ghi nhận.</li>
          </ul>

          <Button variant="primary" size="lg" className="w-full" disabled={!ready} loading={starting} onClick={() => void start()}>
            Bắt đầu làm bài
          </Button>
          {!ready && !checking && <p className="text-center text-[11px] text-danger">Hãy khắc phục các mục màu đỏ để tiếp tục.</p>}
        </aside>
      </div>
      <DevPanel />
    </div>
  );
}

function initial(): Record<Check["id"], Check> {
  const mk = (id: Check["id"], label: string, required: boolean): Check => ({ id, label, level: "idle", detail: "Chưa kiểm tra", required });
  return {
    network: mk("network", "Kết nối máy chủ", true),
    exam: mk("exam", "Kỳ thi", true),
    display: mk("display", "Màn hình", true),
    apps: mk("apps", "Ứng dụng bị cấm", true),
    camera: mk("camera", "Camera", false),
    face: mk("face", "Nhận diện khuôn mặt", false),
    enroll: mk("enroll", "Khuôn mặt đã đăng ký", false),
    phone: mk("phone", "Camera mở rộng (điện thoại)", false),
    mic: mk("mic", "Micro", false),
    screen: mk("screen", "Chia sẻ màn hình", false),
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
          {c.label} {c.required && <Badge tone="neutral">bắt buộc</Badge>}
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
