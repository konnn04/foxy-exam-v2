//! Liệt kê thiết bị đang cắm qua SetupAPI (cùng nguồn dữ liệu với Device Manager).

use windows::core::PCWSTR;
use windows::Win32::Devices::DeviceAndDriverInstallation::{
    SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
    SetupDiGetDeviceInstanceIdW, SetupDiGetDeviceRegistryPropertyW, DIGCF_ALLCLASSES,
    DIGCF_PRESENT, HDEVINFO, SETUP_DI_REGISTRY_PROPERTY, SPDRP_CLASS, SPDRP_DEVICEDESC,
    SPDRP_FRIENDLYNAME, SP_DEVINFO_DATA,
};

use super::wide_to_string;
use crate::monitor::{Device, DeviceKind};

/// Chỉ trả các thiết bị có ý nghĩa với giám sát: bàn phím, chuột, camera và
/// thiết bị USB (bỏ USB host controller / hub — lớp `USB`).
pub fn devices() -> Vec<Device> {
    let mut out = Vec::new();
    unsafe {
        let Ok(set) = SetupDiGetClassDevsW(None, PCWSTR::null(), None, DIGCF_PRESENT | DIGCF_ALLCLASSES)
        else {
            return out;
        };

        let mut index = 0u32;
        loop {
            let mut data = SP_DEVINFO_DATA {
                cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
                ..Default::default()
            };
            if SetupDiEnumDeviceInfo(set, index, &mut data).is_err() {
                break; // ERROR_NO_MORE_ITEMS
            }
            index += 1;

            let class = registry_string(set, &data, SPDRP_CLASS).unwrap_or_default();
            let id = instance_id(set, &data).unwrap_or_default();
            let Some(name) = registry_string(set, &data, SPDRP_FRIENDLYNAME)
                .or_else(|| registry_string(set, &data, SPDRP_DEVICEDESC))
            else {
                continue;
            };
            let Some(kind) = classify(&class, &id, &name) else { continue };

            let hardware_id = vid_pid(&id);
            out.push(Device { id, name, class, kind, hardware_id });
        }

        let _ = SetupDiDestroyDeviceInfoList(set);
    }
    out.sort_by(|a, b| (a.kind as u8, &a.name).cmp(&(b.kind as u8, &b.name)));
    out
}

const CAPTURE_WORDS: [&str; 12] = [
    "capture", "elgato", "avermedia", "cam link", "magewell", "hdmi", "blackmagic", "decklink", "game link", "obs virtual", "epoccam", "droidcam",
];
const VIRTUAL_DISPLAY_WORDS: [&str; 9] = ["virtual", "idd", "spacedesk", "duet", "usbmmidd", "dummy", "parsec", "indirect display", "displaylink"];

fn classify(class: &str, instance_id: &str, name: &str) -> Option<DeviceKind> {
    let lower = name.to_ascii_lowercase();
    let is_video_in = matches!(class, "Camera" | "Image" | "USB" | "MEDIA" | "Media" | "Unknown" | "System" | "") || instance_id.to_ascii_uppercase().starts_with("USB\\");
    if is_video_in && CAPTURE_WORDS.iter().any(|w| lower.contains(w)) {
        return Some(DeviceKind::Capture);
    }
    match class {
        "Monitor" => return Some(DeviceKind::Display),
        "Display" if VIRTUAL_DISPLAY_WORDS.iter().any(|w| lower.contains(w)) => return Some(DeviceKind::Display),
        "Keyboard" => return Some(DeviceKind::Keyboard),
        "Mouse" => return Some(DeviceKind::Mouse),
        "Camera" | "Image" => return Some(DeviceKind::Camera),
        // Host controller, root hub, generic hub — không phải thiết bị người dùng cắm vào.
        "USB" => return None,
        _ => {}
    }
    let upper = instance_id.to_ascii_uppercase();
    if upper.starts_with("USB\\") || upper.starts_with("USBSTOR\\") {
        Some(DeviceKind::Usb)
    } else {
        None
    }
}

/// `USB\VID_046D&PID_C52B&MI_00\...` -> `046D:C52B`.
fn vid_pid(instance_id: &str) -> Option<String> {
    let upper = instance_id.to_ascii_uppercase();
    let vid = upper.split("VID_").nth(1)?.get(..4)?;
    let pid = upper.split("PID_").nth(1)?.get(..4)?;
    Some(format!("{vid}:{pid}"))
}

unsafe fn registry_string(
    set: HDEVINFO,
    data: &SP_DEVINFO_DATA,
    prop: SETUP_DI_REGISTRY_PROPERTY,
) -> Option<String> {
    let mut buf = [0u8; 512];
    let mut required = 0u32;
    SetupDiGetDeviceRegistryPropertyW(set, data, prop, None, Some(&mut buf), Some(&mut required)).ok()?;
    let len = (required as usize).min(buf.len()) / 2;
    let wide: Vec<u16> = buf[..len * 2]
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    let s = wide_to_string(&wide);
    (!s.trim().is_empty()).then(|| s.trim().to_string())
}

unsafe fn instance_id(set: HDEVINFO, data: &SP_DEVINFO_DATA) -> Option<String> {
    let mut buf = [0u16; 512];
    SetupDiGetDeviceInstanceIdW(set, data, Some(&mut buf), None).ok()?;
    Some(wide_to_string(&buf))
}
