//! Linux: đọc thẳng `/sys`, `/proc` — không spawn lệnh ngoài, không thêm dependency,
//! chạy được cả X11 lẫn Wayland (không cần xrandr/udev).
//!
//! Giới hạn đã biết (Wayland cố tình không cho ứng dụng làm các việc này):
//! - Không hook bàn phím toàn cục, không chặn phím tắt hệ thống, không biết cửa sổ
//!   đang focus của app khác → `start_hooks` là no-op.
//! - Không có sự kiện cắm/rút rẻ tiền nếu không dùng netlink/udev → quét lại
//!   `/sys` mỗi 2s và so sánh (rất nhẹ, vài chục file nhỏ).

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Duration;

use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter};

use super::{AudioInput, Device, DeviceKind, DevicesChanged, DisplayInfo, KeyEvent, ProcessInfo, ScreenCaptureStatus};

const POLL: Duration = Duration::from_secs(2);

fn read(path: impl AsRef<Path>) -> Option<String> {
    let s = fs::read_to_string(path).ok()?;
    let s = s.trim();
    (!s.is_empty()).then(|| s.to_string())
}

// ---------------------------------------------------------------------------
// Màn hình — DRM connector đang "connected" (đúng cả khi chạy Wayland)
// ---------------------------------------------------------------------------

pub fn displays() -> Vec<DisplayInfo> {
    let Ok(dir) = fs::read_dir("/sys/class/drm") else { return Vec::new() };
    let mut connectors: Vec<PathBuf> = dir
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            let n = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            n.starts_with("card") && n.contains('-') && !n.contains("Writeback")
        })
        .filter(|p| read(p.join("status")).as_deref() == Some("connected"))
        .collect();
    connectors.sort();

    let mut out = Vec::new();
    let mut x = 0;
    for p in connectors {
        // "card1-eDP-1" -> "eDP-1"
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("").splitn(2, '-').nth(1).unwrap_or("").to_string();
        // Dòng đầu của `modes` là chế độ ưu tiên, dạng "1920x1080".
        let (w, h) = read(p.join("modes"))
            .and_then(|m| m.lines().next().map(str::to_string))
            .and_then(|m| {
                let (w, h) = m.split_once('x')?;
                Some((w.parse::<i32>().ok()?, h.split(|c: char| !c.is_ascii_digit()).next()?.parse::<i32>().ok()?))
            })
            .unwrap_or((0, 0));
        out.push(DisplayInfo { name, x, y: 0, width: w, height: h, primary: out.is_empty() });
        x += w; // /sys không biết bố cục thật; xếp nối tiếp để các màn không chồng nhau.
    }
    out
}

// ---------------------------------------------------------------------------
// Thiết bị: bàn phím / chuột (input), camera (v4l2), USB
// ---------------------------------------------------------------------------

const CAPTURE_WORDS: [&str; 12] = [
    "capture", "elgato", "avermedia", "cam link", "magewell", "hdmi", "blackmagic", "decklink", "game link", "obs virtual", "epoccam", "droidcam",
];

fn is_capture(name: &str) -> bool {
    let l = name.to_ascii_lowercase();
    CAPTURE_WORDS.iter().any(|w| l.contains(w))
}

/// Đi ngược cây sysfs tìm `idVendor`/`idProduct` của thiết bị USB cha → `VID:PID`.
fn usb_vid_pid(mut p: PathBuf) -> Option<String> {
    for _ in 0..8 {
        if let (Some(v), Some(d)) = (read(p.join("idVendor")), read(p.join("idProduct"))) {
            return Some(format!("{}:{}", v.to_ascii_uppercase(), d.to_ascii_uppercase()));
        }
        if !p.pop() {
            break;
        }
    }
    None
}

pub fn devices() -> Vec<Device> {
    let mut out = Vec::new();
    input_devices(&mut out);
    camera_devices(&mut out);
    usb_devices(&mut out);
    out.sort_by(|a, b| (a.kind as u8, &a.name).cmp(&(b.kind as u8, &b.name)));
    out
}

