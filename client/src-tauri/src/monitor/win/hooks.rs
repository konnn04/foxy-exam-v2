//! Một thread riêng có message loop, giữ 2 hook:
//! - `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)`: app nào vừa được đưa lên trước.
//! - `WH_KEYBOARD_LL`: phím tắt hệ thống (có thể chặn) + phát hiện phím giả lập.
//!
//! Callback hook phải trả về thật nhanh (Windows tự gỡ hook nếu quá
//! `LowLevelHooksTimeout`), nên ở đây chỉ ghi vào bộ đệm + emit, không làm gì nặng.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{mpsc, Mutex, OnceLock};
use std::thread::JoinHandle;

use tauri::{AppHandle, Emitter};
use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::{
    GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL, VK_ESCAPE, VK_F4, VK_LWIN, VK_RWIN, VK_SHIFT, VK_SNAPSHOT, VK_TAB,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW, GetWindowTextW,
    GetWindowThreadProcessId, PostThreadMessageW, SetWindowsHookExW, TranslateMessage,
    UnhookWindowsHookEx, EVENT_SYSTEM_FOREGROUND, HC_ACTION, KBDLLHOOKSTRUCT, LLKHF_ALTDOWN,
    LLKHF_INJECTED, MSG, WH_KEYBOARD_LL, WINEVENT_OUTOFCONTEXT, WM_KEYDOWN, WM_QUIT, WM_SYSKEYDOWN,
};

use super::wide_to_string;
use crate::monitor::{now_ms, ForegroundChanged, KeyEvent, ShortcutEvent, SyntheticInput};

const KEYLOG_CAP: usize = 4000;

static APP: OnceLock<AppHandle> = OnceLock::new();
static BLOCK_SHORTCUTS: AtomicBool = AtomicBool::new(false);
static KEYLOG: Mutex<VecDeque<KeyEvent>> = Mutex::new(VecDeque::new());
static INJECTED_COUNT: AtomicU32 = AtomicU32::new(0);
static INJECTED_WINDOW: AtomicU64 = AtomicU64::new(0);
static THREAD: Mutex<Option<(u32, JoinHandle<()>)>> = Mutex::new(None);

pub fn start_hooks(app: AppHandle, foreground: bool, keyboard: bool, block: bool) -> Result<(), String> {
    stop_hooks();
    let _ = APP.set(app);
    BLOCK_SHORTCUTS.store(block, Ordering::Relaxed);

    let (ready_tx, ready_rx) = mpsc::channel::<Result<u32, String>>();
    let handle = std::thread::Builder::new()
        .name("foxy-hooks".into())
        .spawn(move || unsafe {
            let tid = GetCurrentThreadId();

            let fg_hook = if foreground {
                let h = SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    None,
                    Some(on_foreground),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT,
                );
                if h.is_invalid() {
                    let _ = ready_tx.send(Err("SetWinEventHook thất bại".into()));
                    return;
                }
                Some(h)
            } else {
                None
            };

            let kb_hook = if keyboard {
                let module = GetModuleHandleW(None).ok().map(|m| HINSTANCE(m.0));
                match SetWindowsHookExW(WH_KEYBOARD_LL, Some(on_key), module, 0) {
                    Ok(h) => Some(h),
                    Err(e) => {
                        if let Some(h) = fg_hook {
                            let _ = UnhookWinEvent(h);
                        }
                        let _ = ready_tx.send(Err(format!("SetWindowsHookExW thất bại: {e}")));
                        return;
                    }
                }
            } else {
                None
            };

            let _ = ready_tx.send(Ok(tid));

            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).0 > 0 {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            if let Some(h) = kb_hook {
                let _ = UnhookWindowsHookEx(h);
            }
            if let Some(h) = fg_hook {
                let _ = UnhookWinEvent(h);
            }
        })
        .map_err(|e| e.to_string())?;

    match ready_rx.recv() {
        Ok(Ok(tid)) => {
            *THREAD.lock().unwrap() = Some((tid, handle));
            Ok(())
        }
        Ok(Err(e)) => {
            let _ = handle.join();
            Err(e)
        }
        Err(_) => Err("Thread hook dừng bất thường".into()),
    }
}

pub fn stop_hooks() {
    let thread = THREAD.lock().unwrap().take();
    if let Some((tid, handle)) = thread {
        unsafe {
            let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
        }
        let _ = handle.join();
    }
    BLOCK_SHORTCUTS.store(false, Ordering::Relaxed);
}

