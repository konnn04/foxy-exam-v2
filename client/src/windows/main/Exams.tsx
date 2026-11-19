import { useState } from "react";
import { Check, Monitor, MonitorCheck, RefreshCw, RotateCcw, ShieldCheck, X } from "lucide-react";
import { Button, Card, CardHeader, Empty, Tip, cx } from "../../components/ui";
import {
  ExamStateBadge,
  attemptsLeft,
  canRetake,
  examState,
  fmtDate,
  fmtTime,
  fromNow,
  getKindLabel,
  getMonitorFlags,
  KindIcon,
  MonitorIcons,
  type DeviceCheck,
  type ExamItem,
  type ExamState,
  type PageProps,
} from "./shared";
import { Chip } from "./Courses";
import { useI18n } from "../../lib/i18n";

type Tab = "upcoming" | "in_progress" | "done" | "missed";

const TAB_STATES: Record<Tab, ExamState[]> = {
  upcoming: ["open", "upcoming"],
  in_progress: ["in_progress"],
  done: ["done"],
  missed: ["missed"],
};

export default function Exams(props: PageProps) {
  const { data, device } = props;
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("upcoming");

  const count = (t: Tab) => data.exams.filter((e) => TAB_STATES[t].includes(examState(e))).length;
  const list = data.exams
    .filter((e) => TAB_STATES[tab].includes(examState(e)))
    .sort((a, b) => {
      // Đang thi lên đầu, rồi đến bài đang mở, rồi theo giờ bắt đầu.
      const rank = (e: ExamItem) => ({ in_progress: 0, open: 1, upcoming: 2, done: 3, missed: 4 })[examState(e)];
      return rank(a) - rank(b) || (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });

  const next = data.exams
    .filter((e) => ["open", "upcoming"].includes(examState(e)))
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))[0];

  const monitorFlags = getMonitorFlags(lang === "en");

  return (
    <div className="space-y-4 px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("main.exams.title")}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {t("main.exams.summary", {
              upcoming: count("upcoming"),
              inProgress: count("in_progress"),
              done: count("done"),
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Chip active={tab === "upcoming"} onClick={() => setTab("upcoming")}>
            {t("main.exams.tabUpcoming")}
          </Chip>
          <Chip active={tab === "in_progress"} onClick={() => setTab("in_progress")}>
            {t("main.exams.tabInProgress")}
          </Chip>
          <Chip active={tab === "done"} onClick={() => setTab("done")}>
            {t("main.exams.tabDone")}
          </Chip>
          <Chip active={tab === "missed"} onClick={() => setTab("missed")}>
            {t("main.exams.tabMissed")}
          </Chip>
        </div>
      </div>

      <Card className="overflow-hidden">
        <ExamTable {...props} exams={list} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader icon={<ShieldCheck size={15} />} title={t("main.exams.nextRequirement")} right={next && <span className="text-[11px] text-muted">{next.title}</span>} />
          {next ? (
            <div className="flex flex-wrap items-center gap-2 p-3">
              {monitorFlags.filter(({ key }) => !!next.monitoring_config?.[key]).map(({ key, label, icon: Icon }) => (
                <Tip key={key} label={label}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft text-accent">
                    <Icon size={15} />
                  </span>
                </Tip>
              ))}
              {!monitorFlags.some(({ key }) => next.monitoring_config?.[key]) && <span className="text-xs text-muted">{t("main.exams.noSpecialRequirement")}</span>}
            </div>
          ) : (
            <Empty text={t("main.exams.noNextExam")} />
          )}
        </Card>
        <DeviceCheckCard device={device} />
      </div>
    </div>
  );
}

