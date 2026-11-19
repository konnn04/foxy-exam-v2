import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  Camera,
  Cpu,
  Download,
  Globe,
  Keyboard,
  LogOut,
  Mic,
  Monitor,
  MonitorSmartphone,
  Mouse,
  Palette,
  RefreshCw,
  Usb,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, cx } from "../../components/ui";
import { useTheme, type ThemePref } from "../../lib/theme";
import { checkForUpdateAndInstall, type UpdateStatus } from "../../lib/updater";
import { getAuth } from "../../lib/authStore";
import { getFaceDelegate, setFaceDelegate, type FaceDelegate } from "../../lib/vision";
import { useI18n, type Lang } from "../../lib/i18n";
import type { Device, DeviceKind } from "../../lib/monitor";
import type { PageProps } from "./shared";

export default function Settings({ device, onLogout }: PageProps & { onLogout: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { pref, setPref } = useTheme();
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateStatus>({ state: "idle" });
  const updating = update.state === "checking" || update.state === "downloading" || update.state === "installing";
  const [delegate, setDelegate] = useState<FaceDelegate>(getFaceDelegate);
  useEffect(() => void getVersion().then(setVersion).catch(() => {}), []);

  const snap = device.snapshot;
  const remember = getAuth()?.remember ?? false;

  const getKindLabel = (kind: DeviceKind) => {
    switch (kind) {
      case "camera":
        return t("main.settings.cameras");
      case "keyboard":
        return t("main.settings.keyboards");
      case "mouse":
        return t("main.settings.mice");
      case "usb":
        return t("main.settings.usbDevices");
      case "display":
        return t("main.settings.displays");
      case "capture":
        return t("main.settings.captureCards");
    }
  };

  const getKindIcon = (kind: DeviceKind) => {
    switch (kind) {
      case "camera":
      case "capture":
        return Camera;
      case "keyboard":
        return Keyboard;
      case "mouse":
        return Mouse;
      case "usb":
        return Usb;
      case "display":
        return Monitor;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 px-6 py-5 xl:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4">
        {/* Language Selection Card */}
        <Card>
          <CardHeader icon={<Globe size={15} />} title={t("main.settings.languageTitle")} />
          <div className="flex gap-2 p-4">
            {(
              [
                ["vi", t("main.settings.languageVi")],
                ["en", t("main.settings.languageEn")],
              ] as [Lang, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLang(value)}
                className={cx(
                  "flex-1 rounded-lg border px-3 py-2 text-xs transition font-medium",
                  lang === value
                    ? "border-accent bg-accent-soft text-accent-fg"
                    : "border-line text-muted hover:bg-surface-3",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {/* Theme Card */}
        <Card>
          <CardHeader icon={<Palette size={15} />} title={t("main.settings.themeTitle")} />
          <div className="flex gap-2 p-4">
            {(
              [
                ["light", t("main.settings.themeLight")],
                ["dark", t("main.settings.themeDark")],
                ["system", t("main.settings.themeSystem")],
              ] as [ThemePref, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPref(value)}
                className={cx(
                  "flex-1 rounded-lg border px-3 py-2 text-xs transition",
                  pref === value
                    ? "border-accent bg-accent-soft font-medium text-accent-fg"
                    : "border-line text-muted hover:bg-surface-3",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {/* MediaPipe Face Inference Card */}
        <Card>
          <CardHeader icon={<Cpu size={15} />} title={t("main.settings.faceDelegateTitle")} />
          <div className="space-y-2 p-4">
            <div className="flex gap-2">
              {(
                [
                  ["auto", t("main.settings.delegateAuto")],
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
                    delegate === value
                      ? "border-accent bg-accent-soft font-medium text-accent-fg"
                      : "border-line text-muted hover:bg-surface-3",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">{t("main.settings.faceDelegateHint")}</p>
          </div>
        </Card>

        {/* Application Card */}
        <Card>
          <CardHeader icon={<Download size={15} />} title={t("main.settings.appTitle")} />
          <div className="flex items-center justify-between gap-3 p-4 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-fg">Exam Guard Client {version && `v${version}`}</p>
              <p className={update.state === "error" ? "text-danger" : "text-muted"}>{updateText(update, t)}</p>
            </div>
            <Button
              icon={<RefreshCw size={13} className={updating ? "animate-spin" : ""} />}
              disabled={updating}
              onClick={() => void checkForUpdateAndInstall(setUpdate)}
            >
              {t("main.settings.checkUpdate")}
            </Button>
          </div>
        </Card>

        {/* Account Card */}
        <Card>
          <CardHeader icon={<LogOut size={15} />} title={t("main.settings.accountTitle")} />
          <div className="flex items-center justify-between p-4 text-xs">
            <p className="text-muted">
              {remember ? t("main.settings.remembered") : t("main.settings.notRemembered")}
            </p>
            <Button variant="danger" icon={<LogOut size={13} />} onClick={onLogout}>
              {t("main.nav.logout")}
            </Button>
          </div>
        </Card>
      </div>

      {/* Hardware / Connected Devices Card */}
      <Card>
        <CardHeader
          icon={<MonitorSmartphone size={15} />}
          title={t("main.settings.devicesTitle")}
          right={
            <Button
              size="sm"
              icon={<RefreshCw size={12} className={device.checking ? "animate-spin" : ""} />}
              onClick={device.refresh}
              disabled={device.checking}
            >
              {t("main.settings.rescan")}
            </Button>
          }
        />
        <div className="space-y-4 p-4 text-xs">
          {!snap ? (
            <p className="text-muted">{device.checking ? t("main.settings.scanning") : device.error ?? "—"}</p>
          ) : (
            <>
              <Group
                icon={Monitor}
                title={`${t("main.settings.displays")} · ${snap.displays.length}`}
                warn={snap.displays.length > 1}
                emptyText={t("main.settings.none")}
              >
                {snap.displays.map((d) => (
                  <Row
                    key={d.name}
                    name={d.name.replace("\\\\.\\", "")}
                    detail={`${d.width}×${d.height}`}
                    badge={d.primary ? t("main.settings.primary") : undefined}
                  />
                ))}
              </Group>

              <Group
                icon={Mic}
                title={`${t("main.settings.microphones")} · ${snap.microphones.length}`}
                emptyText={t("main.settings.none")}
              >
                {snap.microphones.map((m) => (
                  <Row key={m.id} name={m.name} badge={m.isDefault ? t("main.settings.default") : undefined} />
                ))}
              </Group>

              {(["camera", "keyboard", "mouse", "usb", "capture"] as DeviceKind[]).map((kind) => (
                <DeviceGroup
                  key={kind}
                  label={getKindLabel(kind)}
                  icon={getKindIcon(kind)}
                  emptyText={t("main.settings.none")}
                  integratedLabel={t("main.settings.integrated")}
                  devices={snap.devices.filter((d) => d.kind === kind)}
                />
              ))}

              <p className="text-[11px] text-subtle">
                {t("main.settings.processCount", { count: snap.processCount })} ·{" "}
                {t("main.settings.screenCapturePerm", {
                  perm: snap.screenCapture === "not_required" ? "OK" : snap.screenCapture,
                })}
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function DeviceGroup({
  label,
  icon,
  emptyText,
  integratedLabel,
  devices,
}: {
  label: string;
  icon: typeof Camera;
  emptyText: string;
  integratedLabel: string;
  devices: Device[];
}) {
  const groups = new Map<string, Device[]>();
  for (const d of devices) {
    const key = d.hardwareId ?? d.id;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return (
    <Group icon={icon} title={`${label} · ${groups.size}`} emptyText={emptyText}>
      {[...groups.entries()].map(([key, list]) => (
        <Row
          key={key}
          name={list[0].name}
          detail={list[0].hardwareId ?? integratedLabel}
          badge={list.length > 1 ? `${list.length} interface` : undefined}
        />
      ))}
    </Group>
  );
}

function Group({
  icon: Icon,
  title,
  warn,
  emptyText,
  children,
}: {
  icon: typeof Camera;
  title: string;
  warn?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  const empty = Array.isArray(children) && children.length === 0;
  return (
    <div>
      <p className={cx("mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold", warn ? "text-danger" : "text-muted")}>
        <Icon size={13} /> {title}
      </p>
      <div className="overflow-hidden rounded-lg border border-line">
        {empty ? <p className="px-3 py-2 text-subtle">{emptyText ?? "None"}</p> : children}
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

function updateText(s: UpdateStatus, t: (k: string, vars?: any) => string): string {
  switch (s.state) {
    case "checking":
      return t("update.checking");
    case "up-to-date":
      return t("update.upToDate");
    case "available":
      return t("update.available", { version: s.version });
    case "downloading":
      return t("update.downloading", { percent: s.percent });
    case "installing":
      return t("update.installing");
    case "error":
      return `${t("update.error")}: ${s.message}`;
    default:
      return t("update.upToDate");
  }
}
