import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

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
  const unlisten = getCurrentWindow().listen(SHOWN_EVENT, fn);
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
  await target.emit(SHOWN_EVENT);

  if (current.label !== toLabel) {
    await current.hide();
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
