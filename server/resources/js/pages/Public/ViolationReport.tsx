import React, { useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Printer,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Video,
  XCircle,
} from 'lucide-react';
import { SessionMedia } from '@/components/foxy/session-media';
import { Panel, Pill } from '@/components/foxy/ui';
import {
  clockOffset,
  detailLabel,
  hhmm,
  severityOf,
  TONE_VAR,
  violationDetail,
  violationLabel,
} from '@/components/foxy/domain';
import { cn } from '@/lib/utils';

interface PublicViolationRow {
  id: number;
  type: string;
  label?: string;
  severity: string;
  details: unknown;
  evidence_url: string | null;
  evidence_id: string | null;
  is_reviewed: boolean;
  is_false_positive: boolean;
  timestamp: string | null;
}

interface PublicReportProps {
  expiredOrRevoked: boolean;
  reason?: string;
  report?: {
    id: number;
    slug: string;
    status: 'no_violation' | 'warning' | 'suspended';
    suspension_reason: string | null;
    score_deduction_percent: number;
    original_score: number | null;
    final_score: number | null;
    attached_violation_ids: number[];
    published_at: string | null;
    link_expires_at: string | null;
    reporter_name: string;
  };
  attempt?: {
    id: number;
    attempt_number: number;
    status: string;
    score: number | null;
    risk_score: number;
    started_at: string | null;
    submitted_at: string | null;
    device_info: Record<string, unknown> | null;
    user: { id?: number | null; name: string; username: string; email: string };
    exam: {
      id: number;
      title: string;
      code: string;
      type: string;
      duration_minutes: number;
      course: { code: string; name: string } | null;
      organization: { code: string; name: string } | null;
    };
  };
  violations?: PublicViolationRow[];
  chain?: { ok: boolean; checked: number; broken_at?: number | null };
  recordingsEndpoint?: string;
}

