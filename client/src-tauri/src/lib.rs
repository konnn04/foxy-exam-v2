use std::sync::Mutex;

mod monitor;
mod runner;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};

/// Trạng thái đăng nhập hiện tại — dùng để quyết định tray icon nên mở lại
/// cửa sổ "auth" hay "main" khi người dùng click/double-click vào nó.
///
/// Tạm thời chỉ là 1 cờ bool trong bộ nhớ (mất khi tắt app). Sau này khi nối
/// API thật (`/api/v1/student/login`), đổi chỗ này thành lưu token/session
/// thật, gọi `set_authenticated` ngay khi login/logout thành công.
#[derive(Default)]
struct AuthState(Mutex<bool>);

#[tauri::command]
fn set_authenticated(state: State<AuthState>, value: bool) {
    *state.0.lock().unwrap() = value;
}

/// Đưa đúng cửa sổ lên trước theo trạng thái đăng nhập: chưa đăng nhập ->
/// "auth", đã đăng nhập -> "main". Dùng khi click/double-click tray icon.
fn restore_app_window(app: &AppHandle) {
    let authenticated = *app.state::<AuthState>().0.lock().unwrap();
    let label = if authenticated { "main" } else { "auth" };
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

// Các cửa sổ (update, auth, main, exam-classic, exam-code) được
// khai báo sẵn trong tauri.conf.json. Điều hướng qua lại giữa chúng hiện được
// xử lý hoàn toàn ở phía frontend (xem `src/lib/windowNav.ts`) bằng
// show/hide/setFocus.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AuthState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            set_authenticated,
            monitor::monitor_snapshot,
            monitor::monitor_displays,
            monitor::monitor_devices,
            monitor::monitor_microphones,
            monitor::monitor_processes,
            monitor::monitor_screen_capture_status,
            monitor::monitor_request_screen_capture,
            monitor::monitor_start,
            monitor::monitor_stop,
            monitor::monitor_keylog_drain,
            runner::runner_toolchains,
            runner::runner_run,
        ])
        .setup(|app| {
            // Menu chuột phải trên icon khay hệ thống (system tray).
            let check_update =
                MenuItem::with_id(app, "check-update", "Kiểm tra cập nhật", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&check_update, &quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("FoxyExam Client")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "check-update" => {
                        // Mở cửa sổ "update" (KHÔNG phải "main") rồi báo cho frontend
                        // tự chạy luồng kiểm tra cập nhật (xem `src/lib/updater.ts`).
                        // Cửa sổ update độc lập với đăng nhập — không có gì để lộ dữ
                        // liệu tài khoản/phòng thi, nên mở lúc nào cũng an toàn, kể cả
                        // khi người dùng chưa đăng nhập.
                        if let Some(update) = app.get_webview_window("update") {
                            let _ = update.show();
                            let _ = update.set_focus();
                            let _ = update.emit("tray://check-update", ());
                        }
                    }
                    "quit" => {
                        monitor::shutdown();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Click trái (đơn hoặc đúp) -> mở lại đúng cửa sổ theo trạng thái
                    // đăng nhập (xem `restore_app_window`). KHÔNG còn đoán qua "cửa sổ
                    // nào đang visible" nữa — cách đó dễ dính cửa sổ "loading" do race
                    // condition (ẩn/hiện cửa sổ là async, click nhanh vào lúc loading
                    // chưa kịp ẩn xong).
                    let is_left_restore = matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } | TrayIconEvent::DoubleClick {
                            button: MouseButton::Left,
                            ..
                        }
                    );
                    if is_left_restore {
                        restore_app_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Bấm nút đóng (X) trên bất kỳ cửa sổ nào chỉ ẩn cửa sổ đó — app vẫn
            // chạy ngầm ở khay hệ thống. Thoát hẳn chỉ qua menu tray "Thoát".
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if window.label().starts_with("exam-") {
                    // Alt+F4 / the X of an exam window must never just vanish (the camera and the monitoring
                    // would keep running unseen): ask the page to show its confirmation instead.
                    let _ = window.emit_to(window.label(), "exam://close-requested", ());
                } else {
                    window.hide().ok();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