/// `/proc/bus/input/devices`: mỗi khối ngăn bằng dòng trống (I:/N:/S:/H:/B: EV=...).
fn input_devices(out: &mut Vec<Device>) {
    let Some(text) = fs::read_to_string("/proc/bus/input/devices").ok() else { return };
    for block in text.split("\n\n") {
        let (mut name, mut sysfs, mut handlers, mut ev, mut ids) = (String::new(), String::new(), String::new(), 0u64, (0u32, String::new(), String::new()));
        for line in block.lines() {
            if let Some(r) = line.strip_prefix("N: Name=") {
                name = r.trim().trim_matches('"').to_string();
            } else if let Some(r) = line.strip_prefix("S: Sysfs=") {
                sysfs = r.trim().to_string();
            } else if let Some(r) = line.strip_prefix("H: Handlers=") {
                handlers = r.to_string();
            } else if let Some(r) = line.strip_prefix("B: EV=") {
                ev = u64::from_str_radix(r.trim(), 16).unwrap_or(0);
            } else if let Some(r) = line.strip_prefix("I: ") {
                for kv in r.split_whitespace() {
                    match kv.split_once('=') {
                        Some(("Bus", v)) => ids.0 = u32::from_str_radix(v, 16).unwrap_or(0),
                        Some(("Vendor", v)) => ids.1 = v.to_ascii_uppercase(),
                        Some(("Product", v)) => ids.2 = v.to_ascii_uppercase(),
                        _ => {}
                    }
                }
            }
        }
        if name.is_empty() {
            continue;
        }
        let words: Vec<&str> = handlers.split_whitespace().collect();
        // EV_REP (bit 20) có ở bàn phím thật, không có ở nút nguồn / lid switch.
        let kind = if words.contains(&"kbd") && ev & (1 << 20) != 0 {
            DeviceKind::Keyboard
        } else if words.iter().any(|w| w.starts_with("mouse")) {
            DeviceKind::Mouse
        } else {
            continue;
        };
        // Chỉ USB (0003) / Bluetooth (0005) có VID:PID đáng tin; bàn phím tích hợp thì không.
        let hardware_id = matches!(ids.0, 0x0003 | 0x0005).then(|| format!("{}:{}", ids.1, ids.2));
        let class = if kind == DeviceKind::Keyboard { "Keyboard" } else { "Mouse" }.to_string();
        out.push(Device { id: format!("input:{sysfs}"), name, class, kind, hardware_id });
    }
}

fn camera_devices(out: &mut Vec<Device>) {
    let Ok(dir) = fs::read_dir("/sys/class/video4linux") else { return };
    for e in dir.flatten() {
        let p = e.path();
        // index 0 = node quay hình; các node sau thường là metadata của cùng 1 camera.
        if read(p.join("index")).as_deref().unwrap_or("0") != "0" {
            continue;
        }
        let Some(name) = read(p.join("name")) else { continue };
        let real = fs::canonicalize(p.join("device")).unwrap_or_else(|_| p.clone());
        let kind = if is_capture(&name) { DeviceKind::Capture } else { DeviceKind::Camera };
        out.push(Device {
            id: format!("v4l:{}", real.display()),
            name,
            class: "Camera".into(),
            kind,
            hardware_id: usb_vid_pid(real),
        });
    }
}

fn usb_devices(out: &mut Vec<Device>) {
    let Ok(dir) = fs::read_dir("/sys/bus/usb/devices") else { return };
    for e in dir.flatten() {
        let p = e.path();
        let n = e.file_name().to_string_lossy().to_string();
        // Bỏ interface ("1-2:1.0") và root hub ("usb1").
        if n.contains(':') || n.starts_with("usb") {
            continue;
        }
        if read(p.join("bDeviceClass")).as_deref() == Some("09") {
            continue; // hub
        }
        let (Some(vid), Some(pid)) = (read(p.join("idVendor")), read(p.join("idProduct"))) else { continue };
        let name = read(p.join("product")).unwrap_or_else(|| format!("USB {vid}:{pid}"));
        let kind = if is_capture(&name) { DeviceKind::Capture } else { DeviceKind::Usb };
        out.push(Device {
            id: format!("usb:{n}"),
            name,
            class: "USB".into(),
            kind,
            hardware_id: Some(format!("{}:{}", vid.to_ascii_uppercase(), pid.to_ascii_uppercase())),
        });
    }
}

// ---------------------------------------------------------------------------
// Micro — card ALSA có thiết bị capture (`pcmNc`)
// ---------------------------------------------------------------------------

pub fn microphones() -> Vec<AudioInput> {
    let Some(text) = fs::read_to_string("/proc/asound/cards").ok() else { return Vec::new() };
    let mut out = Vec::new();
    for line in text.lines() {
        // " 0 [Headset        ]: USB-Audio - EH497W Wireless Headset"
        let t = line.trim_start();
        let Some((idx, rest)) = t.split_once(' ') else { continue };
        let Ok(idx) = idx.parse::<u32>() else { continue };
        let has_capture = fs::read_dir(format!("/proc/asound/card{idx}"))
            .map(|d| d.flatten().any(|e| {
                let n = e.file_name().to_string_lossy().to_string();
                n.starts_with("pcm") && n.ends_with('c')
            }))
            .unwrap_or(false);
        if !has_capture {
            continue;
        }
        let name = rest.split_once(" - ").map(|(_, n)| n.trim().to_string()).unwrap_or_else(|| rest.trim().to_string());
        out.push(AudioInput { id: format!("alsa:{idx}"), name, is_default: out.is_empty() });
    }
    out
}

// ---------------------------------------------------------------------------
// Tiến trình — đọc /proc trực tiếp
// ---------------------------------------------------------------------------

