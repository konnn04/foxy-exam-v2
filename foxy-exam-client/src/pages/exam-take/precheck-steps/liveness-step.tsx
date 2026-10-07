import { useState, useRef, useEffect, useCallback } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { acquireFaceLandmarker, extractPitchYaw, releaseFaceLandmarker } from "@/lib/mediapipe-service";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, RefreshCw, ScanFace, Shield, Camera, Sparkles, ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { API_ENDPOINTS } from "@/config";

const FLASH_SEQUENCE = [
  { color: "#cc0000", label: "Đỏ", icon: "🔴", ms: 500 },
  { color: "#cc8800", label: "Vàng", icon: "🟡", ms: 500 },
  { color: "#00aa00", label: "Xanh", icon: "🟢", ms: 500 },
];

const HOLD_MS = 600;
const INFER_THROTTLE_MS = 200;

type Phase = "straight" | "left" | "right" | "straight_again" | "flash" | "verifying" | "done" | "failed";

const PHASE_INFO: Record<Phase, { title: string; desc: string; icon: any; step: number }> = {
  straight:      { title: "Nhìn thẳng vào camera",   desc: "Đặt khuôn mặt vào giữa khung hình",        icon: ScanFace,  step: 1 },
  left:           { title: "Quay mặt sang trái",      desc: "Từ từ quay trái, giữ yên khi chụp",         icon: Camera,    step: 2 },
  right:          { title: "Quay mặt sang phải",      desc: "Từ từ quay phải, giữ yên khi chụp",         icon: Camera,    step: 3 },
  straight_again: { title: "Nhìn thẳng — giữ yên",    desc: "Chuẩn bị kiểm tra phản xạ ánh sáng",        icon: Shield,    step: 4 },
  flash:          { title: "Đèn nháy — giữ yên!",     desc: "Màn hình nháy 3 màu để kiểm tra người thật", icon: Sparkles,  step: 5 },
  verifying:      { title: "Đang xác thực...",        desc: "AI đang phân tích khuôn mặt của bạn",       icon: ScanFace,  step: 6 },
  done:           { title: "Xác thực thành công!",    desc: "Khuôn mặt đã được xác minh",                icon: Check,     step: 6 },
  failed:         { title: "Xác thực thất bại",       desc: "Vui lòng thử lại",                          icon: RefreshCw, step: 0 },
};

interface LivenessStepProps {
  examId: string;
  attemptId: string;
  stream: MediaStream;
  onDone: () => void;
  onBack: () => void;
}

