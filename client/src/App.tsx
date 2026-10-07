import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Auth from "./windows/Auth";
import Update from "./windows/Update";
import Main from "./windows/Main";
import ExamClassic from "./windows/ExamClassic";
import ExamCode from "./windows/ExamCode";
import { AppWindow } from "./lib/windowNav";

/**
 * Mỗi cửa sổ Tauri load chung một bundle React duy nhất, nên ở đây ta chỉ cần
 * đọc `label` của cửa sổ hiện tại (đặt trong `tauri.conf.json`) để quyết định
 * hiển thị màn hình nào — không cần router.
 */
function App() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

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
}

export default App;
