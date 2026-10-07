import { History as HistoryIcon } from "lucide-react";
import { Badge, Card, Empty } from "../../components/ui";
import { fmtDateTime, fmtScore, KIND_LABEL, type PageProps } from "./shared";

const STATUS: Record<string, { label: string; tone: "danger" | "success" | "info" | "neutral" }> = {
  IN_PROGRESS: { label: "Đang làm", tone: "danger" },
  SUBMITTED: { label: "Đã nộp", tone: "info" },
  GRADED: { label: "Đã chấm", tone: "success" },
};

/** Lượt thi gần nhất của mỗi kỳ thi (API hiện chỉ trả lượt gần nhất). */
export default function History({ data, loading }: PageProps) {
  const rows = data.exams
    .filter((e) => e.latest_attempt)
    .sort((a, b) => (b.latest_attempt!.started_at ?? "").localeCompare(a.latest_attempt!.started_at ?? ""));

  return (
    <div className="space-y-4 px-6 py-5">
      <div>
        <h2 className="text-xl font-semibold text-fg">Lịch sử thi</h2>
        <p className="mt-0.5 text-xs text-muted">{rows.length} kỳ thi đã tham gia</p>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <Empty icon={<HistoryIcon size={18} />} text={loading ? "Đang tải…" : "Bạn chưa tham gia kỳ thi nào."} />
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[10px] uppercase tracking-wider text-subtle">
                <th className="py-2 pl-4 font-semibold">Kì thi</th>
                <th className="px-2 font-semibold">Dạng đề</th>
                <th className="px-2 font-semibold">Bắt đầu</th>
                <th className="px-2 font-semibold">Nộp bài</th>
                <th className="px-2 font-semibold">Trạng thái</th>
                <th className="pr-4 text-right font-semibold">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const a = e.latest_attempt!;
                const st = STATUS[a.status] ?? { label: a.status, tone: "neutral" as const };
                return (
                  <tr key={e.id} className="border-b border-line last:border-b-0">
                    <td className="py-3 pl-4">
                      <p className="text-[13px] font-medium text-fg">{e.title}</p>
                      <p className="text-[11px] text-muted">
                        {e.course.name} · {e.course.code}
                      </p>
                    </td>
                    <td className="px-2 text-fg">{KIND_LABEL[e.type]}</td>
                    <td className="px-2 font-mono text-fg">{fmtDateTime(a.started_at)}</td>
                    <td className="px-2 font-mono text-fg">{fmtDateTime(a.submitted_at)}</td>
                    <td className="px-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="pr-4 text-right font-mono text-[13px] font-semibold text-fg">
                      {a.score != null ? fmtScore(a.score) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
