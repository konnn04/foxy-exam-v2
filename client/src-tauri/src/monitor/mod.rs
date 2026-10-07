//! Giám sát máy thí sinh ở tầng hệ điều hành (phục vụ phòng thi).
//!
//! Thiết kế ưu tiên NHẸ + THEO SỰ KIỆN:
//! - Cắm/rút thiết bị (USB, bàn phím, chuột, camera, mic, màn hình): đăng ký
//!   `CM_Register_Notification` — HĐH tự gọi lại, không polling. Mỗi đợt thay
//!   đổi được gom (debounce) rồi mới quét lại 1 lần để tính added/removed.
//! - Đổi cửa sổ đang focus (app khác vừa được bật lên trước): `SetWinEventHook`.
//! - Phím tắt hệ thống / input giả lập (phần mềm gõ hộ): hook `WH_KEYBOARD_LL`,
//!   chỉ chạy khi đang trong phiên thi (`monitor_start`).
//! - Tiến trình: Windows không có sự kiện "app vừa mở" rẻ tiền (WMI rất nặng),
//!   nên chụp ToolHelp32 (~1–3ms) theo chu kỳ và so sánh để phát sự kiện.
//!
//! Sự kiện phát ra toàn app (mọi cửa sổ đều `listen` được):
//! - `monitor://devices`     — `DevicesChanged`
//! - `monitor://process`     — `ProcessChanged`
//! - `monitor://banned-app`  — `BannedApps` (mỗi khi tập app cấm đang chạy thay đổi)
//! - `monitor://foreground`  — `ForegroundChanged`
//! - `monitor://shortcut`    — `ShortcutEvent`
//! - `monitor://synthetic-input` — `SyntheticInput` (đã throttle 1s)

use serde::{Deserialize, Serialize};

#[cfg(windows)]
mod win;
#[cfg(windows)]
use win as platform;

#[cfg(not(windows))]
mod fallback;
#[cfg(not(windows))]
use fallback as platform;

mod process_watch;

