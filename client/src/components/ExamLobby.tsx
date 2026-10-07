import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Check, Cpu, Loader2, Mic, Monitor, MonitorUp, RefreshCw, ShieldAlert, Wifi, X } from "lucide-react";
import { Badge, Button, cx } from "./ui";
import { DevPanel } from "./DevPanel";
import { ApiError, getExam, getHealth, startExam, type ExamDetail } from "../lib/api";
import { bypass, IS_DEV } from "../lib/dev";
import { clearPendingExam, getLobbyMedia, releaseLobbyMedia, setLobbyMedia, type PendingExam } from "../lib/lobbyMedia";
import { explain, FAILURE_TEXT, micMeter, openCamera, openMic, openScreen, stopStream } from "../lib/media";
import { captureDevices, DEFAULT_BANNED_APPS, getProcesses, getSnapshot, screenCount, type SystemSnapshot } from "../lib/monitor";
import { getAuth } from "../lib/authStore";
import { formatDateTime } from "../lib/datetime";
import { saveSession } from "../lib/session";
import { dialog, errorText } from "../lib/dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Level = "idle" | "checking" | "ok" | "warn" | "fail";

interface Check {
  id: "network" | "exam" | "display" | "apps" | "camera" | "mic" | "screen";
  label: string;
  level: Level;
  detail: string;
  /** A failing required check blocks the start button. */
  required: boolean;
}

const ORDER: Check["id"][] = ["network", "exam", "display", "apps", "camera", "mic", "screen"];

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

  const set = useCallback((id: Check["id"], patch: Partial<Check>) => setChecks((c) => ({ ...c, [id]: { ...c[id], ...patch } })), []);

  const cfg = detail?.monitoring_config ?? null;
  const needCamera = Boolean(cfg?.ai_face_check) && !bypass("camera");
  const needMic = Boolean(cfg?.require_mic);
  const needScreen = Boolean(cfg?.require_screen) && !bypass("screen");

  const attachPreview = useCallback((s: MediaStream | null) => {
    if (video.current) video.current.srcObject = s;
  }, []);

  const runCamera = useCallback(
    async (required: boolean) => {
      if (bypass("camera")) return set("camera", { level: "warn", detail: "Dev: bỏ qua camera", required: false });
      set("camera", { level: "checking", detail: "Đang mở camera…", required });
      try {
        stopStream(getLobbyMedia().camera);
        const s = await openCamera();
        setLobbyMedia({ camera: s });
        attachPreview(s);
        set("camera", { level: "ok", detail: s.getVideoTracks()[0]?.label || "Camera hoạt động", required });
      } catch (e) {
        set("camera", { level: required ? "fail" : "warn", detail: FAILURE_TEXT[explain(e)], required });
      }
    },
    [attachPreview, set],
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
    set("mic", { level: "idle", detail: "Nhấn “Kiểm tra micro” để thử", required: Boolean(d?.monitoring_config?.require_mic) });
    if (bypass("screen")) set("screen", { level: "warn", detail: "Dev: bỏ qua chia sẻ màn hình", required: false });
    else if (d?.monitoring_config?.require_screen) set("screen", { level: "idle", detail: "Bắt buộc chia sẻ TOÀN MÀN HÌNH — nhấn “Chia sẻ màn hình”", required: true });
    else set("screen", { level: "idle", detail: "Nhấn “Chia sẻ màn hình” để giám thị theo dõi bài làm (khuyến nghị)", required: false });
  }, [pending.id, runCamera, runMic, set]);

  useEffect(() => {
    void runAll();
    // the lobby holds the camera: let go of it whenever the window is hidden or the lobby ends without an exam
    const onHide = () => document.visibilityState === "hidden" && !startedRef.current && releaseLobbyMedia();
    document.addEventListener("visibilitychange", onHide);
    const closing = getCurrentWindow().listen("exam://close-requested", async () => {
      const leave = await dialog.confirm({ title: "Rời phòng chờ?", text: "Bạn chưa bắt đầu làm bài. Camera và chia sẻ màn hình sẽ được tắt.", confirmLabel: "Rời đi", tone: "warning" });
      if (leave) cancelRef.current();
    });
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void closing.then((off) => off());
      stopMeter.current?.();
      stopStream(micStream.current); // the lobby mic is only a test; the exam does not record audio
      if (!startedRef.current) releaseLobbyMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => attachPreview(getLobbyMedia().camera), [checks.camera.level, attachPreview]);

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
            <Row c={{ ...checks.camera, required: needCamera }} icon={<Camera size={14} />} action={checks.camera.level !== "ok" && checks.camera.level !== "checking" ? <Button size="sm" onClick={() => void runCamera(needCamera)}>{checks.camera.level === "idle" ? "Bật camera" : "Thử lại"}</Button> : undefined} />
            <Row c={{ ...checks.mic, required: needMic }} icon={<Mic size={14} />} action={checks.mic.level !== "ok" && checks.mic.level !== "checking" ? <Button size="sm" onClick={() => void runMic(needMic)}>{checks.mic.level === "idle" ? "Kiểm tra micro" : "Thử lại"}</Button> : undefined} />
            <Row
              c={{ ...checks.screen, required: needScreen }}
              icon={<MonitorUp size={14} />}
              action={
                !bypass("screen") && (
                  <Button size="sm" loading={screenBusy} onClick={() => void shareScreen()}>
                    Chia sẻ màn hình
                  </Button>
                )
              }
            />
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
          <div className="overflow-hidden rounded-xl border border-line bg-black">
            <video ref={video} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted">
              <Mic size={12} /> Mức âm thanh
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-success transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
          <ul className="space-y-1 rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-muted">
            <li>• Ngồi nơi đủ sáng, thấy rõ mặt.</li>
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
