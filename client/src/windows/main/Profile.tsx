import { formatDate } from "../../lib/datetime";
import { BarChart3, Laptop, Lock, User } from "lucide-react";
import { Badge, Card, CardHeader } from "../../components/ui";
import { fmtScore, initials, type PageProps } from "./shared";
import { useI18n } from "../../lib/i18n";

/** Hồ sơ chỉ đọc (API chưa có endpoint cập nhật hồ sơ). */
export default function Profile({ data, device }: PageProps) {
  const { t, lang } = useI18n();
  const isEn = lang === "en";
  const me = data.me;
  const stats = data.dashboard?.statistics;
  const graded = data.exams.map((e) => e.latest_attempt?.score).filter((s): s is number => s != null);
  const avg = graded.length ? graded.reduce((a, b) => a + b, 0) / graded.length : null;

  return (
    <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[280px_1fr]">
      <Card className="flex h-fit flex-col items-center p-5 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-surface-3 text-2xl font-semibold text-muted">
          {me ? initials(me.name) : "?"}
        </span>
        <p className="mt-3 text-[15px] font-semibold text-fg">{me?.name ?? "—"}</p>
        <p className="text-xs text-muted">{me?.username}</p>
        <div className="mt-2 flex gap-1.5">
          <Badge tone={me?.status === "ACTIVE" ? "success" : "warning"}>
            {me?.status === "ACTIVE" ? t("main.profile.statusActive") : me?.status ?? "—"}
          </Badge>
          <Badge>{t("main.profile.roleCandidate")}</Badge>
        </div>
        {me?.organization && <p className="mt-3 text-xs text-muted">{me.organization.name}</p>}
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader icon={<User size={15} />} title={t("main.profile.title")} />
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 md:grid-cols-2">
            <Field label={t("main.profile.lastName")} value={[me?.last_name, me?.middle_name].filter(Boolean).join(" ")} />
            <Field label={t("main.profile.firstName")} value={me?.first_name} />
            <Field label={t("main.profile.emailOrg")} value={me?.email} locked />
            <Field label={t("main.profile.username")} value={me?.username} locked />
            <Field label={t("main.profile.dob")} value={me?.date_of_birth ? formatDate(me.date_of_birth) : null} />
            <Field label={t("main.profile.address")} value={me?.address} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader icon={<Laptop size={15} />} title={t("main.profile.currentDevice")} />
            <ul className="space-y-1.5 p-4 text-xs text-fg">
              <li className="flex justify-between">
                <span className="text-muted">{t("main.profile.os")}</span> {device.snapshot?.os ?? "—"}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">{t("main.profile.displays")}</span> {device.displays}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">{t("main.profile.cameras")}</span> {device.cameras}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">{t("main.profile.microphones")}</span> {device.microphones}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">{t("main.profile.keyboards")}</span> {device.keyboards}
              </li>
            </ul>
          </Card>

          <Card>
            <CardHeader icon={<BarChart3 size={15} />} title={isEn ? "Exam Statistics" : "Thống kê thi"} />
            <div className="grid grid-cols-3 gap-2 p-4">
              <Metric value={stats?.completed_attempts ?? "—"} label={t("main.dashboard.statCompleted")} />
              <Metric value={avg != null ? fmtScore(avg) : "—"} label={isEn ? "Average Score" : "Điểm trung bình"} />
              <Metric value={stats?.total_courses ?? "—"} label={t("main.dashboard.statCourses")} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, locked }: { label: string; value?: string | null; locked?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-fg">{label}</p>
      <div className="flex h-9 items-center justify-between rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-fg">
        <span className="selectable truncate">{value || <span className="text-subtle">—</span>}</span>
        {locked && <Lock size={12} className="text-subtle" />}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-xl font-semibold text-fg">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
