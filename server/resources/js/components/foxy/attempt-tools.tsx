import React, { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { BellRing, Camera, Cpu, Download, FileText, Flag, MessageSquare, PauseCircle, PlayCircle, Power, RefreshCw, Search, Send, ShieldCheck, Skull } from 'lucide-react';
import { useDialog } from './dialogs';
import { Field, FxButton, FxInput, FxSelect, FxTextarea, Modal, Panel, Pill } from './ui';
import { AttemptChat } from './attempt-chat';

const SYSTEM_PROCESS_NAMES = new Set([
  'system',
  'system idle process',
  'registry',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'services.exe',
  'lsass.exe',
  'svchost.exe',
  'winlogon.exe',
  'dwm.exe',
  'fontdrvhost.exe',
  'sihost.exe',
  'taskhostw.exe',
  'explorer.exe',
  'ctfmon.exe',
  'conhost.exe',
  'runtimebroker.exe',
  'searchhost.exe',
  'startmenuexperiencehost.exe',
  'shellexperiencehost.exe',
  'audiodg.exe',
  'spoolsv.exe',
  'dllhost.exe',
  'wmiprvse.exe',
  'msmpeng.exe',
  'nissrv.exe',
  'securityhealthservice.exe',
  'securityhealthsystray.exe',
]);

export interface RemoteProcessItem {
  pid: number;
  ppid?: number;
  name: string;
}

const SEVERITIES = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Nghiêm trọng' },
];

function captureActiveVideoSnapshots(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof document === 'undefined') return out;
  const videos = document.querySelectorAll<HTMLVideoElement>('video[data-stream-kind]');
  videos.forEach((v) => {
    if (!v.videoWidth || !v.videoHeight) return;
    const rawKind = (v.getAttribute('data-stream-kind') ?? '').toLowerCase();
    const key = rawKind.includes('màn hình') ? 'screen' : rawKind.includes('phụ') ? 'phone' : 'camera';
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / v.videoWidth);
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        out[key] = canvas.toDataURL('image/jpeg', 0.78);
      }
    } catch {
      // Cross-origin without CORS or tainted canvas: skip gracefully
    }
  });
  return out;
}