export default function PublicViolationReport({
  expiredOrRevoked,
  reason,
  report,
  attempt,
  violations = [],
  chain,
  recordingsEndpoint,
}: PublicReportProps) {
  const [selId, setSelId] = useState<number>(() => violations[0]?.id ?? 0);

  const sel = useMemo(
    () => violations.find((v) => v.id === selId) ?? violations[0] ?? null,
    [violations, selId],
  );

  if (expiredOrRevoked || !report || !attempt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-900">
        <Head title="Biên bản vi phạm không khả dụng - Exam Guard" />
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <FileWarning className="size-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Biên bản không khả dụng hoặc đã gỡ xuất bản</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {reason ?? 'Đường dẫn chia sẻ biên bản vi phạm này đã hết hạn hoặc đã được giảng viên thu hồi.'}
          </p>
        </div>
      </div>
    );
  }

  const startMs = attempt.started_at ? new Date(attempt.started_at).getTime() : null;
  const endIso = attempt.submitted_at ?? violations.at(-1)?.timestamp ?? new Date().toISOString();
  const endMs = new Date(endIso).getTime();
  const spanMs = startMs ? Math.max(60_000, endMs - startMs) : 1;
  const pos = (iso: string | null) =>
    startMs && iso ? Math.min(100, Math.max(0, ((new Date(iso).getTime() - startMs) / spanMs) * 100)) : 0;

  const statusMeta = {
    no_violation: {
      label: 'Không vi phạm — Bảo lưu kết quả',
      tone: 'success' as const,
      icon: CheckCircle2,
      bannerCls: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    },
    warning: {
      label: `Cảnh cáo vi phạm (Trừ ${report.score_deduction_percent}% điểm)`,
      tone: 'warning' as const,
      icon: AlertTriangle,
      bannerCls: 'border-amber-300 bg-amber-50 text-amber-950',
    },
    suspended: {
      label: 'Đình chỉ thi — Hủy kết quả (0 điểm)',
      tone: 'danger' as const,
      icon: XCircle,
      bannerCls: 'border-rose-300 bg-rose-50 text-rose-950',
    },
  }[report.status];

  const StatusIcon = statusMeta.icon;
  const details = sel && sel.details && typeof sel.details === 'object' ? (sel.details as Record<string, unknown>) : null;
  const snippet = details ? String(details.content ?? details.snippet ?? details.pasted_text ?? '') : '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Head title={`Biên bản giám sát #${attempt.id} - ${attempt.user.name}`} />

      {/* Top Official Banner */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/mark.png" alt="Exam Guard" className="size-10 rounded-lg object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-blue-700 uppercase">
                  {attempt.exam.organization?.name ?? 'Hệ thống Giám sát Khảo thí Exam Guard'}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                  Mã biên bản: {report.slug}
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                BIÊN BẢN ĐIỆN TỬ GHI NHẬN KẾT QUẢ &amp; MINH CHỨNG GIÁM SÁT CA THI
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Printer className="size-3.5" />
              In biên bản / Xuất PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {/* Conclusion & Candidate Overview Card */}
        <div className={cn('rounded-xl border p-4 sm:p-5', statusMeta.bannerCls)}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <StatusIcon className="mt-0.5 size-6 shrink-0" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold">{statusMeta.label}</span>
                  <Pill tone={statusMeta.tone} size="sm">
                    Đã xác thực bởi {report.reporter_name}
                  </Pill>
                </div>
                {report.suspension_reason && (
                  <p className="mt-1.5 max-w-4xl text-sm leading-relaxed opacity-95">{report.suspension_reason}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-lg bg-white/80 px-4 py-2.5 text-right shadow-2xs">
              {report.original_score !== null && report.original_score !== report.final_score && (
                <div>
                  <div className="text-[11px] text-slate-500">Điểm gốc</div>
                  <div className="font-mono text-sm text-slate-500 line-through">{report.original_score.toFixed(2)}</div>
                </div>
              )}
              <div>
                <div className="text-[11px] font-medium text-slate-600">Điểm kết luận</div>
                <div className="font-mono text-xl font-bold text-slate-900">
                  {report.final_score !== null && report.final_score !== undefined ? report.final_score.toFixed(2) : '—'}
                </div>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <div className="text-[11px] font-medium text-slate-600">Vi phạm đính kèm</div>
                <div className="font-mono text-xl font-bold text-rose-600">{violations.length}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-3.5 text-xs sm:grid-cols-4">
            <div>
              <span className="text-slate-600">Thí sinh dự thi:</span>
              <div className="mt-0.5 font-semibold text-slate-900">
                {attempt.user.name} (<span className="font-mono">{attempt.user.username}</span>)
              </div>
            </div>
            <div>
              <span className="text-slate-600">Kỳ thi / Học phần:</span>
              <div className="mt-0.5 font-semibold text-slate-900">
                {attempt.exam.title} (<span className="font-mono">{attempt.exam.code}</span>)
              </div>
            </div>
            <div>
              <span className="text-slate-600">Thời gian làm bài:</span>
              <div className="mt-0.5 font-mono font-semibold text-slate-900">
                {hhmm(attempt.started_at)} → {attempt.submitted_at ? hhmm(attempt.submitted_at) : 'Đang diễn ra'}
              </div>
            </div>
            <div>
              <span className="text-slate-600">Toàn vẹn chuỗi băm SHA-256:</span>
              <div className="mt-0.5 flex items-center gap-1 font-mono font-semibold text-emerald-800">
                <UserCheck className="size-3.5" />
                {chain?.ok ? `Hợp lệ (${chain.checked} bản ghi)` : 'Đã kiểm tra nhật ký'}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Multi-Stream Video & Violation Timeline Section */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* Left/Main Column: Synchronized Video Player + Selected Violation Snapshot & Details */}
          <div className="flex flex-col gap-4 lg:col-span-8">
            <Panel className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Video className="size-4 text-primary" />
                  <span className="text-sm font-bold">
                    Trình phát đồng bộ đa luồng Video &amp; Hình ảnh minh chứng (Camera chính · Màn hình · Camera phụ)
                  </span>
                </div>
                {sel && (
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                    Đang xem mốc: {clockOffset(attempt.started_at, sel.timestamp)} — {sel.label ?? violationLabel(sel.type)}
                  </span>
                )}
              </div>

              <SessionMedia
                examId={attempt.exam.id}
                attemptId={attempt.id}
                at={sel?.timestamp ?? null}
                evidenceId={sel?.evidence_id ?? null}
                evidence={((sel?.details as { evidence?: Record<string, string> } | null)?.evidence) ?? null}
                clips={((sel?.details as { clips?: Record<string, string> } | null)?.clips) ?? null}
                clipRange={((sel?.details as { clip_range?: { from_ms: number; to_ms: number } } | null)?.clip_range) ?? null}
                publicEndpoint={recordingsEndpoint}
              />

              {/* Interactive Timeline Bar */}
              {violations.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Trục thời gian các thời điểm vi phạm ({violations.length} mốc)
                    </span>
                    <span className="text-muted-foreground">Bấm vào mốc bất kỳ để tua đồng bộ cả 3 luồng video tới thời điểm vi phạm</span>
                  </div>
                  <div className="relative mt-1 h-6 rounded bg-muted/70">
                    {violations.map((v) => {
                      const active = sel?.id === v.id;
                      const sev = severityOf(v.severity);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelId(v.id)}
                          title={`${clockOffset(attempt.started_at, v.timestamp)} — ${v.label ?? violationLabel(v.type)}`}
                          className={cn(
                            'absolute top-1 h-4 w-3 -translate-x-1/2 cursor-pointer rounded-xs transition',
                            active ? 'scale-125 ring-2 ring-slate-900 z-10' : 'opacity-85 hover:opacity-100',
                          )}
                          style={{
                            left: `${pos(v.timestamp)}%`,
                            background: TONE_VAR[sev.tone],
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </Panel>

            {/* Selected Violation Detailed Metadata */}
            {sel ? (
              <Panel className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Pill tone={severityOf(sel.severity).tone} size="sm" className="font-semibold">
                      {severityOf(sel.severity).label}
                    </Pill>
                    <h2 className="text-base font-bold text-foreground">{sel.label ?? violationLabel(sel.type)}</h2>
                  </div>
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    Thời điểm ghi nhận: {clockOffset(attempt.started_at, sel.timestamp)} ({hhmm(sel.timestamp)})
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-surface p-2.5">
                    <div className="text-[11px] text-muted-foreground">Mã quy tắc vi phạm</div>
                    <div className="mt-0.5 font-mono text-xs font-semibold">{sel.type}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-2.5">
                    <div className="text-[11px] text-muted-foreground">Mức độ cảnh báo</div>
                    <div className="mt-0.5 text-xs font-semibold">{severityOf(sel.severity).long}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-2.5">
                    <div className="text-[11px] text-muted-foreground">Trạng thái hậu kiểm</div>
                    <div className="mt-0.5 text-xs font-semibold text-emerald-700">Đã được Giảng viên xác nhận đính kèm</div>
                  </div>
                </div>

                {details && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {Object.entries(details)
                      .filter(([k, v]) => !['content', 'snippet', 'pasted_text', 'client_type', 'evidence', 'clips', 'clip_range'].includes(k) && (typeof v !== 'object' || v === null))
                      .map(([k, v]) => (
                        <div key={k} className="flex flex-col rounded border border-border/70 px-3 py-1.5">
                          <span className="text-[11px] text-muted-foreground">{detailLabel(k)}</span>
                          <span className="font-mono text-xs font-medium">{String(v)}</span>
                        </div>
                      ))}
                  </div>
                )}

                {snippet && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Nội dung văn bản/mã nguồn ghi nhận lúc vi phạm:</div>
                    <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/5 p-3 font-mono text-xs">
                      {snippet}
                    </pre>
                  </div>
                )}
              </Panel>
            ) : (
              <Panel className="p-8 text-center">
                <ShieldCheck className="mx-auto mb-2 size-8 text-emerald-600" />
                <div className="text-sm font-bold">Biên bản không đính kèm sự kiện vi phạm</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Giảng viên đã xác nhận phiên thi hợp lệ và không đính kèm vi phạm nào.
                </div>
              </Panel>
            )}
          </div>

          {/* Right Column: List of Attached Violations to Jump Between */}
          <div className="lg:col-span-4">
            <Panel padded={false} className="flex max-h-[780px] flex-col overflow-hidden">
              <div className="border-b border-border bg-surface px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Danh mục vi phạm trong biên bản ({violations.length})</span>
                  <span className="text-[11px] text-muted-foreground">Bấm để xem video</span>
                </div>
              </div>

              <div className="divide-y divide-border overflow-y-auto">
                {violations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Không có sự kiện vi phạm nào trong biên bản này.
                  </div>
                ) : (
                  violations.map((v, idx) => {
                    const active = sel?.id === v.id;
                    const sev = severityOf(v.severity);
                    const vDet = v.details && typeof v.details === 'object' ? (v.details as Record<string, unknown>) : null;
                    const hasShots = !!(v.evidence_id || (vDet && vDet.evidence));
                    const hasClips = !!(vDet && vDet.clips);

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelId(v.id)}
                        className={cn(
                          'flex w-full cursor-pointer flex-col gap-1.5 px-4 py-3 text-left transition',
                          active ? 'bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-surface',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                          <Pill tone={sev.tone} size="sm" className="font-semibold">
                            {sev.label}
                          </Pill>
                          <span className="flex-1 truncate text-xs font-bold text-foreground">
                            {v.label ?? violationLabel(v.type)}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                            {clockOffset(attempt.started_at, v.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="truncate">{violationDetail(v.details) || v.type}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            {hasShots && (
                              <span className="rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-info-fg">
                                Ảnh 3 góc
                              </span>
                            )}
                            {hasClips && (
                              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                Video clip
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