// ---------------------------------------------------------------------------
// Kiểu dữ liệu trả về frontend
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum DeviceKind {
    Keyboard,
    Mouse,
    Camera,
    Usb,
    /// A monitor the OS reports as present, or a virtual display adapter (counts even when mirrored).
    Display,
    /// HDMI / USB capture cards and other video-in devices that can feed a second screen.
    Capture,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    /// Device instance ID, vd `USB\VID_046D&PID_C52B\5&2A...` — ổn định giữa các lần quét.
    pub id: String,
    pub name: String,
    /// Lớp thiết bị của Windows (Keyboard, Mouse, Camera, Image, HIDClass, ...).
    pub class: String,
    pub kind: DeviceKind,
    /// `VID:PID` (vd `046D:C52B`) khi có — 1 thiết bị vật lý thường hiện thành nhiều
    /// mục (mỗi interface HID 1 mục), gộp theo trường này để đếm thiết bị thật.
    pub hardware_id: Option<String>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub primary: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AudioInput {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub ppid: u32,
    pub name: String,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(windows, allow(dead_code))] // Granted/Denied/Unknown chỉ dùng ngoài Windows.
pub enum ScreenCaptureStatus {
    /// Windows: không có cơ chế cấp quyền quay màn hình — luôn quay được.
    NotRequired,
    Granted,
    Denied,
    Unknown,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub os: &'static str,
    pub displays: Vec<DisplayInfo>,
    pub devices: Vec<Device>,
    pub microphones: Vec<AudioInput>,
    pub screen_capture: ScreenCaptureStatus,
    pub process_count: usize,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DevicesChanged {
    pub added: Vec<Device>,
    pub removed: Vec<Device>,
    pub displays: Vec<DisplayInfo>,
    pub microphones: Vec<AudioInput>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProcessChanged {
    pub started: Vec<ProcessInfo>,
    pub exited: Vec<ProcessInfo>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BannedApps {
    pub running: Vec<ProcessInfo>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundChanged {
    pub pid: u32,
    pub name: String,
    pub title: String,
    /// true = cửa sổ của chính FoxyExam.
    pub is_self: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutEvent {
    pub combo: &'static str,
    pub blocked: bool,
    pub t: u64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SyntheticInput {
    /// Số phím giả lập (LLKHF_INJECTED) ghi nhận trong cửa sổ 1s vừa qua.
    pub count: u32,
    pub t: u64,
}

#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KeyEvent {
    pub vk: u32,
    pub down: bool,
    /// Unix ms.
    pub t: u64,
    /// Phím do phần mềm bơm vào (SendInput...), không phải bàn phím thật.
    pub injected: bool,
    /// Lúc gõ, cửa sổ đang focus KHÔNG phải FoxyExam.
    pub foreign: bool,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct MonitorConfig {
    pub watch_devices: bool,
    pub watch_processes: bool,
    pub process_interval_ms: u64,
    /// Tên tiến trình cấm. Không phân biệt hoa thường, bỏ đuôi `.exe`.
    /// `abc` = khớp đúng tên; `abc*` = khớp tiền tố.
    pub banned_apps: Vec<String>,
    pub watch_foreground: bool,
    pub keyboard_hook: bool,
    /// Nuốt luôn các phím tắt hệ thống (Win, Alt+Tab, Alt+Esc, Ctrl+Esc, PrintScreen...).
    pub block_shortcuts: bool,
}

impl Default for MonitorConfig {
    fn default() -> Self {
        Self {
            watch_devices: true,
            watch_processes: true,
            process_interval_ms: 1500,
            banned_apps: Vec::new(),
            watch_foreground: true,
            keyboard_hook: false,
            block_shortcuts: false,
        }
    }
}

pub(crate) fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Commands — đều là async để chạy ngoài main thread (không giật UI).
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn monitor_snapshot() -> Result<SystemSnapshot, String> {
    Ok(SystemSnapshot {
        os: std::env::consts::OS,
        displays: platform::displays(),
        devices: platform::devices(),
        microphones: platform::microphones(),
        screen_capture: platform::screen_capture_status(),
        process_count: platform::processes().len(),
    })
}

#[tauri::command]
pub async fn monitor_displays() -> Result<Vec<DisplayInfo>, String> {
    Ok(platform::displays())
}

#[tauri::command]
pub async fn monitor_devices() -> Result<Vec<Device>, String> {
    Ok(platform::devices())
}

#[tauri::command]
pub async fn monitor_microphones() -> Result<Vec<AudioInput>, String> {
    Ok(platform::microphones())
}

#[tauri::command]
pub async fn monitor_processes() -> Result<Vec<ProcessInfo>, String> {
    Ok(platform::processes())
}

#[tauri::command]
pub async fn monitor_screen_capture_status() -> Result<ScreenCaptureStatus, String> {
    Ok(platform::screen_capture_status())
}

/// macOS: bật hộp thoại xin quyền Screen Recording. Nơi khác: trả trạng thái hiện tại.
#[tauri::command]
pub async fn monitor_request_screen_capture() -> Result<ScreenCaptureStatus, String> {
    Ok(platform::request_screen_capture())
}

/// Bật giám sát liên tục (gọi khi vào phòng thi). Gọi lại = áp cấu hình mới.
#[tauri::command]
pub async fn monitor_start(app: tauri::AppHandle, config: Option<MonitorConfig>) -> Result<(), String> {
    let config = config.unwrap_or_default();
    stop_all();

    if config.watch_processes {
        process_watch::start(app.clone(), config.process_interval_ms, config.banned_apps.clone());
    }
    if config.watch_devices {
        platform::start_device_watch(app.clone())?;
    }
    if config.watch_foreground || config.keyboard_hook {
        platform::start_hooks(
            app,
            config.watch_foreground,
            config.keyboard_hook,
            config.block_shortcuts,
        )?;
    }
    Ok(())
}

/// Tắt toàn bộ giám sát + gỡ hook (gọi khi nộp bài / thoát phòng thi).
#[tauri::command]
pub async fn monitor_stop() -> Result<(), String> {
    stop_all();
    Ok(())
}

/// Lấy và xoá bộ đệm phím (tối đa 4000 sự kiện gần nhất) từ hook bàn phím.
#[tauri::command]
pub async fn monitor_keylog_drain() -> Result<Vec<KeyEvent>, String> {
    Ok(platform::keylog_drain())
}

fn stop_all() {
    process_watch::stop();
    platform::stop_device_watch();
    platform::stop_hooks();
}

/// Gọi khi thoát app để chắc chắn gỡ hook hệ thống.
pub fn shutdown() {
    stop_all();
}
