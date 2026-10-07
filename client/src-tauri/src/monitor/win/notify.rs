//! Nghe cắm/rút thiết bị bằng `CM_Register_Notification` (callback từ HĐH,
//! không cần cửa sổ ẩn hay polling). Mỗi đợt thay đổi được gom 400ms rồi quét
//! lại 1 lần, so với lần trước để phát `monitor://devices`.

use std::collections::HashSet;
use std::ffi::c_void;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use windows::Win32::Devices::DeviceAndDriverInstallation::{
    CM_Register_Notification, CM_Unregister_Notification, CM_NOTIFY_ACTION,
    CM_NOTIFY_ACTION_DEVICEINTERFACEARRIVAL, CM_NOTIFY_ACTION_DEVICEINTERFACEREMOVAL,
    CM_NOTIFY_EVENT_DATA, CM_NOTIFY_FILTER, CM_NOTIFY_FILTER_FLAG_ALL_INTERFACE_CLASSES,
    CM_NOTIFY_FILTER_TYPE_DEVICEINTERFACE, CR_SUCCESS, HCMNOTIFICATION,
};

use super::{devices, displays, microphones};
use crate::monitor::{Device, DevicesChanged};

const DEBOUNCE: Duration = Duration::from_millis(400);

static SENDER: Mutex<Option<Sender<()>>> = Mutex::new(None);
/// HCMNOTIFICATION (con trỏ) lưu dạng usize vì con trỏ thô không `Send`.
static REGISTRATION: Mutex<Option<usize>> = Mutex::new(None);
static WORKER: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

pub fn start_device_watch(app: AppHandle) -> Result<(), String> {
    stop_device_watch();

    let (tx, rx) = mpsc::channel::<()>();
    *SENDER.lock().unwrap() = Some(tx);

    let worker = std::thread::Builder::new()
        .name("foxy-device-watch".into())
        .spawn(move || {
            let mut prev: HashSet<Device> = devices().into_iter().collect();
            let mut prev_displays = displays();
            let mut prev_mics = microphones();

            while rx.recv().is_ok() {
                // Gom các thông báo dồn dập (1 thiết bị USB thường bắn hàng chục interface).
                loop {
                    match rx.recv_timeout(DEBOUNCE) {
                        Ok(()) => continue,
                        Err(RecvTimeoutError::Timeout) => break,
                        Err(RecvTimeoutError::Disconnected) => return,
                    }
                }

                let cur: HashSet<Device> = devices().into_iter().collect();
                let cur_displays = displays();
                let cur_mics = microphones();

                let added: Vec<Device> = cur.difference(&prev).cloned().collect();
                let removed: Vec<Device> = prev.difference(&cur).cloned().collect();

                if !added.is_empty()
                    || !removed.is_empty()
                    || cur_displays != prev_displays
                    || cur_mics != prev_mics
                {
                    let _ = app.emit(
                        "monitor://devices",
                        DevicesChanged {
                            added,
                            removed,
                            displays: cur_displays.clone(),
                            microphones: cur_mics.clone(),
                        },
                    );
                }
                prev = cur;
                prev_displays = cur_displays;
                prev_mics = cur_mics;
            }
        })
        .map_err(|e| e.to_string())?;
    *WORKER.lock().unwrap() = Some(worker);

    unsafe {
        let mut filter: CM_NOTIFY_FILTER = std::mem::zeroed();
        filter.cbSize = std::mem::size_of::<CM_NOTIFY_FILTER>() as u32;
        filter.Flags = CM_NOTIFY_FILTER_FLAG_ALL_INTERFACE_CLASSES;
        filter.FilterType = CM_NOTIFY_FILTER_TYPE_DEVICEINTERFACE;

        let mut handle = HCMNOTIFICATION::default();
        let cr = CM_Register_Notification(&filter, None, Some(on_change), &mut handle);
        if cr != CR_SUCCESS {
            stop_device_watch();
            return Err(format!("CM_Register_Notification thất bại (CONFIGRET {})", cr.0));
        }
        *REGISTRATION.lock().unwrap() = Some(handle.0 as usize);
    }
    Ok(())
}

pub fn stop_device_watch() {
    // Huỷ đăng ký TRƯỚC (hàm này chờ các callback đang chạy xong) rồi mới đóng
    // channel — không giữ lock SENDER trong lúc huỷ để tránh deadlock với callback.
    let registration = REGISTRATION.lock().unwrap().take();
    if let Some(h) = registration {
        unsafe {
            let _ = CM_Unregister_Notification(HCMNOTIFICATION(h as *mut c_void));
        }
    }
    SENDER.lock().unwrap().take();
    let worker = WORKER.lock().unwrap().take();
    if let Some(w) = worker {
        let _ = w.join();
    }
}

unsafe extern "system" fn on_change(
    _notify: HCMNOTIFICATION,
    _context: *const c_void,
    action: CM_NOTIFY_ACTION,
    _data: *const CM_NOTIFY_EVENT_DATA,
    _size: u32,
) -> u32 {
    if action == CM_NOTIFY_ACTION_DEVICEINTERFACEARRIVAL || action == CM_NOTIFY_ACTION_DEVICEINTERFACEREMOVAL {
        if let Some(tx) = SENDER.lock().unwrap().as_ref() {
            let _ = tx.send(());
        }
    }
    0 // ERROR_SUCCESS
}
