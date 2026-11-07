import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Ban, BarChart3, Check, CircleCheck, Code, Copy, ExternalLink, FileCheck2, Globe, Link2Off, RotateCcw, Share2, ShieldAlert, ShieldCheck, Trash2, Undo2, UserCheck, X } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FxButton, Modal, PageHeader, Panel, Pill } from '@/components/foxy/ui';
import {
  ATTEMPT_STATUS,
  clockOffset,
  hhmm,
  initials,
  reviewStatus,
  severityOf,
  TONE_VAR,
  violationDetail,
  detailLabel,
  NEEDS_REVIEW,
  violationLabel,
} from '@/components/foxy/domain';
import { SessionMedia } from '@/components/foxy/session-media';
import { AttemptTools } from '@/components/foxy/attempt-tools';
import { useLiveRoom } from '@/hooks/use-live-room';
import { useMore } from '@/hooks/use-more';
import { useDialog } from '@/components/foxy/dialogs';
import { cn } from '@/lib/utils';

export interface AttemptPayload {
  id: number;
  attempt_number: number;
  status: string;
  score: number | null;
  risk_score: number;
  is_flagged: boolean;
  voided_at: string | null;
  void_reason: string | null;
  started_at: string | null;
  submitted_at: string | null;
  device_info: Record<string, unknown> | null;
  pending_grading?: number;
  shared_device_with?: { attempt_id: number; name: string | null; username: string | null }[];
  user: {
    id?: number | null;
    name: string;
    username: string;
    email?: string | null;
    has_face_photo?: boolean;
    total_attempts?: number;
    total_violations?: number;
    enrolled_courses?: { id: number; code: string; name: string }[];
  };
  exam: { id: number; title: string; code: string; type: string; duration_minutes: number; monitoring_config?: { ai_face_check?: boolean; require_screen?: boolean; extra_camera?: string } | null };
}

interface ViolationRow {
  id: number;
  type: string;
  severity: string;
  details: unknown;
  evidence_url: string | null;
  evidence_id: string | null;
  is_reviewed: boolean;
  is_false_positive: boolean;
  timestamp: string | null;
}

interface ViolationReportPayload {
  id: number;
  slug: string;
  public_url: string;
  is_published: boolean;
  status: 'no_violation' | 'warning' | 'suspended';
  suspension_reason: string | null;
  score_deduction_percent: number;
  original_score: number | null;
  attached_violation_ids: number[];
  link_expires_at: string | null;
  sent_at: string | null;
  updated_at: string | null;
}

interface Props {
  user: any;
  teams: TeamItem[];
  attempt: AttemptPayload;
  violations: ViolationRow[];
  typing: { t: string | null; keys: number; pastes: number; clicks?: number; cpu?: number | null; ram?: number | null }[];
  submissions: { id: number; status: string; t: string | null }[];
  violationReport?: ViolationReportPayload | null;
  reportReasonTemplates?: Record<string, string>;
}

const BINS = 72;

interface Group {
  key: number;
  head: ViolationRow;
  rows: ViolationRow[];
  last: ViolationRow;
}

/** Consecutive violations of one type collapse into a single entry until a different type shows up. */
function groupViolations(list: ViolationRow[]): Group[] {
  const out: Group[] = [];
  for (const v of list) {
    const g = out.at(-1);
    if (g && g.head.type === v.type) {
      g.rows.push(v);
      g.last = v;
    } else {
      out.push({ key: v.id, head: v, rows: [v], last: v });
    }
  }
  return out;
}

function DevicePanel({ info, shared }: { info: Record<string, unknown> | null; shared: NonNullable<AttemptPayload['shared_device_with']> }) {
  if (!info) return null;
  const rows: [string, unknown][] = [
    ['Tên máy', info.hostname],
    ['Hệ điều hành', info.os],
    ['CPU', info.cpu_model ? `${info.cpu_model}${info.cores ? ` · ${info.cores} luồng` : ''}` : null],
    ['RAM', info.ram_total_mb ? `${Math.round(Number(info.ram_total_mb) / 1024)} GB` : null],
    ['Màn hình', info.screen],
    ['Địa chỉ IP', info.ip],
    ['Mã thiết bị', info.fingerprint ? String(info.fingerprint).slice(0, 12) : null],
  ];
  const shown = rows.filter(([, v]) => v);
  if (shown.length === 0 && shared.length === 0) return null;
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <span className="font-semibold">Thiết bị thí sinh</span>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {shown.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="break-words font-mono text-[13px]">{String(v)}</span>
          </div>
        ))}
      </div>
      {shared.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-[13px]">
          Cùng một máy với {shared.map((s) => `${s.name ?? s.username} (${s.username})`).join(', ')} trong kỳ thi này.
        </div>
      )}
    </Panel>
  );
}

export function deviceLabel(d: Record<string, unknown> | null) {
  if (!d) return '';
  const app = d.client_version || d.app_version || d.version;
  const os = d.os || d.platform;
  return [app && `FoxyClient ${app}`, os && `(${os})`].filter(Boolean).join(' ');
}

