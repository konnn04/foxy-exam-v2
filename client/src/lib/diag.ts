import { invoke } from "@tauri-apps/api/core";

/** Window-lifecycle breadcrumbs: printed in the browser console and in the `tauri dev` terminal. */
export function diag(msg: string) {
  console.info(`[diag] ${msg}`);
  void invoke("diag_log", { msg }).catch(() => {});
}
