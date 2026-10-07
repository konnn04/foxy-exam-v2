//! macOS / Linux: chưa có triển khai native — trả rỗng để app vẫn chạy được.
//! Riêng quyền quay màn hình trên macOS có kiểm tra thật.

use tauri::AppHandle;

use super::{AudioInput, Device, DisplayInfo, KeyEvent, ProcessInfo, ScreenCaptureStatus};

pub fn displays() -> Vec<DisplayInfo> {
    Vec::new()
}
pub fn devices() -> Vec<Device> {
    Vec::new()
}
pub fn microphones() -> Vec<AudioInput> {
    Vec::new()
}
pub fn processes() -> Vec<ProcessInfo> {
    Vec::new()
}
pub fn start_device_watch(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
pub fn stop_device_watch() {}
pub fn start_hooks(_app: AppHandle, _fg: bool, _kb: bool, _block: bool) -> Result<(), String> {
    Ok(())
}
pub fn stop_hooks() {}
pub fn keylog_drain() -> Vec<KeyEvent> {
    Vec::new()
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

pub fn screen_capture_status() -> ScreenCaptureStatus {
    #[cfg(target_os = "macos")]
    {
        if unsafe { CGPreflightScreenCaptureAccess() } {
            return ScreenCaptureStatus::Granted;
        }
        return ScreenCaptureStatus::Denied;
    }
    #[allow(unreachable_code)]
    ScreenCaptureStatus::Unknown
}

pub fn request_screen_capture() -> ScreenCaptureStatus {
    #[cfg(target_os = "macos")]
    {
        unsafe { CGRequestScreenCaptureAccess() };
    }
    screen_capture_status()
}
