import { formatDateTime } from '@/lib/datetime';
import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Check, Copy, Eye, FileText, Pencil, ShieldAlert, Trash2, Users, X } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FxButton, IconButton, PageHeader, Panel, PanelBar, PanelTitle, Pill } from '@/components/foxy/ui';
import { ATTEMPT_STATUS, DIFFICULTY, severityOf, timeAgo, violationLabel } from '@/components/foxy/domain';
import { EXAM_STATUS, KIND_META } from '@/components/foxy/exam-form';
import { useDialog } from '@/components/foxy/dialogs';
import { cn } from '@/lib/utils';

interface Props {
  user: any;
  teams: TeamItem[];
  exam: {
    id: number;
    title: string;
    code: string;
    type: string;
    duration_minutes: number;
    status: string;
    start_time?: string | null;
    end_time?: string | null;
    max_attempts?: number | null;
    course_name?: string;
    question_set?: {
      id: number;
      name: string;
      code: string;
      type: 'CLASSICAL' | 'PROGRAMMING';
      description?: string;
      classical_questions?: { id: number; type: string; content: string; points: number; answers_count: number }[];
      programming_problems?: { id: number; title: string; difficulty: string; time_limit_ms: number; memory_limit_mb: number; test_cases_count?: number }[];
    } | null;
    monitoring_config?: Record<string, any>;
    attempts: { id: number; attempt_number?: number; student_name: string; student_username: string; status: string; score: number; started_at?: string }[];
    violations: { id: number; attempt_id?: number; student_name: string; type: string; severity: string; timestamp: string }[];
  };
}

const Q_TYPE: Record<string, string> = {
  SINGLE_CHOICE: 'Trắc nghiệm',
  MULTIPLE_CHOICE: 'Nhiều đáp án',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
  GROUP_QUESTION: 'Câu hỏi nhóm',
};

const fmtDate = (iso?: string | null) =>
  iso ? formatDateTime(iso) : 'Không giới hạn';