pub fn processes() -> Vec<ProcessInfo> {
    let Ok(dir) = fs::read_dir("/proc") else { return Vec::new() };
    let mut out = Vec::with_capacity(256);
    for e in dir.flatten() {
        let Some(pid) = e.file_name().to_str().and_then(|s| s.parse::<u32>().ok()) else { continue };
        let Some(stat) = fs::read_to_string(format!("/proc/{pid}/stat")).ok() else { continue };
        // "pid (comm) S ppid ..." — comm có thể chứa ngoặc/khoảng trắng nên cắt theo ')' cuối.
        let Some(close) = stat.rfind(')') else { continue };
        let ppid = stat[close + 1..].split_whitespace().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
        // Bỏ kernel thread (không có exe), comm bị cắt 15 ký tự nên ưu tiên tên file exe.
        let exe = fs::read_link(format!("/proc/{pid}/exe")).ok();
        let Some(name) = exe
            .as_ref()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().trim_end_matches(" (deleted)").to_string())
            .or_else(|| (ppid != 2 && pid != 2).then(|| stat.get(stat.find('(')? + 1..close).map(str::to_string)).flatten())
        else {
            continue;
        };
        out.push(ProcessInfo { pid, ppid, name });
    }
    out
}

pub fn kill_process(pid: u32) -> Result<bool, String> {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
    Ok(sys.process(Pid::from_u32(pid)).map(|p| p.kill()).unwrap_or(false))
}

// ---------------------------------------------------------------------------
// Theo dõi cắm/rút — quét định kỳ rồi so sánh
// ---------------------------------------------------------------------------

static WATCH: Mutex<Option<(Sender<()>, JoinHandle<()>)>> = Mutex::new(None);

pub fn start_device_watch(app: AppHandle) -> Result<(), String> {
    stop_device_watch();
    let (tx, rx) = mpsc::channel::<()>();
    let handle = std::thread::Builder::new()
        .name("foxy-device-watch".into())
        .spawn(move || {
            let mut prev: HashSet<Device> = devices().into_iter().collect();
            let mut prev_displays = displays();
            let mut prev_mics = microphones();
            loop {
                match rx.recv_timeout(POLL) {
                    Err(RecvTimeoutError::Timeout) => {}
                    _ => break,
                }
                let cur: HashSet<Device> = devices().into_iter().collect();
                let cur_displays = displays();
                let cur_mics = microphones();
                let added: Vec<Device> = cur.difference(&prev).cloned().collect();
                let removed: Vec<Device> = prev.difference(&cur).cloned().collect();
                if !added.is_empty() || !removed.is_empty() || cur_displays != prev_displays || cur_mics != prev_mics {
                    let _ = app.emit(
                        "monitor://devices",
                        DevicesChanged { added, removed, displays: cur_displays.clone(), microphones: cur_mics.clone() },
                    );
                }
                prev = cur;
                prev_displays = cur_displays;
                prev_mics = cur_mics;
            }
        })
        .map_err(|e| e.to_string())?;
    *WATCH.lock().unwrap() = Some((tx, handle));
    Ok(())
}

pub fn stop_device_watch() {
    let w = WATCH.lock().unwrap().take();
    if let Some((tx, h)) = w {
        drop(tx);
        let _ = h.join();
    }
}

// ---------------------------------------------------------------------------
// Hook toàn cục — không khả thi trên Wayland; để no-op (xem ghi chú đầu file)
// ---------------------------------------------------------------------------

pub fn start_hooks(_app: AppHandle, _fg: bool, _kb: bool, _block: bool) -> Result<(), String> {
    Ok(())
}
pub fn stop_hooks() {}
pub fn keylog_drain() -> Vec<KeyEvent> {
    Vec::new()
}

/// X11: ai cũng quay được màn hình. Wayland: phải xin qua portal khi quay → chưa biết trước.
pub fn screen_capture_status() -> ScreenCaptureStatus {
    if std::env::var_os("WAYLAND_DISPLAY").is_none() && std::env::var_os("DISPLAY").is_some() {
        ScreenCaptureStatus::NotRequired
    } else {
        ScreenCaptureStatus::Unknown
    }
}

pub fn request_screen_capture() -> ScreenCaptureStatus {
    screen_capture_status()
}

#[cfg(test)]
mod tests {
    /// `cargo test --lib monitor -- --nocapture` để xem dữ liệu thật của máy đang chạy.
    #[test]
    fn snapshot_smoke() {
        let procs = super::processes();
        println!("processes: {}", procs.len());
        assert!(!procs.is_empty());
        println!("displays: {:?}", super::displays());
        println!("microphones: {:?}", super::microphones());
        for d in super::devices() {
            println!("  [{:?}] {} ({}) {:?}", d.kind, d.name, d.class, d.hardware_id);
        }
    }
}
