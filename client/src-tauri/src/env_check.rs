//! Exam environment check: virtual machine, remote desktop session, OS family and boot time.
//!
//! A VM is reported only on strong evidence: a VM hypervisor vendor in CPUID, VM strings in the firmware (SMBIOS)
//! or a VM guest driver on disk. The CPUID "hypervisor present" bit alone is NOT enough: Windows sets it on real
//! machines when Hyper-V / VBS / WSL2 is on (vendor "Microsoft Hv").

use serde::Serialize;

#[derive(Serialize, Default)]
pub struct VmInfo {
    pub detected: bool,
    pub vendor: Option<String>,
    /// what was found, for the proctor (e.g. "cpuid:VMwareVMware", "bios:VirtualBox", "driver:VBoxGuest.sys")
    pub evidence: Vec<String>,
}

#[derive(Serialize)]
pub struct EnvCheck {
    /// windows | linux | macos
    pub os_family: &'static str,
    pub vm: VmInfo,
    /// Windows RDP session, xrdp, or the app started over SSH with X forwarding
    pub remote_session: bool,
    /// seconds since the epoch; changes on every reboot
    pub boot_time: u64,
}

const VM_WORDS: &[(&str, &str)] = &[
    ("vmware", "VMware"),
    ("virtualbox", "VirtualBox"),
    ("vbox", "VirtualBox"),
    ("qemu", "QEMU"),
    ("kvm", "KVM"),
    ("xen", "Xen"),
    ("parallels", "Parallels"),
    ("bochs", "Bochs"),
    ("innotek", "VirtualBox"),
    ("bhyve", "bhyve"),
    ("virtual machine", "Hyper-V"),
    ("utm", "UTM"),
];

fn vendor_of(text: &str) -> Option<&'static str> {
    let t = text.to_lowercase();
    VM_WORDS.iter().find(|(w, _)| {
        // "utm" and "kvm" are short: match whole words only
        if w.len() <= 3 {
            t.split(|c: char| !c.is_ascii_alphanumeric()).any(|part| part == *w)
        } else {
            t.contains(w)
        }
    }).map(|(_, v)| *v)
}

fn add(vm: &mut VmInfo, vendor: &str, evidence: String) {
    vm.detected = true;
    vm.vendor.get_or_insert_with(|| vendor.to_string());
    vm.evidence.push(evidence);
}

#[cfg(any(target_arch = "x86_64", target_arch = "x86"))]
#[allow(unused_unsafe)]
fn cpuid_vendor() -> Option<String> {
    #[cfg(target_arch = "x86")]
    use core::arch::x86::__cpuid;
    #[cfg(target_arch = "x86_64")]
    use core::arch::x86_64::__cpuid;
    let leaf1 = unsafe { __cpuid(1) };
    if leaf1.ecx & (1 << 31) == 0 {
        return None; // no hypervisor at all
    }
    let r = unsafe { __cpuid(0x4000_0000) };
    let bytes: Vec<u8> = [r.ebx, r.ecx, r.edx].iter().flat_map(|v| v.to_le_bytes()).collect();
    Some(String::from_utf8_lossy(&bytes).trim_matches(char::from(0)).trim().to_string())
}

#[cfg(not(any(target_arch = "x86_64", target_arch = "x86")))]
fn cpuid_vendor() -> Option<String> {
    None
}

fn check_cpuid(vm: &mut VmInfo) {
    if let Some(v) = cpuid_vendor() {
        let known = [
            ("VMwareVMware", "VMware"),
            ("VBoxVBoxVBox", "VirtualBox"),
            ("KVMKVMKVM", "KVM"),
            ("XenVMMXenVMM", "Xen"),
            ("prl hyperv", "Parallels"),
            ("lrpepyh  vr", "Parallels"),
            ("TCGTCGTCGTCG", "QEMU"),
            ("bhyve bhyve", "bhyve"),
            ("ACRNACRNACRN", "ACRN"),
            ("QNXQVMBSQG", "QNX"),
            ("VirtualApple", "Apple VZ"),
        ];
        if let Some((_, name)) = known.iter().find(|(sig, _)| v.contains(sig)) {
            add(vm, name, format!("cpuid:{v}"));
        }
        // "Microsoft Hv" is also what a real Windows machine with VBS/WSL2 reports: decided by the firmware strings below
    }
}