export default function AttemptShow({ user, teams, attempt, violations, typing, submissions, violationReport, reportReasonTemplates }: Props) {
  const initialId = useMemo(() => {
    // nothing is opened by default: the detail (and its pictures) shows only for a violation the reviewer picks
    const q = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('violation')) : 0;
    return violations.some((v) => v.id === q) ? q : 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dialog = useDialog();
  const groups = useMemo(() => groupViolations(violations), [violations]);
  const [selId, setSelId] = useState(initialId);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(violationReport?.attached_violation_ids?.length ? violationReport.attached_violation_ids : []),
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<'no_violation' | 'warning' | 'suspended'>(
    violationReport?.status ?? (violations.some((v) => !v.is_false_positive && v.severity === 'CRITICAL') ? 'suspended' : violations.some((v) => !v.is_false_positive) ? 'warning' : 'no_violation'),
  );
  const [reportDeduction, setReportDeduction] = useState<number>(violationReport?.score_deduction_percent ?? 25);
  const [reportReason, setReportReason] = useState<string>(
    violationReport?.suspension_reason ?? reportReasonTemplates?.[reportStatus] ?? '',
  );
  const [reportExpiresDays, setReportExpiresDays] = useState<number>(30);
  const [reportNotifyStudent, setReportNotifyStudent] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const selGroup = groups.find((g) => g.rows.some((v) => v.id === selId));
  const sel = selGroup?.head;

  // live: the hub reports every change of this attempt (status, new violation, evidence or clip arriving, chat), so the page
  // refreshes its data from the server only when something happened instead of polling
  const running = attempt.status === 'IN_PROGRESS';
  const room = useLiveRoom(attempt.exam.id, running);
  const row = room.rows[attempt.id];
  const signature = row ? `${row.status}:${row.violations}:${row.ev_seq ?? 0}` : '';
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (!signature || signature === lastSignature.current) {
      lastSignature.current = signature || lastSignature.current;
      return;
    }
    lastSignature.current = signature;
    router.reload({ only: ['attempt', 'violations', 'typing', 'submissions'] });
  }, [signature]);
  const voided = attempt.voided_at !== null;
  const more = useMore(groups.length, 40);

  const start = attempt.started_at ? new Date(attempt.started_at).getTime() : null;
  const endIso =
    attempt.submitted_at ??
    [typing.at(-1)?.t, violations.at(-1)?.timestamp, submissions.at(-1)?.t].filter(Boolean).sort().at(-1) ??
    new Date().toISOString();
  const end = new Date(endIso as string).getTime();
  const span = start ? Math.max(60_000, end - start) : 1;
  const pos = (iso: string | null) => (start && iso ? Math.min(100, Math.max(0, ((new Date(iso).getTime() - start) / span) * 100)) : 0);

  const bins = useMemo(() => {
    const b = Array.from({ length: BINS }, () => ({ keys: 0, pastes: 0, clicks: 0, cpuSum: 0, ramSum: 0, perfCount: 0 }));
    if (!start) return b;
    typing.forEach((l) => {
      if (!l.t) return;
      const i = Math.min(BINS - 1, Math.max(0, Math.floor(((new Date(l.t).getTime() - start) / span) * BINS)));
      b[i].keys += l.keys;
      b[i].pastes += l.pastes;
      b[i].clicks += l.clicks ?? 0;
      if (typeof l.cpu === 'number' || typeof l.ram === 'number') {
        b[i].cpuSum += l.cpu ?? 0;
        b[i].ramSum += l.ram ?? 0;
        b[i].perfCount += 1;
      }
    });
    return b;
  }, [typing, start, span]);
  const maxKeys = Math.max(1, ...bins.map((b) => b.keys));
  const maxClicks = Math.max(1, ...bins.map((b) => b.clicks));
  const hasClicks = bins.some((b) => b.clicks > 0);
  const hasPerf = bins.some((b) => b.perfCount > 0);

  const ticks = start ? Array.from({ length: 5 }, (_, i) => hhmm(new Date(start + (span * i) / 4).toISOString())) : [];
  const counts = { high: 0, medium: 0, low: 0 };
  violations.forEach((v) => {
    const s = severityOf(v.severity).tone;
    if (s === 'danger') counts.high++;
    else if (s === 'warning') counts.medium++;
    else counts.low++;
  });
  const pendingCount = violations.filter((v) => reviewStatus(v).key === 'pending').length;

  const decide = (decision: 'confirmed' | 'false_positive' | 'pending') => {
    if (!sel) return;
    setBusy(true);
    const idx = groups.indexOf(selGroup!);
    review(
      selGroup!.rows.map((v) => v.id),
      decision,
      () => decision !== 'pending' && groups[idx + 1] && setSelId(groups[idx + 1].head.id),
    );
  };

  const review = (ids: number[], decision: 'confirmed' | 'false_positive' | 'pending', after?: () => void) => {
    setBusy(true);
    router.post('/admin/violations/bulk-review', { ids, decision }, {
      preserveScroll: true,
      only: ['violations'],
      onSuccess: () => {
        setChecked(new Set());
        after?.();
      },
      onFinish: () => setBusy(false),
    });
  };

  const toggle = (g: Group) =>
    setChecked((prev) => {
      const next = new Set(prev);
      const all = g.rows.every((v) => next.has(v.id));
      g.rows.forEach((v) => (all ? next.delete(v.id) : next.add(v.id)));
      return next;
    });
  const allChecked = violations.length > 0 && checked.size === violations.length;

  const toggleVoid = async () => {
    const ok = await dialog.confirm({
      title: voided ? 'Khôi phục phiên thi?' : 'Hủy phiên thi này?',
      text: voided
        ? 'Phiên thi được tính lại vào điểm trung bình và số vi phạm.'
        : 'Phiên thi được giữ lại nhưng không tính vào điểm trung bình và bộ đếm vi phạm. Đang làm bài sẽ bị dừng.',
      tone: voided ? 'default' : 'danger',
      confirmLabel: voided ? 'Khôi phục' : 'Hủy phiên thi',
    });
    if (ok) router.post(`/admin/attempts/${attempt.id}/void`, { void: !voided }, { preserveScroll: true });
  };

  const openPublishModal = () => {
    // If lecturer hasn't ticked any violation yet, pre-tick existing report's violations or all non-false-positive violations
    if (checked.size === 0 && violations.length > 0) {
      if (violationReport?.attached_violation_ids?.length) {
        setChecked(new Set(violationReport.attached_violation_ids));
      } else {
        setChecked(new Set(violations.filter((v) => !v.is_false_positive).map((v) => v.id)));
      }
    }
    if (!reportReason && reportReasonTemplates?.[reportStatus]) {
      setReportReason(reportReasonTemplates[reportStatus]);
    }
    setPublishOpen(true);
  };

  const changeReportStatus = (next: 'no_violation' | 'warning' | 'suspended') => {
    setReportStatus(next);
    if (reportReasonTemplates?.[next]) {
      setReportReason(reportReasonTemplates[next]);
    }
    if (next === 'no_violation') setChecked(new Set());
    else if (checked.size === 0) setChecked(new Set(violations.filter((v) => !v.is_false_positive).map((v) => v.id)));
  };

  const submitPublishReport = () => {
    setBusy(true);
    router.post(
      `/admin/attempts/${attempt.id}/violation-report`,
      {
        status: reportStatus,
        suspension_reason: reportReason,
        score_deduction_percent: reportStatus === 'warning' ? reportDeduction : reportStatus === 'suspended' ? 100 : 0,
        attached_violation_ids: [...checked],
        link_expires_days: reportExpiresDays,
        notify_student: reportNotifyStudent,
      },
      {
        preserveScroll: true,
        onSuccess: () => setPublishOpen(false),
        onFinish: () => setBusy(false),
      },
    );
  };

  const handleUnpublishReport = async () => {
    const ok = await dialog.confirm({
      title: 'Gỡ xuất bản biên bản vi phạm?',
      text: 'Đường dẫn chia sẻ công khai sẽ bị vô hiệu hóa ngay lập tức và điểm bài thi gốc của thí sinh sẽ được khôi phục.',
      tone: 'danger',
      confirmLabel: 'Gỡ xuất bản & thu hồi link',
    });
    if (!ok) return;
    setBusy(true);
    router.post(
      `/admin/attempts/${attempt.id}/violation-report/unpublish`,
      {},
      {
        preserveScroll: true,
        onFinish: () => setBusy(false),
      },
    );
  };

  const copyShareLink = () => {
    if (!violationReport?.public_url) return;
    void navigator.clipboard.writeText(violationReport.public_url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const st = ATTEMPT_STATUS[attempt.status] ?? { label: attempt.status, tone: 'neutral' as const };
  const isCode = attempt.exam.type !== 'QUIZ';
  const details = sel && sel.details && typeof sel.details === 'object' ? (sel.details as Record<string, unknown>) : null;
  const snippet = details ? String(details.content ?? details.snippet ?? details.pasted_text ?? '') : '';

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="live"
      title={attempt.user.name}
      breadcrumbs={[
        { label: 'Giám sát kỳ thi', href: `/admin/reports/${attempt.exam.id}` },
        { label: 'Phiên thi & vi phạm' },
      ]}
    >
      <PageHeader
        onBack={() => router.visit(`/admin/reports/${attempt.exam.id}`)}
        leading={<div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">{initials(attempt.user.name)}</div>}
        title={attempt.user.name}
        badges={
          <>
            <Pill tone={st.tone}>
              {attempt.status === 'SUBMITTED' && <CircleCheck className="size-3" />}
              {st.label}
            </Pill>
            {voided && <Pill tone="danger">Đã hủy</Pill>}
          </>
        }
        desc={
          <>
            <span className="font-mono">{attempt.user.username}</span> · {attempt.exam.title} · {hhmm(attempt.started_at)} →{' '}
            {attempt.submitted_at ? hhmm(attempt.submitted_at) : 'đang làm'}
            {deviceLabel(attempt.device_info) && ` · ${deviceLabel(attempt.device_info)}`}
          </>
        }
        actions={
          <>
            <FxButton icon={UserCheck} onClick={() => setProfileOpen(true)}>
              Hồ sơ thí sinh
            </FxButton>
            <FxButton icon={BarChart3} onClick={() => setMetricsOpen(true)}>
              Thống kê TP/FP
            </FxButton>
            <FxButton variant={voided ? undefined : 'danger'} icon={voided ? Undo2 : Ban} onClick={toggleVoid}>
              {voided ? 'Khôi phục phiên' : 'Hủy phiên thi'}
            </FxButton>
            <FxButton
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                const ok = await dialog.confirm({
                  title: 'Xóa vĩnh viễn phiên thi này?',
                  text: 'Toàn bộ lịch sử vi phạm, nhật ký gõ phím (Op-Log) và bài nộp của phiên thi này sẽ bị xóa vĩnh viễn và không thể khôi phục.',
                  tone: 'danger',
                  confirmLabel: 'Xóa vĩnh viễn',
                });
                if (ok) router.post(`/admin/attempts/${attempt.id}/delete`);
              }}
            >
              Xóa phiên
            </FxButton>
            {(attempt.pending_grading ?? 0) > 0 && (
              <FxButton variant="primary" onClick={() => router.visit(`/admin/attempts/${attempt.id}/grading`)}>
                Chấm bài ({attempt.pending_grading})
              </FxButton>
            )}
            {isCode && (
              <FxButton variant="primary" icon={Code} onClick={() => router.visit(`/admin/attempts/${attempt.id}/submissions`)}>
                Xem bài làm
              </FxButton>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
          <SessionMedia
            examId={attempt.exam.id}
            attemptId={attempt.id}
            studentId={attempt.user.id}
            hasFacePhoto={attempt.user.has_face_photo}
            running={running}
            at={sel?.timestamp ?? null}
            evidenceId={sel?.evidence_id ?? null}
            evidence={((sel?.details as { evidence?: Record<string, string> } | null)?.evidence) ?? null}
            snapshots={((sel?.details as { snapshots?: Record<string, string> } | null)?.snapshots) ?? null}
            clips={((sel?.details as { clips?: Record<string, string> } | null)?.clips) ?? null}
            clipRange={((sel?.details as { clip_range?: { from_ms: number; to_ms: number } } | null)?.clip_range) ?? null}
            config={attempt.exam.monitoring_config}
            refreshKey={`${signature}:${violations.length}`}
          />

          <DevicePanel info={attempt.device_info} shared={attempt.shared_device_with ?? []} />

          <AttemptTools attemptId={attempt.id} running={running} chatSeq={row?.chat_seq} deviceInfo={attempt.device_info} />

          <Panel className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[13px]">
                {sel ? clockOffset(attempt.started_at, sel.timestamp) : '--:--:--'}{' '}
                <span className="text-muted-foreground">/ {clockOffset(attempt.started_at, endIso as string)}</span>
              </span>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">Nhấn vào mốc để nhảy tới vi phạm</span>
            </div>
            <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              {typing.length > 0 && <span>Gõ phím</span>}
              {typing.length > 0 && <div className="flex h-[22px] items-end gap-px">
                {bins.map((b, i) => (
                  <span
                    key={i}
                    title={`${b.keys} phím${b.pastes ? ` · ${b.pastes} lần dán` : ''}`}
                    className={cn('flex-1 rounded-[1px]', b.pastes ? 'bg-danger' : 'bg-primary/55')}
                    style={{ height: `${Math.max(b.keys ? 8 : 4, (b.keys / maxKeys) * 100)}%`, opacity: b.keys || b.pastes ? 1 : 0.35 }}
                  />
                ))}
              </div>}
              {hasClicks && <span>Nhấp chuột</span>}
              {hasClicks && <div className="flex h-[18px] items-end gap-px">
                {bins.map((b, i) => (
                  <span
                    key={i}
                    title={`${b.clicks} lượt nhấp chuột`}
                    className="flex-1 rounded-[1px] bg-info/65"
                    style={{ height: `${Math.max(b.clicks ? 10 : 4, (b.clicks / maxClicks) * 100)}%`, opacity: b.clicks ? 1 : 0.25 }}
                  />
                ))}
              </div>}
              {hasPerf && <span>CPU / RAM</span>}
              {hasPerf && <div className="flex h-[24px] items-end gap-px">
                {bins.map((b, i) => {
                  const cpu = b.perfCount ? Math.round(b.cpuSum / b.perfCount) : 0;
                  const ram = b.perfCount ? Math.round(b.ramSum / b.perfCount) : 0;
                  const peak = Math.max(cpu, ram);
                  return (
                    <span
                      key={i}
                      title={b.perfCount ? `CPU: ${cpu}% · RAM: ${ram}%` : 'Không có mẫu'}
                      className={cn('flex-1 rounded-[1px]', cpu > 85 || ram > 90 ? 'bg-warning' : 'bg-success/65')}
                      style={{ height: `${Math.max(b.perfCount ? 10 : 4, Math.min(100, peak))}%`, opacity: b.perfCount ? 1 : 0.25 }}
                    />
                  );
                })}
              </div>}
              <span>Vi phạm</span>
              <div className="relative h-[22px] rounded bg-surface">
                {groups.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    title={`${violationLabel(g.head.type)}${g.rows.length > 1 ? ` ×${g.rows.length}` : ''}`}
                    onClick={() => setSelId(g.head.id)}
                    className={cn('absolute top-[3px] h-4 w-2.5 cursor-pointer rounded-[3px] p-0', g.key === selGroup?.key && 'ring-2 ring-foreground')}
                    style={{ left: `calc(${pos(g.head.timestamp)}% - 5px)`, background: TONE_VAR[severityOf(g.head.severity).tone] }}
                  />
                ))}
                {sel && <span className="absolute -bottom-1 -top-1 w-0.5 rounded bg-foreground" style={{ left: `${pos(sel.timestamp)}%` }} />}
              </div>
              {submissions.length > 0 && <span>Nộp bài</span>}
              {submissions.length > 0 && <div className="relative h-3.5">
                {submissions.map((s) => (
                  <span
                    key={s.id}
                    title={s.status}
                    className={cn('absolute top-0.5 size-2.5 rotate-45', s.status === 'ACCEPTED' ? 'bg-success' : 'bg-warning')}
                    style={{ left: `calc(${pos(s.t)}% - 5px)` }}
                  />
                ))}
              </div>}
            </div>
            {ticks.length > 0 && (
              <div className="flex justify-between pl-[84px] font-mono text-[11px] text-muted-foreground/70">
                {ticks.map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>
            )}
          </Panel>

          {sel ? (
            <Panel padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
                <Pill tone={severityOf(sel.severity).tone} size="sm" className="font-semibold">
                  {severityOf(sel.severity).label}
                </Pill>
                <span className="flex-1 text-[15px] font-semibold">
                  {violationLabel(sel.type)}
                  {selGroup!.rows.length > 1 && (
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                      ×{selGroup.rows.length} · {clockOffset(attempt.started_at, sel.timestamp)} → {clockOffset(attempt.started_at, selGroup!.last.timestamp)}
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{sel.type}</span>
                <button type="button" onClick={() => setSelId(0)} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Đóng chi tiết" aria-label="Đóng chi tiết">
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex flex-col gap-3.5 p-4">
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
                  {[
                    ['Thời điểm', clockOffset(attempt.started_at, sel.timestamp)],
                    ['Mức độ', severityOf(sel.severity).long],
                    ['Nguồn', NEEDS_REVIEW.includes(sel.type) ? 'AI / ước lượng — cần duyệt' : 'Client ghi nhận trực tiếp'],
                    ...Object.entries(details ?? {})
                      .filter(([k, v]) => !['content', 'snippet', 'pasted_text', 'client_type'].includes(k) && (typeof v !== 'object' || v === null))
                      .map(([k, v]) => [detailLabel(k), String(v)]),
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="break-words font-mono text-sm font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                {details && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">Dữ liệu thô</summary>
                    <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg border border-border bg-surface p-2.5 font-mono text-[11px]">{JSON.stringify(details, null, 2)}</pre>
                  </details>
                )}
                {!details && violationDetail(sel.details) && <div className="text-sm text-muted-foreground">{violationDetail(sel.details)}</div>}
                {snippet && (
                  <div>
                    <div className="mb-1.5 text-xs text-muted-foreground">Nội dung được dán</div>
                    <pre className="m-0 whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/8 p-3 font-mono text-xs leading-relaxed">{String(snippet)}</pre>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={reviewStatus(sel).tone}>{reviewStatus(sel).label}</Pill>
                  <div className="flex-1" />
                  {reviewStatus(sel).key !== 'pending' && (
                    <FxButton icon={RotateCcw} disabled={busy} onClick={() => decide('pending')}>
                      Đặt lại
                    </FxButton>
                  )}
                  <FxButton icon={ShieldCheck} disabled={busy} onClick={() => decide('false_positive')}>
                    Đánh dấu nhầm
                  </FxButton>
                  <FxButton variant="danger" icon={ShieldAlert} disabled={busy} onClick={() => decide('confirmed')}>
                    Xác nhận vi phạm
                  </FxButton>
                </div>
              </div>
            </Panel>
          ) : violations.length > 0 ? (
            <Panel>
              <EmptyState icon={ShieldAlert} title="Chọn một vi phạm để xem chi tiết" desc="Bấm vào vi phạm ở danh sách bên phải hoặc mốc trên dòng thời gian: ảnh minh chứng, clip và thao tác duyệt sẽ hiện ở đây." />
            </Panel>
          ) : (
            <Panel>
              <EmptyState icon={ShieldCheck} title="Phiên thi sạch" desc="Không ghi nhận vi phạm nào trong lượt làm bài này." />
            </Panel>
          )}
        </div>

        <Panel padded={false} className="sticky top-20 flex max-h-[calc(100vh-6rem)] min-w-0 flex-[1_1_320px] flex-col overflow-hidden">
          <div className="flex shrink-0 flex-col gap-2.5 border-b border-border px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Vi phạm ({violations.length}
                {groups.length !== violations.length ? ` · ${groups.length} nhóm` : ''})
              </span>
              <span className="text-xs text-muted-foreground">{pendingCount} chờ duyệt</span>
            </div>
            <div className="flex gap-1.5">
              {[
                { n: counts.high, label: 'Cao', cls: 'bg-danger/12 text-danger-fg' },
                { n: counts.medium, label: 'Trung bình', cls: 'bg-warning/12 text-warning-fg' },
                { n: counts.low, label: 'Thấp', cls: 'bg-info/12 text-info-fg' },
              ].map((c) => (
                <span key={c.label} className={cn('flex-1 rounded-lg p-2 text-center', c.cls)}>
                  <div className="text-lg font-bold">{c.n}</div>
                  <div className="text-[11px] text-muted-foreground">{c.label}</div>
                </span>
              ))}
            </div>
            {violations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(violations.map((v) => v.id)))}
                    className="size-3.5 accent-[var(--primary)]"
                  />
                  {checked.size > 0 ? `Đã chọn ${checked.size}` : 'Chọn tất cả'}
                </label>
                <div className="flex-1" />
                <FxButton icon={ShieldCheck} disabled={busy || checked.size === 0} onClick={() => review([...checked], 'false_positive')}>
                  Nhầm
                </FxButton>
                <FxButton variant="danger" icon={ShieldAlert} disabled={busy || checked.size === 0} onClick={() => review([...checked], 'confirmed')}>
                  Xác nhận
                </FxButton>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Globe className="size-3.5 text-primary" />
                  Biên bản vi phạm (Link chia sẻ)
                </span>
                {violationReport?.is_published ? (
                  <Pill tone="success" size="sm">
                    Đã xuất bản ({violationReport.attached_violation_ids.length} vi phạm)
                  </Pill>
                ) : violationReport ? (
                  <Pill tone="neutral" size="sm">
                    Đã gỡ xuất bản
                  </Pill>
                ) : (
                  <Pill tone="info" size="sm">
                    Chưa xuất bản
                  </Pill>
                )}
              </div>

              {violationReport?.is_published ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[11px]">
                    <span className="flex-1 truncate font-mono text-muted-foreground">{violationReport.public_url}</span>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground hover:bg-muted/80"
                      title="Sao chép đường dẫn biên bản công khai"
                    >
                      {copiedLink ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                      {copiedLink ? 'Đã chép' : 'Sao chép'}
                    </button>
                    <a
                      href={violationReport.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 rounded bg-primary px-1.5 py-0.5 font-medium text-primary-foreground hover:opacity-90"
                      title="Mở trang web biên bản vi phạm"
                    >
                      <ExternalLink className="size-3" />
                      Mở web
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FxButton size="sm" icon={FileCheck2} disabled={busy} onClick={openPublishModal}>
                      Cập nhật ({checked.size} đã chọn)
                    </FxButton>
                    <FxButton size="sm" variant="danger" icon={Link2Off} disabled={busy} onClick={handleUnpublishReport}>
                      Gỡ xuất bản
                    </FxButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Tick chọn các vi phạm bên dưới rồi bấm Xuất bản để tạo trang web biên bản kèm video đồng bộ.
                  </span>
                  <FxButton size="sm" variant="primary" icon={Share2} disabled={busy} onClick={openPublishModal}>
                    Xuất bản ({checked.size > 0 ? checked.size : violations.filter((v) => !v.is_false_positive).length})
                  </FxButton>
                </div>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {groups.slice(0, more.count).map((g) => {
              const v = g.head;
              const sev = severityOf(v.severity);
              const reviewed = g.rows.every((x) => x.is_reviewed);
              const rs = reviewStatus({ ...v, is_reviewed: reviewed, is_false_positive: reviewed && g.rows.every((x) => x.is_false_positive) });
              const on = g.key === selGroup?.key;
              const all = g.rows.every((x) => checked.has(x.id));
              return (
                <div key={g.key} className={cn('flex border-b border-border last:border-b-0', on ? 'bg-muted/60 shadow-[inset_2px_0_0_var(--primary)]' : 'hover:bg-surface')}>
                  <label className="flex shrink-0 cursor-pointer items-start py-3.5 pl-4">
                    <input type="checkbox" checked={all} onChange={() => toggle(g)} className="size-3.5 accent-[var(--primary)]" />
                  </label>
                  <button type="button" onClick={() => setSelId(v.id)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 px-3 py-3 text-left">
                    <div className="flex items-center gap-2">
                      <Pill tone={sev.tone} size="sm" className="font-semibold">
                        {sev.label}
                      </Pill>
                      <span className="flex-1 truncate text-[13px] font-medium">
                        {violationLabel(v.type)}
                        {g.rows.length > 1 && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">×{g.rows.length}</span>}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {clockOffset(attempt.started_at, v.timestamp)}
                        {g.rows.length > 1 && `–${clockOffset(attempt.started_at, g.last.timestamp).slice(3)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-0.5">
                      <span className="flex-1 truncate text-xs text-muted-foreground">{violationDetail(v.details) || v.type}</span>
                      <Pill tone={rs.tone} size="sm">
                        {rs.label}
                      </Pill>
                    </div>
                  </button>
                </div>
              );
            })}
            {more.hasMore && (
              <div ref={more.sentinel} className="py-3 text-center text-xs text-muted-foreground">
                Đang tải thêm…
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        width={620}
        title={violationReport?.is_published ? 'Cập nhật Biên bản Vi phạm (Link chia sẻ)' : 'Xuất bản Biên bản Vi phạm (Tạo link chia sẻ web)'}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
            Biên bản sau khi xuất bản sẽ tạo một trang web công khai (có thể gửi cho thí sinh hoặc Hội đồng thi) hiển thị tổng thể{' '}
            <strong className="text-foreground">các vi phạm đã được giảng viên tick chọn</strong> cùng trình phát đồng bộ đa luồng video (Camera chính, Màn hình, Camera phụ) tại từng thời điểm vi phạm. Bạn có thể gỡ xuất bản bất kỳ lúc nào.
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">1. Kết luận xử lý phiên thi</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'no_violation' as const, label: 'Không vi phạm', sub: 'Bảo lưu 100% điểm', tone: 'border-success/40 bg-success/10 text-success-fg' },
                { key: 'warning' as const, label: 'Cảnh cáo vi phạm', sub: `Trừ ${reportDeduction}% điểm bài thi`, tone: 'border-warning/40 bg-warning/10 text-warning-fg' },
                { key: 'suspended' as const, label: 'Đình chỉ thi', sub: 'Hủy kết quả (0 điểm)', tone: 'border-danger/40 bg-danger/10 text-danger-fg' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => changeReportStatus(opt.key)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition',
                    reportStatus === opt.key ? `${opt.tone} ring-2 ring-primary` : 'border-border bg-card hover:bg-surface',
                  )}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[11px] opacity-80">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {reportStatus === 'warning' && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <label className="text-xs font-semibold text-foreground">Tỷ lệ trừ điểm cảnh cáo (%):</label>
              <div className="flex items-center gap-1.5">
                {[10, 25, 50, 75].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setReportDeduction(pct)}
                    className={cn(
                      'rounded px-2 py-1 text-xs font-semibold',
                      reportDeduction === pct ? 'bg-warning text-white' : 'border border-border bg-card hover:bg-muted',
                    )}
                  >
                    -{pct}%
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={reportDeduction}
                  onChange={(e) => setReportDeduction(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="h-7 w-16 rounded border border-border bg-card px-2 text-center font-mono text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                2. Danh sách vi phạm đính kèm vào biên bản ({checked.size} / {violations.length} sự kiện đã tick)
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setChecked(new Set(violations.filter((v) => !v.is_false_positive).map((v) => v.id)))}
                  className=" font-medium text-primary hover:underline"
                >
                  Chọn mọi vi phạm hợp lệ
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setChecked(new Set(violations.filter((v) => v.is_reviewed && !v.is_false_positive).map((v) => v.id)))}
                  className="font-medium text-primary hover:underline"
                >
                  Chỉ vi phạm đã xác nhận
                </button>
                <span className="text-muted-foreground">·</span>
                <button type="button" onClick={() => setChecked(new Set())} className="text-muted-foreground hover:underline">
                  Bỏ chọn hết
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-surface p-2">
              {violations.length === 0 ? (
                <div className="py-3 text-center text-xs text-muted-foreground">Phiên thi không có sự kiện vi phạm nào.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {violations.map((v) => {
                    const isTicked = checked.has(v.id);
                    const sev = severityOf(v.severity);
                    return (
                      <label
                        key={v.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs',
                          isTicked ? 'bg-primary/10 font-medium' : 'hover:bg-muted/60',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() =>
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(v.id)) next.delete(v.id);
                              else next.add(v.id);
                              return next;
                            })
                          }
                          className="size-3.5 accent-[var(--primary)]"
                        />
                        <Pill tone={sev.tone} size="sm">
                          {sev.label}
                        </Pill>
                        <span className="flex-1 truncate">{violationLabel(v.type)}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{clockOffset(attempt.started_at, v.timestamp)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">3. Lý do &amp; Kết luận của Giảng viên / Hội đồng thi</label>
            <textarea
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Nhập kết luận xử lý và nhận xét chuyên môn…"
              className="w-full rounded-lg border border-border bg-card p-2.5 text-xs leading-relaxed focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={reportNotifyStudent}
                onChange={(e) => setReportNotifyStudent(e.target.checked)}
                className="size-3.5 accent-[var(--primary)]"
              />
              <span>Gửi thông báo kèm đường dẫn biên bản cho thí sinh</span>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Thời hạn link:</span>
              <select
                value={reportExpiresDays}
                onChange={(e) => setReportExpiresDays(Number(e.target.value))}
                className="h-7 rounded border border-border bg-card px-2 text-xs"
              >
                <option value={7}>7 ngày</option>
                <option value={30}>30 ngày</option>
                <option value={90}>90 ngày</option>
                <option value={365}>1 năm</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {violationReport?.is_published && (
              <FxButton variant="danger" icon={Link2Off} disabled={busy} onClick={handleUnpublishReport}>
                Gỡ xuất bản
              </FxButton>
            )}
            <FxButton onClick={() => setPublishOpen(false)} disabled={busy}>
              Đóng
            </FxButton>
            <FxButton variant="primary" icon={Globe} disabled={busy} onClick={submitPublishReport}>
              {violationReport?.is_published ? 'Cập nhật biên bản' : 'Xuất bản & Tạo link chia sẻ'}
            </FxButton>
          </div>
        </div>
      </Modal>

      <Modal open={metricsOpen} onClose={() => setMetricsOpen(false)} width={680} title={`Báo cáo Thống kê Giám sát & Độ chính xác AI — ${attempt.user.name}`}>
        {(() => {
          const tp = violations.filter((v) => v.is_reviewed && !v.is_false_positive).length;
          const fp = violations.filter((v) => v.is_false_positive).length;
          const unverified = violations.filter((v) => !v.is_reviewed && !v.is_false_positive).length;
          const precision = tp + fp > 0 ? ((tp / (tp + fp)) * 100).toFixed(1) : '—';

          const byType = Object.entries(
            violations.reduce<Record<string, { total: number; tp: number; fp: number; pending: number }>>((acc, v) => {
              const cur = acc[v.type] ?? { total: 0, tp: 0, fp: 0, pending: 0 };
              cur.total += 1;
              if (v.is_false_positive) cur.fp += 1;
              else if (v.is_reviewed) cur.tp += 1;
              else cur.pending += 1;
              acc[v.type] = cur;
              return acc;
            }, {}),
          ).sort((a, b) => b[1].total - a[1].total);

          const perfSamples = typing.filter((l) => typeof l.cpu === 'number' || typeof l.ram === 'number');
          const avgCpu = perfSamples.length ? Math.round(perfSamples.reduce((s, x) => s + (x.cpu ?? 0), 0) / perfSamples.length) : null;
          const peakCpu = perfSamples.length ? Math.max(...perfSamples.map((x) => x.cpu ?? 0)) : null;
          const avgRam = perfSamples.length ? Math.round(perfSamples.reduce((s, x) => s + (x.ram ?? 0), 0) / perfSamples.length) : null;
          const totalKeys = typing.reduce((s, x) => s + x.keys, 0);
          const totalClicks = typing.reduce((s, x) => s + (x.clicks ?? 0), 0);

          return (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-2.5">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{tp}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">Vi phạm thật (TP)</div>
                </div>
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-rose-700 dark:text-rose-300">{fp}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">Báo nhầm (FP)</div>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{unverified}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">Chờ duyệt</div>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-center">
                  <div className="text-xl font-bold text-primary">{precision}{precision !== '—' ? '%' : ''}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">Precision (TP / TP+FP)</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-border bg-surface p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Hiệu năng máy thí sinh:</span>
                  <div className="mt-0.5 font-mono font-semibold">
                    {avgCpu !== null ? `CPU TB ${avgCpu}% (Đỉnh ${peakCpu}%) · RAM ${avgRam}%` : 'Chưa có mẫu đo'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tổng thao tác đầu vào:</span>
                  <div className="mt-0.5 font-mono font-semibold">
                    {totalKeys} phím · {totalClicks} nhấp chuột
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Điểm rủi ro tích lũy:</span>
                  <div className="mt-0.5 font-mono font-semibold text-danger-fg">{attempt.risk_score} điểm</div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold">Phân rã theo loại vi phạm ({byType.length} nhóm quy tắc)</div>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface text-[11px] text-muted-foreground">
                        <th className="px-3 py-2">Loại vi phạm</th>
                        <th className="px-2 py-2 text-center">Tổng</th>
                        <th className="px-2 py-2 text-center text-emerald-700">TP (Xác nhận)</th>
                        <th className="px-2 py-2 text-center text-rose-700">FP (Nhầm)</th>
                        <th className="px-2 py-2 text-center text-amber-700">Chờ duyệt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {byType.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground">
                            Không có cảnh báo vi phạm nào trong phiên thi này.
                          </td>
                        </tr>
                      ) : (
                        byType.map(([type, stat]) => (
                          <tr key={type} className="hover:bg-surface/60">
                            <td className="px-3 py-2">
                              <div className="font-medium">{violationLabel(type)}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">{type}</div>
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-bold">{stat.total}</td>
                            <td className="px-2 py-2 text-center font-mono text-emerald-700">{stat.tp}</td>
                            <td className="px-2 py-2 text-center font-mono text-rose-700">{stat.fp}</td>
                            <td className="px-2 py-2 text-center font-mono text-amber-700">{stat.pending}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} width={560} title="Hồ sơ sinh trắc học & Lịch sử dự thi của thí sinh">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4 rounded-xl border border-border bg-surface p-3.5">
            {attempt.user.has_face_photo && attempt.user.id ? (
              <img
                src={`/admin/users/${attempt.user.id}/face-photo`}
                alt={attempt.user.name}
                className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xl font-bold">
                {initials(attempt.user.name)}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
              <div className="text-base font-bold text-foreground">{attempt.user.name}</div>
              <div className="font-mono text-muted-foreground">
                Mã định danh: <b>{attempt.user.username}</b> {attempt.user.email ? `· ${attempt.user.email}` : ''}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Pill tone={attempt.user.has_face_photo ? 'success' : 'warning'} size="sm">
                  {attempt.user.has_face_photo ? 'Đã đăng ký ảnh khuôn mặt mẫu' : 'Chưa có ảnh khuôn mặt mẫu'}
                </Pill>
                <Pill tone="neutral" size="sm">
                  Lần thi #{attempt.attempt_number} của kỳ thi này
                </Pill>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-border bg-surface p-3 text-center">
              <div className="font-mono text-xl font-bold">{attempt.user.total_attempts ?? 1}</div>
              <div className="text-[11px] text-muted-foreground">Tổng lượt dự thi</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 text-center">
              <div className="font-mono text-xl font-bold text-danger-fg">{attempt.user.total_violations ?? violations.length}</div>
              <div className="text-[11px] text-muted-foreground">Tổng vi phạm tích lũy</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 text-center">
              <div className="font-mono text-xl font-bold text-primary">{attempt.user.enrolled_courses?.length ?? 0}</div>
              <div className="text-[11px] text-muted-foreground">Học phần đã ghi danh</div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold">Danh sách lớp học phần đang theo học</div>
            {!attempt.user.enrolled_courses || attempt.user.enrolled_courses.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface py-4 text-center text-xs text-muted-foreground">
                Chưa ghi nhận lớp học phần nào.
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border text-xs">
                {attempt.user.enrolled_courses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-surface/60">
                    <span className="font-medium">{c.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{c.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
