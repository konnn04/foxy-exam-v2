import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date" }
  | { state: "available"; version: string }
  | { state: "downloading"; percent: number }
  | { state: "installing" }
  | { state: "error"; message: string };

/**
 * Kiểm tra bản cập nhật mới; nếu có thì tải + cài đặt rồi khởi động lại app.
 * `onStatus` được gọi liên tục để UI hiển thị tiến trình.
 *
 * `silent`: dùng cho lần tự kiểm tra khi mở app — không báo "đang kiểm
 * tra…" / "đã mới nhất" để khỏi làm phiền, chỉ lên tiếng khi thật sự có
 * bản mới hoặc có lỗi. Bấm nút/tray thủ công thì để `silent: false` (mặc
 * định) để người dùng luôn thấy phản hồi.
 *
 * Endpoint & public key lấy từ `src-tauri/tauri.conf.json` (mục
 * `plugins.updater`) — trỏ tới `latest.json` do GitHub Actions release sinh ra
 * (xem `.github/workflows/release-client.yml`).
 */
export type UpdateOutcome = "up-to-date" | "error" | "installed";

export async function checkForUpdateAndInstall(
  onStatus: (status: UpdateStatus) => void,
  { silent = false }: { silent?: boolean } = {},
): Promise<UpdateOutcome> {
  if (!silent) onStatus({ state: "checking" });

  let update: Update | null;
  try {
    update = await check();
  } catch (err) {
    if (!silent) onStatus({ state: "error", message: String(err) });
    else console.error("[updater] Kiểm tra cập nhật (nền) thất bại:", err);
    return "error";
  }

  if (!update) {
    if (!silent) onStatus({ state: "up-to-date" });
    return "up-to-date";
  }

  onStatus({ state: "available", version: update.version });

  let totalBytes = 0;
  let downloadedBytes = 0;

  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          totalBytes = event.data.contentLength ?? 0;
          downloadedBytes = 0;
          break;
        case "Progress":
          downloadedBytes += event.data.chunkLength;
          onStatus({
            state: "downloading",
            percent:
              totalBytes > 0
                ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
                : 0,
          });
          break;
        case "Finished":
          onStatus({ state: "installing" });
          break;
      }
    });
  } catch (err) {
    onStatus({ state: "error", message: String(err) });
    return "error";
  }

  // Windows: downloadAndInstall() tự thoát app sau khi mở trình cài đặt, nên
  // dòng dưới chỉ thật sự chạy tới trên macOS/Linux.
  await relaunch();
  return "installed";
}