export function ExamTable({
  exams,
  startingId,
  onStart,
  loading,
  hideCourse,
}: PageProps & { exams: ExamItem[]; hideCourse?: boolean }) {
  const { t, lang } = useI18n();
  if (exams.length === 0) return <Empty text={loading ? t("main.exams.loading") : t("main.exams.empty")} />;

  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-line bg-surface-2 text-[10px] uppercase tracking-wider text-subtle">
          <th className="py-2 pl-4 pr-2 font-semibold" colSpan={2}>{t("main.exams.thExam")}</th>
          <th className="px-2 font-semibold">{t("main.exams.thStart")}</th>
          <th className="px-2 font-semibold">{t("main.exams.thDuration")}</th>
          <th className="px-2 font-semibold">{t("main.exams.thKind")}</th>
          <th className="px-2 font-semibold">{t("main.exams.thMonitor")}</th>
          <th className="px-2 font-semibold">{t("main.exams.thStatus")}</th>
          <th className="w-28 pr-4" />
        </tr>
      </thead>
      <tbody>
        {exams.map((e) => {
          const s = examState(e);
          return (
            <tr
              key={e.id}
              className={cx(
                "border-b border-line last:border-b-0",
                s === "open" && "bg-accent-soft/50",
                s === "in_progress" && "bg-danger-soft/50",
              )}
            >
              <td className="w-10 py-3 pl-4">
                <span
                  className={cx(
                    "flex h-7 w-7 items-center justify-center rounded-md border",
                    s === "done" ? "border-success/30 text-success" : s === "open" || s === "in_progress" ? "border-accent/40 text-accent" : "border-line text-muted",
                  )}
                >
                  {s === "done" ? <Check size={14} /> : <KindIcon kind={e.type} size={14} />}
                </span>
              </td>
              <td className="py-3 pr-2">
                <p className="text-[13px] font-medium text-fg">{e.title}</p>
                <p className="text-[11px] text-muted">
                  {!hideCourse && `${e.course.code} · `}
                  {e.code}
                </p>
              </td>
              <td className="px-2">
                <p className="font-mono text-fg">
                  {fmtDate(e.start_time)} {fmtTime(e.start_time)}
                </p>
                {e.start_time && s !== "done" && <p className="text-[11px] text-accent-fg">{fromNow(e.start_time)}</p>}
              </td>
              <td className="px-2 font-mono text-fg">{e.duration_minutes}′</td>
              <td className="px-2 text-fg">{getKindLabel(e.type, lang === "en")}</td>
              <td className="px-2">
                <MonitorIcons config={e.monitoring_config} />
              </td>
              <td className="px-2">
                <ExamStateBadge exam={e} />
              </td>
              <td className="pr-4 text-right">
                {s === "open" && (
                  <Button size="sm" variant="primary" className="w-24" loading={startingId === e.id} disabled={startingId !== null} onClick={() => onStart(e)}>
                    {t("main.exams.btnEnter")}
                  </Button>
                )}
                {s === "in_progress" && (
                  <Button size="sm" variant="danger" className="w-24" loading={startingId === e.id} disabled={startingId !== null} onClick={() => onStart(e)}>
                    {t("main.exams.btnContinue")}
                  </Button>
                )}
                {s === "done" && canRetake(e) && (
                  <Button
                    size="sm"
                    className="w-24"
                    icon={<RotateCcw size={12} />}
                    title={attemptsLeft(e) === null ? t("main.exams.retakeUnlimited") : t("main.exams.retakeRemaining", { count: attemptsLeft(e) ?? 0 })}
                    loading={startingId === e.id}
                    disabled={startingId !== null}
                    onClick={() => onStart(e)}
                  >
                    {t("main.exams.btnRetake")}
                  </Button>
                )}
                {s === "done" && canRetake(e) && attemptsLeft(e) !== null && (
                  <p className="mt-0.5 text-[10px] text-subtle">{t("main.exams.retakeRemainingHint", { count: attemptsLeft(e) ?? 0 })}</p>
                )}
                {(s === "upcoming" || s === "missed" || (s === "done" && !canRetake(e))) && <span className="text-subtle">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function DeviceCheckCard({ device }: { device: DeviceCheck }) {
  const { t } = useI18n();
  const row = (ok: boolean, text: string) => (
    <li className={cx("flex items-center gap-2", ok ? "text-fg" : "font-medium text-danger")}>
      {ok ? <Check size={13} className="text-success" /> : <X size={13} />}
      {text}
    </li>
  );
  const snap = device.snapshot;
  const cams = snap?.devices.filter((d) => d.kind === "camera") ?? [];
  const mic = snap?.microphones.find((m) => m.isDefault) ?? snap?.microphones[0];

  return (
    <Card>
      <CardHeader icon={<MonitorCheck size={15} />} title={t("main.exams.deviceCheckTitle")} />
      <div className="p-3">
        {snap ? (
          <ul className="space-y-1.5 text-xs">
            {row(cams.length > 0, cams.length > 0 ? t("main.exams.webcamFound", { name: cams[0].name }) : t("main.exams.noWebcam"))}
            {row(!!mic, mic ? t("main.exams.micFound", { name: mic.name }) : t("main.exams.noMic"))}
            {row(device.displays === 1, device.displays === 1 ? t("main.exams.oneDisplay") : t("main.exams.multiDisplayWarn", { count: device.displays }))}
            {row(device.captureCards === 0, device.captureCards === 0 ? t("main.exams.noCaptureCard") : t("main.exams.hasCaptureCard", { count: device.captureCards }))}
            {row(device.keyboards <= 1, t("main.exams.externalKeyboards", { count: device.keyboards }))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Monitor size={13} /> {device.checking ? t("main.exams.checking") : device.error ?? t("main.exams.notChecked")}
          </p>
        )}
        <Button className="mt-3 w-full" icon={<RefreshCw size={13} className={device.checking ? "animate-spin" : ""} />} onClick={device.refresh} disabled={device.checking}>
          {t("main.exams.recheckBtn")}
        </Button>
      </div>
    </Card>
  );
}
