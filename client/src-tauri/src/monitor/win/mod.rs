//! Triển khai Windows — gọi thẳng Win32 API, không spawn `wmic`/`tasklist`.

mod audio;
mod devices;
mod displays;
mod hooks;
mod notify;
mod processes;

pub use audio::microphones;
pub use devices::devices;
pub use displays::displays;
pub use hooks::{keylog_drain, start_hooks, stop_hooks};
pub use notify::{start_device_watch, stop_device_watch};
pub use processes::processes;

use super::ScreenCaptureStatus;

/// Windows không có cơ chế cấp quyền quay màn hình cho ứng dụng desktop.
pub fn screen_capture_status() -> ScreenCaptureStatus {
    ScreenCaptureStatus::NotRequired
}

pub fn request_screen_capture() -> ScreenCaptureStatus {
    ScreenCaptureStatus::NotRequired
}

/// UTF-16 (có thể kết thúc bằng NUL) -> String.
pub(crate) fn wide_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}

#[cfg(test)]
mod tests {
    use std::time::Instant;

    /// `cargo test --lib monitor -- --nocapture` để xem dữ liệu thật + thời gian quét.
    #[test]
    fn snapshot_smoke() {
        let t = Instant::now();
        let procs = super::processes();
        println!("processes: {} in {:?}", procs.len(), t.elapsed());
        assert!(!procs.is_empty());

        let t = Instant::now();
        let devs = super::devices();
        println!("devices: {} in {:?}", devs.len(), t.elapsed());
        for d in &devs {
            println!("  [{:?}] {} ({}) {:?}", d.kind, d.name, d.class, d.hardware_id);
        }

        let t = Instant::now();
        let disp = super::displays();
        println!("displays: {:?} in {:?}", disp, t.elapsed());

        let t = Instant::now();
        let mics = super::microphones();
        println!("microphones: {:?} in {:?}", mics, t.elapsed());
    }
}
