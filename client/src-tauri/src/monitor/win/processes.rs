use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

use super::wide_to_string;
use crate::monitor::ProcessInfo;

/// Chụp danh sách tiến trình (ToolHelp32 — chỉ đọc bảng tiến trình của kernel,
/// không mở từng tiến trình nên rất nhanh, không cần quyền admin).
pub fn processes() -> Vec<ProcessInfo> {
    let mut out = Vec::with_capacity(256);
    unsafe {
        let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return out;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snap, &mut entry).is_ok() {
            loop {
                if entry.th32ProcessID != 0 {
                    out.push(ProcessInfo {
                        pid: entry.th32ProcessID,
                        ppid: entry.th32ParentProcessID,
                        name: wide_to_string(&entry.szExeFile),
                    });
                }
                if Process32NextW(snap, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
    }
    out
}

/// Buộc dừng một tiến trình theo PID (do giám thị yêu cầu từ xa).
/// Không cho phép tắt tiến trình hệ thống (PID <= 4) hoặc chính FoxyExam.
pub fn kill_process(pid: u32) -> Result<bool, String> {
    if pid <= 4 || pid == std::process::id() {
        return Err("Không được phép kết thúc tiến trình hệ thống hoặc chính ứng dụng thi.".into());
    }
    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, false, pid)
            .map_err(|e| format!("Không mở được tiến trình #{pid}: {e}"))?;
        let res = TerminateProcess(handle, 1);
        let _ = CloseHandle(handle);
        res.map(|_| true)
            .map_err(|e| format!("Không thể kết thúc tiến trình #{pid}: {e}"))
    }
}
