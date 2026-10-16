use std::sync::Mutex;

use serde::Serialize;
use sysinfo::System;

static SYSTEM: Mutex<Option<System>> = Mutex::new(None);

#[derive(Serialize)]
pub struct SystemInfo {
    os: String,
    hostname: String,
    cpu_model: String,
    cores: usize,
    ram_total_mb: u64,
    /// the machine id as the OS reports it (the frontend hashes it before it leaves the machine)
    machine_id: String,
}

#[derive(Serialize)]
pub struct SystemLoad {
    cpu: u8,
    ram: u8,
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    SystemInfo {
        os: format!(
            "{} {}",
            System::name().unwrap_or_default(),
            System::os_version().unwrap_or_default()
        )
        .trim()
        .to_string(),
        hostname: System::host_name().unwrap_or_default(),
        cpu_model: sys.cpus().first().map(|c| c.brand().trim().to_string()).unwrap_or_default(),
        cores: sys.cpus().len(),
        ram_total_mb: sys.total_memory() / 1024 / 1024,
        machine_id: machine_uid::get().unwrap_or_default(),
    }
}

/// CPU and memory use of the whole machine, 0..100. CPU needs two samples: the first call reports 0.
#[tauri::command]
pub fn system_load() -> SystemLoad {
    let mut guard = SYSTEM.lock().unwrap_or_else(|e| e.into_inner());
    let sys = guard.get_or_insert_with(System::new);
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    let total = sys.total_memory().max(1);
    SystemLoad {
        cpu: sys.global_cpu_usage().round().clamp(0.0, 100.0) as u8,
        ram: ((sys.used_memory() * 100) / total).min(100) as u8,
    }
}