/** Chat with the candidate, live proctor commands (warn/pause/resume/force-end/process list), manual violation with 3-angle snapshots, formal report printing/sending, and CSV downloads. */
export function AttemptTools({
  attemptId,
  running,
  chatSeq,
  deviceInfo,
}: {
  attemptId: number;
  running: boolean;
  chatSeq?: number;
  deviceInfo?: Record<string, unknown> | null;
}) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState('MEDIUM');
  const [message, setMessage] = useState('');
  const [capturedShots, setCapturedShots] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const [warnOpen, setWarnOpen] = useState(false);
  const [warnText, setWarnText] = useState('Yêu cầu thí sinh tập trung làm bài, giữ khuôn mặt trong khung hình và nghiêm túc chấp hành quy chế phòng thi.');
  const [cmdBusy, setCmdBusy] = useState(false);

  const [procOpen, setProcOpen] = useState(false);
  const [procFilter, setProcFilter] = useState('');
  const [hideSystemProc, setHideSystemProc] = useState(true);
  const [reqProcBusy, setReqProcBusy] = useState(false);
  const [killingPid, setKillingPid] = useState<number | null>(null);

  const isPausedByProctor = Boolean(deviceInfo?.paused_by_proctor);
  const processes = useMemo<RemoteProcessItem[]>(() => {
    const raw = deviceInfo?.processes;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is RemoteProcessItem => Boolean(p && typeof p === 'object' && typeof (p as RemoteProcessItem).pid === 'number' && typeof (p as RemoteProcessItem).name === 'string'))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [deviceInfo]);
  const processesUpdatedAt = typeof deviceInfo?.processes_updated_at === 'string' ? deviceInfo.processes_updated_at : null;
  const lastKillResult = (deviceInfo?.last_kill_result as { pid?: number; name?: string; ok?: boolean; error?: string; at?: string } | undefined) ?? null;

  const filteredProcesses = useMemo(() => {
    const q = procFilter.trim().toLowerCase();
    return processes.filter((p) => {
      const lower = p.name.toLowerCase();
      if (hideSystemProc && (p.pid <= 4 || SYSTEM_PROCESS_NAMES.has(lower))) return false;
      if (q && !lower.includes(q) && !String(p.pid).includes(q)) return false;
      return true;
    });
  }, [processes, procFilter, hideSystemProc]);

  const sendCommand = (
    payload: { type: 'WARN' | 'PAUSE' | 'RESUME' | 'REQ_PROCESSES' | 'KILL_PROCESS'; message?: string; pid?: number; name?: string },
    onDone?: () => void,
  ) => {
    setCmdBusy(true);
    router.post(`/admin/attempts/${attemptId}/command`, payload, {
      preserveScroll: true,
      onSuccess: () => onDone?.(),
      onFinish: () => {
        setCmdBusy(false);
        setReqProcBusy(false);
        setKillingPid(null);
      },
    });
  };

  const requestProcessRefresh = () => {
    setReqProcBusy(true);
    sendCommand({ type: 'REQ_PROCESSES' }, () => {
      dialog.toast.success('Đã gửi lệnh lấy danh sách tiến trình tới máy thí sinh.');
    });
  };

  const handleKillProcess = async (proc: RemoteProcessItem) => {
    const ok = await dialog.confirm({
      title: `Buộc tắt tiến trình ${proc.name} (PID #${proc.pid})?`,
      text: 'Lệnh kết thúc tiến trình (TerminateProcess) sẽ được gửi trực tiếp tới máy thí sinh ngay lập tức.',
      tone: 'danger',
      confirmLabel: 'Buộc tắt (Kill)',
    });
    if (!ok) return;
    setKillingPid(proc.pid);
    sendCommand({ type: 'KILL_PROCESS', pid: proc.pid, name: proc.name });
  };

  const handleForceEnd = async () => {
    const ok = await dialog.confirm({
      title: 'Đình chỉ & Thu bài thí sinh ngay lập tức?',
      text: 'Phiên thi sẽ chuyển sang trạng thái ĐÌNH CHỈ (FORCE_ENDED) và ứng dụng thi của thí sinh sẽ bị đóng ngay lập tức.',
      tone: 'danger',
      confirmLabel: 'Đình chỉ thi ngay',
    });
    if (!ok) return;
    router.post(`/admin/attempts/${attemptId}/force-end`, {}, { preserveScroll: true });
  };

  const verify = async () => {
    try {
      const res = await fetch(`/admin/attempts/${attemptId}/verify-chain`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      const j = await res.json();
      if (j.ok) dialog.toast.success(`Nhật ký vi phạm toàn vẹn (${j.checked} mục đã kiểm${j.unchained ? `, ${j.unchained} mục cũ chưa có chuỗi băm` : ''}).`);
      else dialog.toast.error(`Nhật ký bị can thiệp: chuỗi băm đứt tại vi phạm #${j.broken_at}.`);
    } catch {
      dialog.toast.error('Không kiểm tra được.');
    }
  };

  const openManualModal = () => {
    setCapturedShots(captureActiveVideoSnapshots());
    setOpen(true);
  };

  const save = () => {
    setBusy(true);
    router.post(
      `/admin/attempts/${attemptId}/violations`,
      { severity, message, snapshots: Object.keys(capturedShots).length > 0 ? capturedShots : undefined },
      {
        preserveScroll: true,
        onSuccess: () => {
          setOpen(false);
          setMessage('');
          setCapturedShots({});
        },
        onFinish: () => setBusy(false),
      },
    );
  };

  const sendReport = () => {
    setSendingReport(true);
    router.post(
      `/admin/attempts/${attemptId}/send-report`,
      { note: reportNote.trim() || null, only_confirmed: onlyConfirmed },
      {
        preserveScroll: true,
        onSuccess: () => {
          setReportOpen(false);
          setReportNote('');
          dialog.toast.success('Đã gửi biên bản giám sát tới thí sinh.');
        },
        onFinish: () => setSendingReport(false),
      },
    );
  };

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <MessageSquare className="size-4" />
          Điều khiển giám thị &amp; Trao đổi
        </span>
        <div className="flex-1" />
        {running && (
          <>
            <FxButton size="sm" icon={BellRing} onClick={() => setWarnOpen(true)}>
              Nhắc nhở trực tiếp
            </FxButton>
            <FxButton
              size="sm"
              icon={isPausedByProctor ? PlayCircle : PauseCircle}
              disabled={cmdBusy}
              onClick={() => sendCommand({ type: isPausedByProctor ? 'RESUME' : 'PAUSE' })}
            >
              {isPausedByProctor ? 'Cho tiếp tục thi' : 'Tạm dừng bài thi'}
            </FxButton>
            <FxButton size="sm" variant="danger" icon={Power} onClick={handleForceEnd}>
              Đình chỉ thi
            </FxButton>
          </>
        )}
        <FxButton
          size="sm"
          icon={Cpu}
          onClick={() => {
            setProcOpen(true);
            if (running && processes.length === 0) requestProcessRefresh();
          }}
        >
          Tiến trình máy ({processes.length})
        </FxButton>
        <FxButton size="sm" icon={Flag} onClick={openManualModal}>
          Ghi vi phạm thủ công
        </FxButton>
        <FxButton size="sm" icon={ShieldCheck} onClick={verify}>
          Kiểm tra toàn vẹn
        </FxButton>
        <a href={`/admin/attempts/${attemptId}/report`} target="_blank" rel="noreferrer">
          <FxButton size="sm" icon={FileText}>
            Xuất biên bản
          </FxButton>
        </a>
        <FxButton size="sm" icon={Send} onClick={() => setReportOpen(true)}>
          Gửi biên bản cho thí sinh
        </FxButton>
        <a href={`/admin/attempts/${attemptId}/export/violations.csv`}>
          <FxButton size="sm" icon={Download}>
            CSV vi phạm
          </FxButton>
        </a>
        <a href={`/admin/attempts/${attemptId}/export/oplog.csv`}>
          <FxButton size="sm" icon={Download}>
            CSV Op-Log
          </FxButton>
        </a>
        <a href={`/admin/attempts/${attemptId}/export/tracking.txt`}>
          <FxButton size="sm" icon={Download}>
            TRACKING.txt
          </FxButton>
        </a>
        <a href={`/admin/attempts/${attemptId}/export/chat.csv`}>
          <FxButton size="sm" icon={Download}>
            CSV chat
          </FxButton>
        </a>
      </div>
      <AttemptChat attemptId={attemptId} signal={chatSeq} canSend={running} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        width={460}
        title="Ghi vi phạm thủ công"
        desc="Dành cho điều giám thị tự quan sát được. Vi phạm được xác nhận ngay và tính vào điểm rủi ro."
        footer={
          <>
            <FxButton onClick={() => setOpen(false)}>Hủy</FxButton>
            <FxButton variant="primary" onClick={save} disabled={busy || !message.trim()}>
              Ghi nhận
            </FxButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Mức độ">
            <FxSelect value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </FxSelect>
          </Field>
          <Field label="Mô tả">
            <FxTextarea value={message} maxLength={500} rows={3} onChange={(e) => setMessage(e.target.value)} placeholder="Ví dụ: Thí sinh liên tục nhìn sang bài bạn bên cạnh." />
          </Field>
          {Object.keys(capturedShots).length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Camera className="size-3.5 text-primary" />
                  Ảnh chụp tức thời từ các góc video đang hiển thị ({Object.keys(capturedShots).length} khung)
                </span>
                <button
                  type="button"
                  onClick={() => setCapturedShots(captureActiveVideoSnapshots())}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Chụp lại khung hiện tại
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(capturedShots).map(([k, url]) => (
                  <div key={k} className="relative overflow-hidden rounded border border-border bg-black">
                    <img src={url} alt={k} className="aspect-video w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {k === 'screen' ? 'Màn hình' : k === 'phone' ? 'Cam phụ' : 'Cam chính'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        width={480}
        title="Gửi biên bản giám sát cho thí sinh"
        desc="Hệ thống sẽ tổng hợp trạng thái phiên thi, điểm rủi ro và danh sách các vi phạm để gửi vào hộp thông báo và khung trao đổi của thí sinh."
        footer={
          <>
            <FxButton onClick={() => setReportOpen(false)}>Hủy</FxButton>
            <FxButton variant="primary" icon={Send} onClick={sendReport} disabled={sendingReport}>
              {sendingReport ? 'Đang gửi…' : 'Gửi biên bản'}
            </FxButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={onlyConfirmed}
              onChange={(e) => setOnlyConfirmed(e.target.checked)}
              className="size-3.5 accent-[var(--primary)]"
            />
            Chỉ thống kê các vi phạm đã được xác nhận (bỏ qua các cảnh báo đang chờ duyệt)
          </label>
          <Field label="Nhận xét / Kết luận của giảng viên hoặc giám thị (tuỳ chọn)">
            <FxTextarea
              value={reportNote}
              maxLength={1000}
              rows={3}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="Ví dụ: Yêu cầu thí sinh giải trình về việc mất kết nối camera phụ lúc 09:15."
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={warnOpen}
        onClose={() => setWarnOpen(false)}
        width={460}
        title="Gửi cảnh báo hiển thị trực tiếp trên màn hình thí sinh"
        desc="Thông điệp này sẽ bật nổi (Banner cảnh báo màu vàng) ngay trên giao diện làm bài của thí sinh và lưu vào nhật ký trao đổi."
        footer={
          <>
            <FxButton onClick={() => setWarnOpen(false)}>Hủy</FxButton>
            <FxButton
              variant="primary"
              icon={BellRing}
              disabled={cmdBusy || !warnText.trim()}
              onClick={() =>
                sendCommand({ type: 'WARN', message: warnText.trim() }, () => {
                  setWarnOpen(false);
                })
              }
            >
              Gửi cảnh báo ngay
            </FxButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              'Yêu cầu điều chỉnh gương mặt vào chính giữa khung hình camera chính.',
              'Yêu cầu xoay ngang điện thoại giám sát phụ để thấy rõ toàn cảnh vị trí ngồi và laptop.',
              'Không nói chuyện hoặc trao đổi trong suốt thời gian làm bài thi.',
              'Cảnh báo: Phát hiện thao tác chuyển cửa sổ nhiều lần, tái phạm sẽ bị đình chỉ thi.',
            ].map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setWarnText(tpl)}
                className="rounded border border-border bg-surface px-2 py-1 text-left text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                + {tpl}
              </button>
            ))}
          </div>
          <Field label="Nội dung nhắc nhở">
            <FxTextarea value={warnText} maxLength={500} rows={3} onChange={(e) => setWarnText(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={procOpen}
        onClose={() => setProcOpen(false)}
        width={680}
        title="Danh sách tiến trình đang chạy trên máy thí sinh (Remote Process Inspector)"
        desc="Giám thị có thể làm mới danh sách tiến trình thời gian thực và buộc dừng (Kill) các phần mềm khả nghi từ xa."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <FxInput
                value={procFilter}
                onChange={(e) => setProcFilter(e.target.value)}
                placeholder="Tìm theo tên tiến trình (vd: chrome, zalo, obs) hoặc PID…"
                className="pl-8"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={hideSystemProc}
                onChange={(e) => setHideSystemProc(e.target.checked)}
                className="size-3.5 accent-[var(--primary)]"
              />
              Ẩn tiến trình hệ thống Windows
            </label>
            {running && (
              <FxButton size="sm" icon={RefreshCw} disabled={reqProcBusy} onClick={requestProcessRefresh}>
                {reqProcBusy ? 'Đang yêu cầu…' : 'Làm mới từ máy thí sinh'}
              </FxButton>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              Hiển thị <b>{filteredProcesses.length}</b> / {processes.length} tiến trình
              {processesUpdatedAt && ` · Cập nhật lúc ${new Date(processesUpdatedAt).toLocaleTimeString('vi-VN')}`}
            </span>
            {lastKillResult && (
              <Pill tone={lastKillResult.ok ? 'success' : 'danger'} size="sm">
                {lastKillResult.ok
                  ? `Đã tắt ${lastKillResult.name || 'PID'} (#${lastKillResult.pid})`
                  : `Lỗi tắt #${lastKillResult.pid}: ${lastKillResult.error ?? 'Từ chối truy cập'}`}
              </Pill>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            {filteredProcesses.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {processes.length === 0
                  ? running
                    ? 'Chưa có ảnh chụp tiến trình. Nhấn "Làm mới từ máy thí sinh" để tải danh sách tiến trình trực tiếp.'
                    : 'Không có dữ liệu tiến trình được lưu trong phiên thi này.'
                  : 'Không có tiến trình nào khớp bộ lọc.'}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface text-[11px] text-muted-foreground">
                    <th className="w-20 px-3 py-2 font-mono">PID</th>
                    <th className="w-20 px-2 py-2 font-mono">PPID</th>
                    <th className="px-3 py-2">Tên tiến trình (Executable)</th>
                    {running && <th className="w-28 px-3 py-2 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProcesses.map((p) => {
                    const isSelf = p.name.toLowerCase().includes('foxy') || p.name.toLowerCase().includes('exam-guard');
                    return (
                      <tr key={`${p.pid}-${p.name}`} className="hover:bg-surface/60">
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{p.pid}</td>
                        <td className="px-2 py-1.5 font-mono text-muted-foreground">{p.ppid ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono font-medium">
                          {p.name}
                          {isSelf && (
                            <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-primary">
                              Ứng dụng thi
                            </span>
                          )}
                        </td>
                        {running && (
                          <td className="px-3 py-1.5 text-right">
                            {!isSelf && (
                              <FxButton
                                size="sm"
                                variant="danger"
                                icon={Skull}
                                disabled={killingPid === p.pid}
                                onClick={() => void handleKillProcess(p)}
                              >
                                {killingPid === p.pid ? 'Đang tắt…' : 'Buộc tắt'}
                              </FxButton>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>
    </Panel>
  );
}
