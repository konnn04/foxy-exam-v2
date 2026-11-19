import { History as HistoryIcon } from "lucide-react";
import { Badge, Card, Empty } from "../../components/ui";
import { fmtDateTime, fmtScore, KIND_LABEL, type PageProps } from "./shared";
import { useI18n } from "../../lib/i18n";

/** Lượt thi gần nhất của mỗi kỳ thi (API hiện chỉ trả lượt gần nhất). */
export default function History({ data, loading }: PageProps) {
  const { t, lang } = useI18n();
  const isEn = lang === "en";

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return { label: isEn ? "In Progress" : "Đang làm", tone: "danger" as const };
      case "SUBMITTED":
        return { label: isEn ? "Submitted" : "Đã nộp", tone: "info" as const };
      case "GRADED":
        return { label: isEn ? "Graded" : "Đã chấm", tone: "success" as const };
      default:
        return { label: status, tone: "neutral" as const };
    }
  };

  const rows = data.exams
    .filter((e) => e.latest_attempt)
    .sort((a, b) => (b.latest_attempt!.started_at ?? "").localeCompare(a.latest_attempt!.started_at ?? ""));

  return (
    <div className="space-y-4 px-6 py-5">
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("main.history.title")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("main.history.countParticipated", { count: rows.length })}</p>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <Empty icon={<HistoryIcon size={18} />} text={loading ? t("common.loading") : t("main.history.empty")} />
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[10px] uppercase tracking-wider text-subtle">
                <th className="py-2 pl-4 font-semibold">{t("main.history.tableExam")}</th>
                <th className="px-2 font-semibold">{t("main.history.tableType")}</th>
                <th className="px-2 font-semibold">{t("main.history.tableStart")}</th>
                <th className="px-2 font-semibold">{t("main.history.tableSubmit")}</th>
                <th className="px-2 font-semibold">{t("main.history.tableStatus")}</th>
                <th className="pr-4 text-right font-semibold">{t("main.history.tableScore")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const a = e.latest_attempt!;
                const st = getStatusLabel(a.status);
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
