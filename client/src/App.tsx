import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Auth from "./windows/Auth";
import Update from "./windows/Update";
import Main from "./windows/Main";
import ExamClassic from "./windows/ExamClassic";
import ExamCode from "./windows/ExamCode";
import { AppWindow } from "./lib/windowNav";
import DialogHost from "./components/Dialogs";
import { dialog, errorText } from "./lib/dialog";
import { diag } from "./lib/diag";

/**
 * Mỗi cửa sổ Tauri load chung một bundle React duy nhất, nên ở đây ta chỉ cần
 * đọc `label` của cửa sổ hiện tại (đặt trong `tauri.conf.json`) để quyết định
 * hiển thị màn hình nào — không cần router.
 */
function App() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(getCurrentWindow().label);
    diag("page loaded");
    const onHide = () => diag(`visibility ${document.visibilityState}`);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => diag("pagehide"));
    window.addEventListener("beforeunload", () => diag("beforeunload"));
    // an error nobody caught must still reach the student instead of the window silently doing nothing
    const show = (title: string, err: unknown) => {
      console.error(`[app] ${title}`, err);
      void dialog.alert({ title, text: errorText(err), tone: "danger" });
    };
    const onError = (e: ErrorEvent) => show("Có lỗi không mong muốn", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => show("Thao tác thất bại", e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const screen = (() => {
    switch (label) {
      case AppWindow.Auth:
        return <Auth />;
      case AppWindow.Update:
        return <Update />;
      case AppWindow.Main:
        return <Main />;
      case AppWindow.ExamClassic:
        return <ExamClassic />;
      case AppWindow.ExamCode:
        return <ExamCode />;
      default:
        // Đang xác định label, hoặc chạy trong trình duyệt thường (pnpm dev ngoài Tauri).
        return null;
    }
  })();

  return (
    <>
      {screen}
      <DialogHost />
    </>
  );
}

export default App;
