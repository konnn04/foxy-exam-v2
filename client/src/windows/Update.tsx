import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { CheckCircle2, Download, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import TitleBar from "../components/TitleBar";
import { BrandMark, Button } from "../components/ui";
import { checkForUpdateAndInstall, type UpdateStatus } from "../lib/updater";
import { AppWindow, switchWindow } from "../lib/windowNav";
import { purgeNonRemembered } from "../lib/authStore";

/**
 * Cửa sổ cập nhật — cửa sổ ĐẦU TIÊN của app, mount 1 lần lúc khởi động.
 * Tách riêng khỏi Main để menu tray mở được bất kể đã đăng nhập hay chưa
 * (cửa sổ này không hiển thị dữ liệu tài khoản/phòng thi nào).
 */
export default function Update() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const [version, setVersion] = useState("");
  const [booting, setBooting] = useState(true);

  function runCheck() {
    void checkForUpdateAndInstall(setStatus);
  }

  useEffect(() => {
    void getVersion().then(setVersion);

    // Khởi động: bỏ phiên "đăng nhập 1 lần" của lần chạy trước, kiểm tra cập
    // nhật, rồi chuyển sang cửa sổ auth (đã tải sẵn) -> dashboard. Có bản mới thì
    // tải + cài + khởi động lại; lỗi mạng không chặn người dùng vào app.
    purgeNonRemembered();
    void checkForUpdateAndInstall(setStatus).then((outcome) => {
      if (outcome === "installed") return;
      const delay = outcome === "error" ? 1800 : 700;
      setTimeout(() => {
        setBooting(false);
        void getCurrentWindow().setAlwaysOnTop(false); // it stays on top only while it is the start-up splash
        void switchWindow(AppWindow.Auth);
      }, delay);
    });

    // Tray bấm "Kiểm tra cập nhật" khi cửa sổ đã mở sẵn -> kiểm tra lại.
    const unlisten = listen("tray://check-update", () => runCheck());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const busy = status.state === "checking" || status.state === "downloading" || status.state === "installing";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <TitleBar title="Foxy Exam — Cập nhật" maximizable={false} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
        <BrandMark subtitle={version ? `Phiên bản ${version}` : undefined} />
        <StatusView status={status} />
      </div>

      {!booting && (
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-4 py-3">
          <Button onClick={() => void getCurrentWindow().hide()}>Đóng</Button>
          <Button variant="primary" icon={<RefreshCw size={13} />} disabled={busy} onClick={runCheck}>
            Kiểm tra lại
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusView({ status }: { status: UpdateStatus }) {
  const row = (icon: React.ReactNode, text: string, tone = "text-muted") => (
    <div className={`flex items-center gap-2 text-xs ${tone}`}>
      {icon}
      {text}
    </div>
  );

  switch (status.state) {
    case "idle":
    case "checking":
      return row(<Loader2 size={14} className="animate-spin" />, "Đang kiểm tra cập nhật…");
    case "up-to-date":
      return row(<CheckCircle2 size={14} />, "Bạn đang dùng bản mới nhất.", "text-success");
    case "available":
      return row(<Download size={14} />, `Có bản mới ${status.version} — đang tải…`, "text-accent-fg");
    case "downloading":
      return (
        <div className="w-full max-w-[240px]">
          {row(<Download size={14} />, `Đang tải… ${status.percent}%`, "text-accent-fg")}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${status.percent}%` }} />
          </div>
        </div>
      );
    case "installing":
      return row(<Loader2 size={14} className="animate-spin" />, "Đang cài đặt, ứng dụng sẽ khởi động lại…", "text-accent-fg");
    case "error":
      return (
        <div className="max-w-[280px] space-y-1">
          {row(<TriangleAlert size={14} />, "Không kiểm tra được cập nhật.", "justify-center text-warning")}
          <p className="line-clamp-2 text-[11px] text-subtle">{status.message}</p>
        </div>
      );
  }
}
