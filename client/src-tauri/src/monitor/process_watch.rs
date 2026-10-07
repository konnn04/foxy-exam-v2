//! Theo dõi tiến trình: chụp danh sách theo chu kỳ, so sánh với lần trước để
//! phát `monitor://process` (mở/tắt) và `monitor://banned-app` (app cấm).

use std::collections::{HashMap, HashSet};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use super::{platform, BannedApps, ProcessChanged, ProcessInfo};

static WORKER: Mutex<Option<(Sender<()>, JoinHandle<()>)>> = Mutex::new(None);

pub fn start(app: AppHandle, interval_ms: u64, banned: Vec<String>) {
    let interval = Duration::from_millis(interval_ms.clamp(300, 60_000));
    let matcher = BannedMatcher::new(&banned);
    let (stop_tx, stop_rx) = mpsc::channel::<()>();

    let handle = std::thread::Builder::new()
        .name("foxy-process-watch".into())
        .spawn(move || {
            let mut prev = to_map(platform::processes());
            let mut prev_banned = matcher.running(prev.values());
            // Báo ngay trạng thái ban đầu nếu đã có app cấm đang chạy.
            if !prev_banned.is_empty() {
                let _ = app.emit("monitor://banned-app", BannedApps { running: sorted(&prev_banned) });
            }

            loop {
                match stop_rx.recv_timeout(interval) {
                    Err(RecvTimeoutError::Timeout) => {}
                    _ => break, // nhận lệnh dừng hoặc sender đã bị drop
                }

                let cur = to_map(platform::processes());
                let started: Vec<ProcessInfo> = cur
                    .iter()
                    .filter(|(k, _)| !prev.contains_key(*k))
                    .map(|(_, p)| p.clone())
                    .collect();
                let exited: Vec<ProcessInfo> = prev
                    .iter()
                    .filter(|(k, _)| !cur.contains_key(*k))
                    .map(|(_, p)| p.clone())
                    .collect();

                if !started.is_empty() || !exited.is_empty() {
                    let _ = app.emit("monitor://process", ProcessChanged { started, exited });
                }

                if matcher.is_active() {
                    let banned_now = matcher.running(cur.values());
                    if banned_now != prev_banned {
                        let _ = app.emit("monitor://banned-app", BannedApps { running: sorted(&banned_now) });
                        prev_banned = banned_now;
                    }
                }
                prev = cur;
            }
        })
        .expect("spawn process watcher");

    *WORKER.lock().unwrap() = Some((stop_tx, handle));
}

pub fn stop() {
    let worker = WORKER.lock().unwrap().take();
    if let Some((tx, handle)) = worker {
        let _ = tx.send(());
        let _ = handle.join();
    }
}

/// Khoá theo (pid, tên) — Windows tái sử dụng PID nên chỉ PID là không đủ.
fn to_map(list: Vec<ProcessInfo>) -> HashMap<(u32, String), ProcessInfo> {
    list.into_iter().map(|p| ((p.pid, p.name.clone()), p)).collect()
}

fn sorted(set: &HashSet<ProcessInfo>) -> Vec<ProcessInfo> {
    let mut v: Vec<ProcessInfo> = set.iter().cloned().collect();
    v.sort_by(|a, b| a.name.cmp(&b.name).then(a.pid.cmp(&b.pid)));
    v
}

struct BannedMatcher {
    exact: HashSet<String>,
    prefixes: Vec<String>,
}

impl BannedMatcher {
    fn new(patterns: &[String]) -> Self {
        let mut exact = HashSet::new();
        let mut prefixes = Vec::new();
        for raw in patterns {
            let p = normalize(raw.trim());
            if p.is_empty() {
                continue;
            }
            match p.strip_suffix('*') {
                Some(prefix) if !prefix.is_empty() => prefixes.push(prefix.to_string()),
                Some(_) => {}
                None => {
                    exact.insert(p);
                }
            }
        }
        Self { exact, prefixes }
    }

    fn is_active(&self) -> bool {
        !self.exact.is_empty() || !self.prefixes.is_empty()
    }

    fn matches(&self, name: &str) -> bool {
        let n = normalize(name);
        self.exact.contains(&n) || self.prefixes.iter().any(|p| n.starts_with(p.as_str()))
    }

    fn running<'a>(&self, procs: impl Iterator<Item = &'a ProcessInfo>) -> HashSet<ProcessInfo> {
        if !self.is_active() {
            return HashSet::new();
        }
        procs.filter(|p| self.matches(&p.name)).cloned().collect()
    }
}

/// `Discord.exe` -> `discord`.
fn normalize(name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    lower.strip_suffix(".exe").map(str::to_string).unwrap_or(lower)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn banned_matching() {
        let m = BannedMatcher::new(&["Discord".into(), "obs*".into(), "tor".into(), "*".into()]);
        assert!(m.matches("Discord.exe"));
        assert!(m.matches("obs64.exe"));
        assert!(m.matches("tor.exe"));
        assert!(!m.matches("monitor.exe"));
        assert!(!m.matches("explorer.exe"));
    }
}