export function LivenessStep({ examId, attemptId, stream, onDone, onBack }: LivenessStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("straight");
  const [flashIdx, setFlashIdx] = useState(-1);
  const [flashColor, setFlashColor] = useState("transparent");
  const [progress, setProgress] = useState(0); // for arrow hints

  const phaseRef = useRef<Phase>("straight");
  const angleRef = useRef(0);
  const holdStartRef = useRef(0);
  const capturedRef = useRef<{ phase: string; jpeg: string }[]>([]);
  const lmRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef(0);
  const lastInferAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const verifyInFlightRef = useRef(false);

  const switchPhase = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => {
    let active = true;
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    (async () => {
      try {
        lmRef.current = await acquireFaceLandmarker({ blendshapes: true });
        if (!active) return;
        holdStartRef.current = performance.now();
        requestRef.current = requestAnimationFrame(processLoop);
      } catch { if (active) setPhase("failed"); }
    })();
    return () => {
      active = false;
      cancelAnimationFrame(requestRef.current);
      lmRef.current = null;
      releaseFaceLandmarker({ blendshapes: true });
    };
  }, [stream]);

  const captureFrame = async (label: string): Promise<void> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    capturedRef.current.push({ phase: label, jpeg: canvas.toDataURL("image/jpeg", 0.85) });
  };

  const processLoop = useCallback(() => {
    const video = videoRef.current;
    const lm = lmRef.current;
    if (!video || !lm) { requestRef.current = requestAnimationFrame(processLoop); return; }
    const curPhase = phaseRef.current;
    if (["verifying", "done", "failed", "flash"].includes(curPhase)) {
      requestRef.current = requestAnimationFrame(processLoop); return;
    }
    const now = performance.now();
    if (now - lastInferAtRef.current < INFER_THROTTLE_MS) {
      requestRef.current = requestAnimationFrame(processLoop); return;
    }
    if (video.videoWidth > 0 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      lastInferAtRef.current = now;
      const r = lm.detectForVideo(video, now);

      if (curPhase === "straight") {
        if (r.faceLandmarks?.length) { switchPhase("left"); angleRef.current = 1; holdStartRef.current = now; setProgress(17); }
      } else if (curPhase === "straight_again") {
        if (r.faceLandmarks?.length) {
          const held = now - holdStartRef.current;
          if (r.facialTransformationMatrixes?.length) {
            const { yaw } = extractPitchYaw(r.facialTransformationMatrixes[0].data);
            // Must be looking straight (|yaw| < 8) for HOLD_MS before flash
            if (Math.abs(yaw) < 8 && held > HOLD_MS) {
              switchPhase("flash"); setProgress(67);
            } else if (Math.abs(yaw) >= 8) {
              holdStartRef.current = now; // reset hold if not straight
            }
          }
        }
      } else if (curPhase === "left" || curPhase === "right") {
        if (r.facialTransformationMatrixes?.length) {
          const { yaw } = extractPitchYaw(r.facialTransformationMatrixes[0].data);
          const held = now - holdStartRef.current;
          const targetAngle = curPhase === "left" ? 1 : 2;
          const good = (targetAngle === 1 && yaw > 10) || (targetAngle === 2 && yaw < -10);
          if (good && held > HOLD_MS) {
            captureFrame(curPhase).then(() => {
              if (curPhase === "left") { switchPhase("right"); angleRef.current = 2; holdStartRef.current = now; setProgress(33); }
              else { switchPhase("straight_again"); angleRef.current = 0; holdStartRef.current = now; setProgress(50); }
            });
          } else if (!good) { holdStartRef.current = now; }
        }
      }
    }
    requestRef.current = requestAnimationFrame(processLoop);
  }, []);

  useEffect(() => {
    if (phase !== "flash") return;
    let active = true; let i = 0;
    const runFlash = async () => {
      if (!active) return;
      if (i >= FLASH_SEQUENCE.length) { setFlashColor("transparent"); setFlashIdx(-1); setPhase("verifying"); setProgress(100); await verifyAllCaptures(); return; }
      const f = FLASH_SEQUENCE[i]; setFlashIdx(i); setFlashColor(f.color); setProgress(67 + (i + 1) * 11);
      setTimeout(async () => { if (!active) return; await captureFrame(`flash_${f.label}`); }, 100);
      i++; setTimeout(runFlash, f.ms);
    };
    runFlash();
    return () => { active = false; };
  }, [phase]);

  const verifyAllCaptures = async () => {
    if (verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    try {
      const caps = capturedRef.current;
      const flashCaps = caps.filter(c => c.phase.startsWith("flash_"));
      if (flashCaps.length < 3) { toast.error("Chưa đủ ảnh xác thực."); switchPhase("failed"); return; }
      const leftImg = caps.find(c => c.phase === "left");
      const rightImg = caps.find(c => c.phase === "right");
      const frontal = flashCaps[Math.floor(Math.random() * flashCaps.length)];
      // Fallback: if angle captures failed, use flash captures
      const img1 = leftImg?.jpeg || flashCaps[0]?.jpeg || "";
      const img2 = rightImg?.jpeg || flashCaps[1]?.jpeg || "";
      const img3 = frontal?.jpeg || flashCaps[2]?.jpeg || "";

      const res = await api.post(API_ENDPOINTS.EXAM_VERIFY_IDENTITY(examId), {
        attempt_id: attemptId,
        images: [img1, img2, img3],
      });

      if (!res.data?.match) {
        const angleLabels = ["trái", "phải", "thẳng"];
        const angle = res.data?.failed_angle ?? "?";
        const sim = res.data?.similarity != null ? ` (độ khớp: ${Math.round(res.data.similarity * 100)}%)` : "";
        toast.error(`Ảnh ${angleLabels[angle] || angle} không khớp${sim}. Thử lại.`);
        switchPhase("failed");
        return;
      }

      switchPhase("done");
      setTimeout(() => onDone(), 800);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Xác thực thất bại");
      switchPhase("failed");
    } finally { verifyInFlightRef.current = false; }
  };

  const handleRetry = () => {
    capturedRef.current = []; verifyInFlightRef.current = false;
    switchPhase("straight"); angleRef.current = 0; holdStartRef.current = performance.now();
    setProgress(0); setFlashIdx(-1); setFlashColor("transparent");
  };

  const info = PHASE_INFO[phase];
  const Icon = info.icon;

  return (
    <div className="w-full space-y-4">
      {/* Full-screen flash overlay */}
      {phase === "flash" && flashColor !== "transparent" && (
        <div className="fixed inset-0 z-40 pointer-events-none" style={{ backgroundColor: flashColor, opacity: 1 }} />
      )}

      {/* Camera preview with face guide — consistent size across all steps */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black border-2 shadow-xl max-w-md mx-auto">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Face guide oval — proportional to face */}
        {["straight", "left", "right", "straight_again"].includes(phase) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[45%] h-[55%] rounded-full border-2 border-white/40 border-dashed" />
          </div>
        )}

        {/* Direction arrows — point the way user needs to turn */}
        {phase === "left" && (
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <ArrowLeftIcon className="h-10 w-10 text-white/70 animate-pulse" />
          </div>
        )}
        {phase === "right" && (
          <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
            <ArrowRightIcon className="h-10 w-10 text-white/70 animate-pulse" />
          </div>
        )}
        {phase === "straight" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-white/60 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
              Đặt mặt vào khung
            </span>
          </div>
        )}
        {phase === "straight_again" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-white/60 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
              Nhìn thẳng — giữ yên
            </span>
          </div>
        )}
        {phase === "straight_again" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-white/50 text-sm font-medium bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
              Nhìn thẳng — giữ yên
            </div>
          </div>
        )}

        {/* Corner badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary" className="bg-black/50 backdrop-blur-sm text-white border-white/20">
            <Camera className="h-3 w-3 mr-1" /> Live
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-md mx-auto space-y-1">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-right">{progress}%</p>
      </div>

      {/* Status card */}
      <Card className={`max-w-md mx-auto border-2 transition-all duration-300 ${
        phase === "done" ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" :
        phase === "failed" ? "border-destructive/50 bg-destructive/5" :
        phase === "flash" ? "border-primary/50 bg-primary/5" :
        "border-muted"
      }`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              phase === "done" ? "bg-emerald-100 dark:bg-emerald-900/30" :
              phase === "failed" ? "bg-destructive/10" :
              phase === "flash" ? "bg-primary/10" :
              "bg-muted"
            }`}>
              <Icon className={`h-5 w-5 ${
                phase === "done" ? "text-emerald-600" :
                phase === "failed" ? "text-destructive" :
                phase === "flash" ? "text-primary" :
                "text-muted-foreground"
              }`} />
            </div>
            <div>
              <CardTitle className="text-lg">{info.title}</CardTitle>
              <CardDescription className="text-sm">{info.desc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">Bước {info.step}/6</Badge>
            {phase === "flash" && flashIdx >= 0 && (
              <Badge className="text-[10px] text-white" style={{ backgroundColor: FLASH_SEQUENCE[flashIdx].color }}>
                {FLASH_SEQUENCE[flashIdx].icon} {FLASH_SEQUENCE[flashIdx].label}
              </Badge>
            )}
            {phase === "verifying" && (
              <Badge variant="secondary" className="text-[10px] animate-pulse">
                <Sparkles className="h-3 w-3 mr-1" /> AI đang xử lý
              </Badge>
            )}
            {phase === "done" && (
              <Badge className="text-[10px] bg-emerald-500 text-white">
                <Check className="h-3 w-3 mr-1" /> OK
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex justify-center gap-3">
        {phase === "failed" && (
          <>
            <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Quay lại</Button>
            <Button onClick={handleRetry}><RefreshCw className="h-4 w-4 mr-1" /> Thử lại</Button>
          </>
        )}
        {phase === "done" && (
          <Button onClick={onDone} className="min-w-[180px]" size="lg">
            <Check className="h-5 w-5 mr-2" /> Tiếp tục
          </Button>
        )}
      </div>
    </div>
  );
}