export default function ShowExam({ user, teams, exam }: Props) {
  const isCode = exam.question_set ? exam.question_set.type === 'PROGRAMMING' : exam.type !== 'QUIZ';
  const kind = isCode ? 'programming' : 'general';
  const meta = KIND_META[kind];
  const st = EXAM_STATUS[exam.status] ?? { label: exam.status, tone: 'neutral' as const };
  const cfg = exam.monitoring_config ?? {};
  const [copied, setCopied] = useState(false);
  const dialog = useDialog();
  const removeExam = async () => {
    const ok = await dialog.confirm({
      title: `Xóa kỳ thi “${exam.title}”?`,
      text: 'Bài làm, bài nộp, Op-Log và vi phạm của thí sinh trong kỳ thi cũng bị xóa.',
      warn: exam.attempts.length ? `Đã có ${exam.attempts.length} lượt làm bài.` : undefined,
      tone: 'danger',
      requireText: exam.attempts.length ? exam.code : undefined,
      confirmLabel: 'Xóa kỳ thi',
    });
    if (ok) router.post(`/admin/exams/${exam.id}/delete`);
  };
  const removeAttempt = async (a: Props['exam']['attempts'][number]) => {
    const ok = await dialog.confirm({
      title: `Xóa phiên thi #${a.attempt_number ?? 1} của ${a.student_name}?`,
      text: 'Bài làm, bài nộp, nhật ký gõ phím và vi phạm của lượt này bị xóa vĩnh viễn. Thí sinh được trả lại 1 lượt thi.',
      tone: 'danger',
      confirmLabel: 'Xóa phiên thi',
    });
    if (ok) router.post(`/admin/exams/${exam.id}/attempts/${a.id}/delete`, {}, { preserveScroll: true });
  };
  const qs = exam.question_set;

  const monitor: [string, boolean][] = [
    ['Theo dõi chuyển tab / cửa sổ', !!cfg.prevent_tab_switch],
    ['Xác thực khuôn mặt (AI)', !!cfg.ai_face_check],
    ...(isCode
      ? ([
          [`Chặn dán code (> ${cfg.max_paste_chars ?? 80} ký tự)`, !!cfg.prevent_paste],
          ['Ghi Op-Log từng phím', !!cfg.track_keystroke_dynamics],
        ] as [string, boolean][])
      : ([
          ['Trộn câu hỏi', !!cfg.is_shuffle_questions],
          ['Trộn đáp án', !!cfg.is_shuffle_answers],
          ['Ẩn điểm sau khi thi', !!cfg.is_hide_score],
          ['Cho xem lại bài', !!cfg.is_allow_review],
          ['Bật micro', !!cfg.require_mic],
        ] as [string, boolean][])),
  ];

  return (
    <AdminLayout user={user} teams={teams} currentTab="exams" title={exam.title} breadcrumbs={[{ label: 'Kỳ thi', href: '/admin/exams' }, { label: exam.title }]}>
      <PageHeader
        onBack={() => router.visit('/admin/exams')}
        title={exam.title}
        badges={
          <>
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <Pill tone={st.tone}>{st.label}</Pill>
          </>
        }
        desc={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Phòng
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 font-mono text-foreground hover:text-brand-fg"
              onClick={() => {
                navigator.clipboard?.writeText(exam.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {exam.code}
              {copied ? <Check className="size-3" /> : <Copy className="size-3 opacity-60" />}
            </button>
            · {exam.course_name}
          </span>
        }
        actions={
          <>
            <FxButton icon={Trash2} className="text-danger-fg" onClick={removeExam}>
              Xóa
            </FxButton>
            <FxButton icon={Pencil} onClick={() => router.visit(`/admin/exams/${exam.id}/edit`)}>
              Sửa
            </FxButton>
            <FxButton variant="primary" icon={Eye} onClick={() => router.visit(`/admin/exams/${exam.id}/live`)}>
              Giám sát
            </FxButton>
          </>
        }
      />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        {[
          ['Thời lượng', `${exam.duration_minutes} phút`],
          ['Mở phòng', fmtDate(exam.start_time)],
          ['Đóng phòng', fmtDate(exam.end_time)],
          ['Số lượt / thí sinh', exam.max_attempts ?? 'Không giới hạn'],
          ['Lượt làm bài', exam.attempts.length],
          ['Vi phạm', exam.violations.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex flex-col gap-1 bg-card px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="truncate text-[15px] font-semibold tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
          <Panel padded={false} className="overflow-hidden">
            <PanelBar>
              <PanelTitle
                className="flex-1"
                title={isCode ? 'Bài toán trong đề' : 'Nội dung đề'}
                desc={qs ? `${qs.code} · ${qs.name}` : 'Chưa gắn bộ đề'}
              />
              {qs && (
                <FxButton size="sm" onClick={() => router.visit(`/admin/question-sets/${qs.id}`)}>
                  Mở {isCode ? 'bộ bài' : 'bộ đề'}
                </FxButton>
              )}
            </PanelBar>
            {isCode ? (
              qs?.programming_problems?.length ? (
                qs.programming_problems.map((p, i) => {
                  const d = DIFFICULTY[p.difficulty] ?? DIFFICULTY.MEDIUM;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => router.visit(`/admin/question-sets/${qs.id}/problems/${p.id}`)}
                      className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-surface"
                    >
                      <span className="w-7 font-bold">P{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.title}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {p.time_limit_ms / 1000}s · {p.memory_limit_mb}MB · {p.test_cases_count ?? 0} test
                        </div>
                      </div>
                      <Pill tone={d.tone}>{d.short}</Pill>
                    </button>
                  );
                })
              ) : (
                <EmptyState icon={FileText} title="Chưa có bài toán" />
              )
            ) : qs?.classical_questions?.length ? (
              qs.classical_questions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <span className="flex h-[22px] min-w-6 items-center justify-center rounded-md border border-foreground/20 bg-surface font-mono text-[11px] font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{q.content}</span>
                  <Pill size="sm">{Q_TYPE[q.type] ?? q.type}</Pill>
                  <span className="w-12 text-right text-xs text-muted-foreground">{Number(q.points)}đ</span>
                </div>
              ))
            ) : (
              <EmptyState icon={FileText} title="Bộ đề chưa có câu hỏi" />
            )}
          </Panel>

          <Panel padded={false} className="overflow-hidden">
            <PanelBar>
              <PanelTitle className="flex-1" title="Lượt làm bài" desc={`${exam.attempts.length} lượt`} />
              <FxButton size="sm" onClick={() => router.visit(`/admin/reports/${exam.id}`)}>
                Báo cáo
              </FxButton>
            </PanelBar>
            {exam.attempts.length === 0 ? (
              <EmptyState icon={Users} title="Chưa có thí sinh làm bài" />
            ) : (
              exam.attempts.map((a) => {
                const s = ATTEMPT_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const };
                return (
                  <div
                    key={a.id}
                    onClick={() => router.visit(`/admin/attempts/${a.id}`)}
                    className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{a.student_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {a.student_username} · lượt #{a.attempt_number ?? 1}
                        {a.started_at && ` · ${a.started_at}`}
                      </div>
                    </div>
                    <Pill tone={s.tone}>{s.label}</Pill>
                    <span className="w-14 text-right font-semibold tabular-nums">{a.score}đ</span>
                    <IconButton
                      icon={Trash2}
                      label="Xóa phiên thi"
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttempt(a);
                      }}
                    />
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Panel className="flex flex-col gap-1 p-4">
            <PanelTitle className="mb-2" title={isCode ? 'Làm bài & giám sát' : 'Làm bài, chấm & giám sát'} />
            {monitor.map(([label, on]) => (
              <div key={label} className="flex items-center gap-2.5 py-1.5 text-[13px]">
                <span className={cn('flex size-5 items-center justify-center rounded-full', on ? 'bg-success/20 text-success-fg' : 'bg-muted text-muted-foreground')}>
                  {on ? <Check className="size-3" /> : <X className="size-3" />}
                </span>
                <span className={on ? '' : 'text-muted-foreground'}>{label}</span>
              </div>
            ))}
          </Panel>
          <Panel padded={false} className="overflow-hidden">
            <PanelBar>
              <PanelTitle className="flex-1" title="Vi phạm gần đây" />
            </PanelBar>
            {exam.violations.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="Chưa có vi phạm" />
            ) : (
              exam.violations.map((v) => {
                const sev = severityOf(v.severity);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => v.attempt_id && router.visit(`/admin/attempts/${v.attempt_id}?violation=${v.id}`)}
                    className="flex w-full cursor-pointer items-center gap-2.5 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-surface"
                  >
                    <Pill tone={sev.tone} size="sm">
                      {sev.label}
                    </Pill>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{violationLabel(v.type)}</div>
                      <div className="truncate text-xs text-muted-foreground">{v.student_name}</div>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{timeAgo(v.timestamp)}</span>
                  </button>
                );
              })
            )}
          </Panel>
        </div>
      </div>

    </AdminLayout>
  );
}