#[cfg(windows)]
fn platform_checks(vm: &mut VmInfo) -> bool {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ};
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_REMOTESESSION};

    let read = |key: &str, value: &str| -> Option<String> {
        let mut buf = vec![0u16; 512];
        let mut size = (buf.len() * 2) as u32;
        let ok = unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(HSTRING::from(key).as_ptr()),
                PCWSTR(HSTRING::from(value).as_ptr()),
                RRF_RT_REG_SZ,
                None,
                Some(buf.as_mut_ptr().cast()),
                Some(&mut size),
            )
        };
        if ok.is_err() {
            return None;
        }
        let len = (size as usize / 2).saturating_sub(1).min(buf.len());
        Some(String::from_utf16_lossy(&buf[..len]).trim().to_string())
    };

    for value in ["SystemManufacturer", "SystemProductName", "BIOSVendor", "BaseBoardManufacturer"] {
        if let Some(text) = read(r"HARDWARE\DESCRIPTION\System\BIOS", value) {
            if let Some(v) = vendor_of(&text) {
                // a Hyper-V guest says manufacturer "Microsoft Corporation", product "Virtual Machine"
                add(vm, v, format!("bios:{text}"));
            }
        }
    }

    let drivers = [
        ("VBoxGuest.sys", "VirtualBox"),
        ("VBoxMouse.sys", "VirtualBox"),
        ("vmhgfs.sys", "VMware"),
        ("vmmouse.sys", "VMware"),
        ("vm3dmp.sys", "VMware"),
        ("prl_fs.sys", "Parallels"),
        ("vioser.sys", "QEMU"),
        ("xenbus.sys", "Xen"),
    ];
    if let Ok(root) = std::env::var("SystemRoot") {
        for (file, name) in drivers {
            if std::path::Path::new(&format!(r"{root}\System32\drivers\{file}")).exists() {
                add(vm, name, format!("driver:{file}"));
            }
        }
    }

    unsafe { GetSystemMetrics(SM_REMOTESESSION) != 0 }
}

#[cfg(target_os = "linux")]
fn platform_checks(vm: &mut VmInfo) -> bool {
    for f in ["sys_vendor", "product_name", "board_vendor", "bios_vendor"] {
        if let Ok(text) = std::fs::read_to_string(format!("/sys/class/dmi/id/{f}")) {
            if let Some(v) = vendor_of(&text) {
                add(vm, v, format!("dmi:{}", text.trim()));
            }
        }
    }
    for (path, name) in [("/proc/xen", "Xen"), ("/dev/vboxguest", "VirtualBox"), ("/sys/bus/vmbus", "Hyper-V")] {
        if std::path::Path::new(path).exists() {
            add(vm, name, format!("path:{path}"));
        }
    }
    std::env::var_os("XRDP_SESSION").is_some() || std::env::var_os("SSH_CONNECTION").is_some()
}

#[cfg(target_os = "macos")]
fn platform_checks(vm: &mut VmInfo) -> bool {
    let sysctl = |name: &str| {
        std::process::Command::new("sysctl").args(["-n", name]).output().ok().map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    };
    if sysctl("kern.hv_vmm_present").as_deref() == Some("1") {
        add(vm, "macOS VM", "sysctl:kern.hv_vmm_present".into());
    }
    if let Some(model) = sysctl("hw.model") {
        if let Some(v) = vendor_of(&model) {
            add(vm, v, format!("hw.model:{model}"));
        }
    }
    false
}

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
fn platform_checks(_vm: &mut VmInfo) -> bool {
    false
}

#[tauri::command]
pub fn env_check() -> EnvCheck {
    let mut vm = VmInfo::default();
    check_cpuid(&mut vm);
    let remote_session = platform_checks(&mut vm);
    vm.evidence.dedup();
    EnvCheck {
        os_family: if cfg!(windows) {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "linux"
        },
        vm,
        remote_session,
        boot_time: sysinfo::System::boot_time(),
    }
}

#[cfg(test)]
mod tests {
    use super::vendor_of;

    #[test]
    fn firmware_strings() {
        assert_eq!(vendor_of("VMware, Inc."), Some("VMware"));
        assert_eq!(vendor_of("innotek GmbH"), Some("VirtualBox"));
        assert_eq!(vendor_of("Virtual Machine"), Some("Hyper-V"));
        assert_eq!(vendor_of("QEMU Standard PC (Q35 + ICH9, 2009)"), Some("QEMU"));
        assert_eq!(vendor_of("Dell Inc."), None);
        assert_eq!(vendor_of("LENOVO 20XW"), None);
        assert_eq!(vendor_of("ASUSTeK COMPUTER INC."), None);
        // short words only as whole words
        assert_eq!(vendor_of("Computer Futm Corp"), None);
    }

    /// `cargo test env_check -- --nocapture` shows what this machine reports
    #[test]
    fn this_machine() {
        println!("{}", serde_json::to_string_pretty(&super::env_check()).unwrap());
    }
}
