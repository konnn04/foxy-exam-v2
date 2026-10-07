import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Camera, Cpu, Download, Keyboard, LogOut, Mic, Monitor, MonitorSmartphone, Mouse, Palette, RefreshCw, Usb } from "lucide-react";
import { Badge, Button, Card, CardHeader, cx } from "../../components/ui";
import { useTheme, type ThemePref } from "../../lib/theme";
import { AppWindow, openPopup } from "../../lib/windowNav";
import { getAuth } from "../../lib/authStore";
import { getFaceDelegate, setFaceDelegate, type FaceDelegate } from "../../lib/vision";
import type { Device, DeviceKind } from "../../lib/monitor";
import type { PageProps } from "./shared";

const KIND_META: Record<DeviceKind, { label: string; icon: typeof Camera }> = {
  camera: { label: "Camera", icon: Camera },
  keyboard: { label: "Bàn phím", icon: Keyboard },
  mouse: { label: "Chuột", icon: Mouse },
  usb: { label: "Thiết bị USB khác", icon: Usb },
};

export default function Settings({ device, onLogout }: PageProps & { onLogout: () => void }) {
  const { pref, setPref } = useTheme();
  const [version, setVersion] = useState("");
  const [delegate, setDelegate] = useState<FaceDelegate>(getFaceDelegate);
  useEffect(() => void getVersion().then(setVersion).catch(() => {}), []);

  const snap = device.snapshot;
  const remember = getAuth()?.remember ?? false;

  return (
    <div className="grid grid-cols-1 gap-4 px-6 py-5 xl:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader icon={<Palette size={15} />} title="Giao diện" />
          <div className="flex gap-2 p-4">
            {(
              [
                ["light", "Sáng"],
                ["dark", "Tối"],
                ["system", "Theo hệ thống"],
              ] as [ThemePref, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPref(value)}
                className={cx(
                  "flex-1 rounded-lg border px-3 py-2 text-xs transition",
                  pref === value ? "border-accent bg-accent-soft font-medium text-accent-fg" : "border-line text-muted hover:bg-surface-3",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Cpu size={15} />} title="Phân tích khuôn mặt (MediaPipe)" />
          <div className="space-y-2 p-4">
            <div className="flex gap-2">
              {(
                [
                  ["auto", "Tự động"],
                  ["gpu", "GPU"],
                  ["cpu", "CPU"],
                ] as [FaceDelegate, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFaceDelegate(value);
                    setDelegate(value);
                  }}
                  className={cx(
                    "flex-1 rounded-lg border px-3 py-2 text-xs transition",
                    delegate === value ? "border-accent bg-accent-soft font-medium text-accent-fg" : "border-line text-muted hover:bg-surface-3",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">Tự động dùng GPU và chuyển sang CPU nếu GPU không chạy được. Áp dụng từ lần vào thi tiếp theo.</p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Download size={15} />} title="Ứng dụng" />
          <div className="flex items-center justify-between p-4 text-xs">
            <div>
              <p className="font-medium text-fg">Foxy Exam Client {version && `v${version}`}</p>
              <p className="text-muted">Tự kiểm tra cập nhật mỗi lần mở ứng dụng.</p>
            </div>
            <Button icon={<RefreshCw size={13} />} onClick={() => void openPopup(AppWindow.Update)}>
              Kiểm tra cập nhật
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<LogOut size={15} />} title="Tài khoản" />
          <div className="flex items-center justify-between p-4 text-xs">
            <p className="text-muted">
              {remember ? "Đăng nhập được ghi nhớ trên máy này." : "Đăng nhập chỉ có hiệu lực tới khi tắt ứng dụng."}
            </p>
            <Button variant="danger" icon={<LogOut size={13} />} onClick={onLogout}>
              Đăng xuất
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<MonitorSmartphone size={15} />}
          title="Thiết bị trên máy"
          right={
            <Button size="sm" icon={<RefreshCw size={12} className={device.checking ? "animate-spin" : ""} />} onClick={device.refresh} disabled={device.checking}>
              Quét lại
            </Button>
          }
        />
        <div className="space-y-4 p-4 text-xs">
          {!snap ? (
            <p className="text-muted">{device.checking ? "Đang quét…" : device.error ?? "—"}</p>
          ) : (
            <>
              <Group icon={Monitor} title={`Màn hình · ${snap.displays.length}`} warn={snap.displays.length > 1}>
                {snap.displays.map((d) => (
                  <Row key={d.name} name={d.name.replace("\\\\.\\", "")} detail={`${d.width}×${d.height}`} badge={d.primary ? "Chính" : undefined} />
                ))}
              </Group>
              <Group icon={Mic} title={`Micro · ${snap.microphones.length}`}>
                {snap.microphones.map((m) => (
                  <Row key={m.id} name={m.name} badge={m.isDefault ? "Mặc định" : undefined} />
                ))}
              </Group>
              {(Object.keys(KIND_META) as DeviceKind[]).map((kind) => (
                <DeviceGroup key={kind} kind={kind} devices={snap.devices.filter((d) => d.kind === kind)} />
              ))}
              <p className="text-[11px] text-subtle">
                Đang chạy {snap.processCount} tiến trình · quyền quay màn hình: {snap.screenCapture === "not_required" ? "không cần cấp quyền" : snap.screenCapture}
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function DeviceGroup({ kind, devices }: { kind: DeviceKind; devices: Device[] }) {
  const { label, icon } = KIND_META[kind];
  // Gộp các interface HID cùng VID:PID thành 1 thiết bị vật lý.
  const groups = new Map<string, Device[]>();
  for (const d of devices) {
    const key = d.hardwareId ?? d.id;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return (
    <Group icon={icon} title={`${label} · ${groups.size}`}>
      {[...groups.entries()].map(([key, list]) => (
        <Row key={key} name={list[0].name} detail={list[0].hardwareId ?? "Tích hợp"} badge={list.length > 1 ? `${list.length} interface` : undefined} />
      ))}
    </Group>
  );
}

function Group({ icon: Icon, title, warn, children }: { icon: typeof Camera; title: string; warn?: boolean; children: React.ReactNode }) {
  const empty = Array.isArray(children) && children.length === 0;
  return (
    <div>
      <p className={cx("mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold", warn ? "text-danger" : "text-muted")}>
        <Icon size={13} /> {title}
      </p>
      <div className="overflow-hidden rounded-lg border border-line">
        {empty ? <p className="px-3 py-2 text-subtle">Không có</p> : children}
      </div>
    </div>
  );
}

function Row({ name, detail, badge }: { name: string; detail?: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-fg">{name}</span>
      {detail && <span className="font-mono text-[10px] text-subtle">{detail}</span>}
      {badge && <Badge>{badge}</Badge>}
    </div>
  );
}
