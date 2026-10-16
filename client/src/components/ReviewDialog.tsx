import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X, XCircle, Hourglass } from "lucide-react";
import { getAttemptReview, type AttemptReview, type ReviewAnswer } from "../lib/api";
import { Markdown } from "./Markdown";
import { cx } from "./ui";

const fmt = (n: number | null | undefined) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2));

function chosen(a: ReviewAnswer): string {
  if (a.options?.length) {
    const ids = new Set([...(a.selected_answer_ids ?? []), ...(a.selected_answer_id != null ? [a.selected_answer_id] : [])]);
    const picked = a.options.filter((o) => ids.has(o.id)).map((o) => o.content);
    if (picked.length) return picked.join(" · ");
  }
  return a.answer_content?.trim() || "(để trống)";
}

/** The student's own submitted paper after the exam: their answers, the key, the score of each question and the teacher's comment. */
export function ReviewDialog({ examId, attemptId, title, onClose }: { examId: number; attemptId: number; title: string; onClose: () => void }) {
  const [data, setData] = useState<AttemptReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAttemptReview(examId, attemptId)
      .then((r) => setData(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Không tải được bài làm."));
  }, [examId, attemptId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-fg">Xem lại bài làm · {title}</h2>
            {data && <p className="text-[11px] text-muted">{data.score_hidden ? "Điểm chưa được công bố" : `Tổng điểm ${fmt(data.score)}`}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:text-fg" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {!data && !error && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 size={14} className="animate-spin" /> Đang tải…
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          {data?.answers.map((a, i) => (
            <div key={a.question_id} className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] text-muted">
                <span className="font-mono">Câu {i + 1}</span>
                <span className="ml-auto flex items-center gap-1 font-mono">
                  {a.pending_review ? (
                    <>
                      <Hourglass size={12} className="text-warning" /> chờ chấm
                    </>
                  ) : a.is_correct === true ? (
                    <CheckCircle2 size={12} className="text-success" />
                  ) : a.is_correct === false ? (
                    <XCircle size={12} className="text-danger" />
                  ) : null}
                  {a.score_earned != null ? `${fmt(a.score_earned)}/${fmt(a.points)}` : `${fmt(a.points)} điểm`}
                </span>
              </div>
              <div className="text-sm text-fg">
                <Markdown>{a.content ?? ""}</Markdown>
              </div>
              <div className="mt-2 rounded-lg border border-line bg-surface p-2.5 text-[13px]">
                <p className="mb-0.5 text-[11px] text-muted">Bài làm của bạn</p>
                <p className="whitespace-pre-wrap break-words text-fg">{chosen(a)}</p>
              </div>
              {a.options && a.options.some((o) => o.is_correct) && (
                <p className={cx("mt-2 text-[12px]", "text-muted")}>
                  Đáp án đúng: <span className="text-fg">{a.options.filter((o) => o.is_correct).map((o) => o.content).join(" · ")}</span>
                </p>
              )}
              {a.reference && (
                <p className="mt-2 text-[12px] text-muted">
                  Đáp án tham khảo: <span className="text-fg">{a.reference}</span>
                </p>
              )}
              {a.explanation && (
                <div className="mt-2 text-[12px] text-muted">
                  <Markdown>{a.explanation}</Markdown>
                </div>
              )}
              {a.feedback && <p className="mt-2 rounded-lg bg-accent-soft px-2.5 py-1.5 text-[12px] text-accent-fg">Nhận xét của giảng viên: {a.feedback}</p>}
            </div>
          ))}
          {data && data.answers.length === 0 && <p className="text-xs text-muted">Bài này không có câu trả lời nào được lưu.</p>}
        </div>
      </div>
    </div>
  );
}
