import { BarChart3, Laptop, Lock, User } from "lucide-react";
import { Badge, Card, CardHeader } from "../../components/ui";
import { fmtScore, initials, type PageProps } from "./shared";

/** Hồ sơ chỉ đọc (API chưa có endpoint cập nhật hồ sơ). */
export default function Profile({ data, device }: PageProps) {
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
            {me?.status === "ACTIVE" ? "Đang hoạt động" : me?.status ?? "—"}
          </Badge>
          <Badge>Thí sinh</Badge>
        </div>
        {me?.organization && <p className="mt-3 text-xs text-muted">{me.organization.name}</p>}
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader icon={<User size={15} />} title="Hồ sơ" />
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 md:grid-cols-2">
            <Field label="Họ" value={[me?.last_name, me?.middle_name].filter(Boolean).join(" ")} />
            <Field label="Tên" value={me?.first_name} />
            <Field label="Email tổ chức" value={me?.email} locked />
            <Field label="Tên đăng nhập / MSSV" value={me?.username} locked />
            <Field label="Ngày sinh" value={me?.date_of_birth ? new Date(me.date_of_birth).toLocaleDateString("vi-VN") : null} />
            <Field label="Địa chỉ" value={me?.address} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader icon={<Laptop size={15} />} title="Thiết bị hiện tại" />
            <ul className="space-y-1.5 p-4 text-xs text-fg">
              <li className="flex justify-between">
                <span className="text-muted">Hệ điều hành</span> {device.snapshot?.os ?? "—"}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Màn hình</span> {device.displays}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Camera</span> {device.cameras}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Micro</span> {device.microphones}
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Bàn phím ngoài</span> {device.keyboards}
              </li>
            </ul>
          </Card>

          <Card>
            <CardHeader icon={<BarChart3 size={15} />} title="Thống kê thi" />
            <div className="grid grid-cols-3 gap-2 p-4">
              <Metric value={stats?.completed_attempts ?? "—"} label="Bài đã nộp" />
              <Metric value={avg != null ? fmtScore(avg) : "—"} label="Điểm trung bình" />
              <Metric value={stats?.total_courses ?? "—"} label="Khoá học" />
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
