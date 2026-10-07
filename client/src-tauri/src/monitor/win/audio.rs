//! Danh sách micro qua Core Audio (MMDevice) — chỉ thiết bị thu đang ACTIVE.

use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
    COINIT_MULTITHREADED, STGM_READ,
};

use crate::monitor::AudioInput;

pub fn microphones() -> Vec<AudioInput> {
    unsafe {
        // S_FALSE (đã init) vẫn phải cân bằng bằng CoUninitialize; lỗi RPC_E_CHANGED_MODE
        // (thread đã init kiểu khác) thì vẫn dùng COM được nhưng KHÔNG được uninit.
        let init = CoInitializeEx(None, COINIT_MULTITHREADED);
        let list = list_capture().unwrap_or_default();
        if init.is_ok() {
            CoUninitialize();
        }
        list
    }
}

unsafe fn list_capture() -> windows::core::Result<Vec<AudioInput>> {
    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

    let default_id = enumerator
        .GetDefaultAudioEndpoint(eCapture, eConsole)
        .and_then(|d| d.GetId())
        .map(|p| {
            let s = p.to_string().unwrap_or_default();
            CoTaskMemFree(Some(p.0 as _));
            s
        })
        .unwrap_or_default();

    let collection = enumerator.EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE)?;
    let count = collection.GetCount()?;
    let mut out = Vec::with_capacity(count as usize);

    for i in 0..count {
        let Ok(device) = collection.Item(i) else { continue };
        let id = match device.GetId() {
            Ok(p) => {
                let s = p.to_string().unwrap_or_default();
                CoTaskMemFree(Some(p.0 as _));
                s
            }
            Err(_) => continue,
        };
        let name = device
            .OpenPropertyStore(STGM_READ)
            .and_then(|store| store.GetValue(&PKEY_Device_FriendlyName))
            .map(|v| v.to_string())
            .unwrap_or_default();

        out.push(AudioInput {
            is_default: id == default_id,
            name: if name.is_empty() { "Microphone".into() } else { name },
            id,
        });
    }
    Ok(out)
}
