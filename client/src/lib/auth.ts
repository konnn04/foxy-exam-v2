import { invoke } from "@tauri-apps/api/core";

/**
 * Đồng bộ trạng thái đăng nhập sang phía Rust (`src-tauri/src/lib.rs`) — tray
 * icon dùng cờ này để quyết định click/double-click nên mở lại cửa sổ
 * "login" hay "main". Gọi ngay sau khi đăng nhập/đăng xuất thành công.
 *
 * TODO: khi nối API thật, gọi hàm này cùng lúc lưu token phiên đăng nhập.
 */
export async function setAuthenticated(value: boolean): Promise<void> {
  try {
    await invoke("set_authenticated", { value });
  } catch (err) {
    console.error("[auth] Không đồng bộ được trạng thái đăng nhập với tray:", err);
  }
}