pub fn keylog_drain() -> Vec<KeyEvent> {
    KEYLOG.lock().unwrap().drain(..).collect()
}

// ---------------------------------------------------------------------------

unsafe extern "system" fn on_foreground(
    _hook: HWINEVENTHOOK,
    _event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
) {
    let Some(app) = APP.get() else { return };
    if hwnd.is_invalid() {
        return;
    }
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    let mut title = [0u16; 256];
    let len = GetWindowTextW(hwnd, &mut title).max(0) as usize;

    let _ = app.emit(
        "monitor://foreground",
        ForegroundChanged {
            pid,
            name: process_name(pid),
            title: String::from_utf16_lossy(&title[..len]),
            is_self: pid == std::process::id(),
        },
    );
}

unsafe extern "system" fn on_key(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code != HC_ACTION as i32 {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
    let msg = wparam.0 as u32;
    let down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
    let injected = kb.flags.0 & LLKHF_INJECTED.0 != 0;
    let alt = kb.flags.0 & LLKHF_ALTDOWN.0 != 0;
    let vk = kb.vkCode;
    let t = now_ms();

    let foreign = {
        let mut pid = 0u32;
        GetWindowThreadProcessId(GetForegroundWindow(), Some(&mut pid));
        pid != std::process::id()
    };

    if let Ok(mut log) = KEYLOG.lock() {
        if log.len() >= KEYLOG_CAP {
            log.pop_front();
        }
        log.push_back(KeyEvent { vk, down, t, injected, foreign });
    }

    if injected && down {
        report_injected(t);
    }

    let block = BLOCK_SHORTCUTS.load(Ordering::Relaxed);
    let is_win = vk == VK_LWIN.0 as u32 || vk == VK_RWIN.0 as u32;
    let is_print = vk == VK_SNAPSHOT.0 as u32;

    // PrintScreen thường chỉ tới ở key-up nên xét riêng; các tổ hợp khác xét ở key-down.
    let combo = if is_print {
        (!down).then_some("PrintScreen")
    } else if down {
        detect_combo(vk, alt, is_win)
    } else {
        None
    };

    if let Some(combo) = combo {
        if let Some(app) = APP.get() {
            let _ = app.emit("monitor://shortcut", ShortcutEvent { combo, blocked: block, t });
        }
    }

    // Chặn: nuốt cả key-down lẫn key-up của Win/PrintScreen để HĐH không kích hoạt gì.
    if block && (combo.is_some() || is_win || is_print) {
        return LRESULT(1);
    }
    CallNextHookEx(None, code, wparam, lparam)
}

unsafe fn detect_combo(vk: u32, alt: bool, is_win: bool) -> Option<&'static str> {
    let pressed = |k: i32| GetAsyncKeyState(k) < 0;
    let ctrl = pressed(VK_CONTROL.0 as i32);
    let shift = pressed(VK_SHIFT.0 as i32);

    if is_win {
        Some("Win")
    } else if alt && vk == VK_TAB.0 as u32 {
        Some("Alt+Tab")
    } else if alt && vk == VK_ESCAPE.0 as u32 {
        Some("Alt+Esc")
    } else if alt && vk == VK_F4.0 as u32 {
        Some("Alt+F4")
    } else if ctrl && shift && vk == VK_ESCAPE.0 as u32 {
        Some("Ctrl+Shift+Esc")
    } else if ctrl && vk == VK_ESCAPE.0 as u32 {
        Some("Ctrl+Esc")
    } else {
        None
    }
}

/// Phím giả lập: báo ngay phím đầu tiên, sau đó tối đa 1 lần/giây kèm số phím
/// tích luỹ từ lần báo trước.
fn report_injected(t: u64) {
    let count = INJECTED_COUNT.fetch_add(1, Ordering::Relaxed) + 1;
    if t.saturating_sub(INJECTED_WINDOW.load(Ordering::Relaxed)) >= 1000 {
        INJECTED_WINDOW.store(t, Ordering::Relaxed);
        INJECTED_COUNT.store(0, Ordering::Relaxed);
        if let Some(app) = APP.get() {
            let _ = app.emit("monitor://synthetic-input", SyntheticInput { count, t });
        }
    }
}

fn process_name(pid: u32) -> String {
    unsafe {
        let Ok(h) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return String::new();
        };
        let mut buf = [0u16; 512];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut size).is_ok();
        let _ = CloseHandle(h);
        if !ok {
            return String::new();
        }
        let path = wide_to_string(&buf[..size as usize]);
        path.rsplit(['\\', '/']).next().unwrap_or_default().to_string()
    }
}
