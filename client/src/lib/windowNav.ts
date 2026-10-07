import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo } from "@tauri-apps/api/event";

/**
 * Nhãn (label) các cửa sổ khai báo sẵn trong `tauri.conf.json`. Thứ tự khởi động:
 *   update (hiện đầu tiên) -> auth (tải sẵn, ẩn) -> main (dashboard)
 * `exam-classic` / `exam-code` là cửa sổ thi riêng, duy nhất bật protect content.
 * Mọi cửa sổ được tạo sẵn lúc khởi động nên điều hướng chỉ là ẩn/hiện + focus.
 */
export const AppWindow = {
  Update: "update",
  Auth: "auth",
  Main: "main",
  ExamClassic: "exam-classic",
  ExamCode: "exam-code",
} as const;

/** Bắn tới cửa sổ đích mỗi khi `switchWindow` hiện nó — dùng thay cho sự kiện
 * focus (focus còn bắn khi kéo/di chuyển cửa sổ nên không dùng để tải lại dữ liệu). */
export const SHOWN_EVENT = "foxy://shown";

/** Đăng ký chạy `fn` mỗi khi cửa sổ hiện tại được hiện bởi `switchWindow`. */
export function onWindowShown(fn: () => void): () => void {
  const self = getCurrentWindow().label;
  // the payload names the window that was shown: a broadcast must never wake the other windows
  const unlisten = getCurrentWindow().listen<string>(SHOWN_EVENT, (e) => e.payload === self && fn());
  return () => void unlisten.then((off) => off());
}

export type AppWindowLabel = (typeof AppWindow)[keyof typeof AppWindow];

/**
 * Chuyển từ cửa sổ hiện tại sang một cửa sổ khác: hiện + focus cửa sổ đích,
 * rồi ẩn cửa sổ hiện tại (không đóng hẳn, để giữ nguyên trạng thái bên trong).
 */
export async function switchWindow(toLabel: AppWindowLabel): Promise<void> {
  const current = getCurrentWindow();
  const target = await WebviewWindow.getByLabel(toLabel);

  if (!target) {
    console.error(`[windowNav] Không tìm thấy cửa sổ "${toLabel}"`);
    return;
  }

  await target.show();
  await target.setFocus();
  await emitTo(toLabel, SHOWN_EVENT, toLabel);

  // Only one app window is visible at a time: hide every other one, not just the current, so a window that
  // was opened as a popup (update) or left behind can never float over the exam window.
  const others = Object.values(AppWindow).filter((label) => label !== toLabel);
  await Promise.all(
    others.map(async (label) => {
      const w = label === current.label ? current : await WebviewWindow.getByLabel(label);
      await w?.setAlwaysOnTop(false).catch(() => {});
      await w?.hide().catch(() => {});
    }),
  );

  // Windows sometimes leaves a window behind another app's: a short always-on-top pulse raises it for real.
  if (toLabel === AppWindow.ExamClassic || toLabel === AppWindow.ExamCode) {
    await target.setAlwaysOnTop(true).catch(() => {});
    if (!import.meta.env.PROD) await target.setAlwaysOnTop(false).catch(() => {});
  }
}

/**
 * Mở một cửa sổ phụ (popup) đè lên trên mà KHÔNG ẩn cửa sổ hiện tại — dùng
 * cho các cửa sổ độc lập với luồng chính/đăng nhập, ví dụ cửa sổ cập nhật.
 */
export async function openPopup(label: AppWindowLabel): Promise<void> {
  const target = await WebviewWindow.getByLabel(label);
  if (!target) {
    console.error(`[windowNav] Không tìm thấy cửa sổ "${label}"`);
    return;
  }
  await target.show();
  await target.setFocus();
}
