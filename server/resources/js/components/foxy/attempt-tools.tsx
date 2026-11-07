import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Download, FileText, Flag, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { useDialog } from './dialogs';
import { Field, FxButton, FxSelect, FxTextarea, Modal, Panel } from './ui';
import { AttemptChat } from './attempt-chat';

const SEVERITIES = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Nghiêm trọng' },
];

/** Chat with the candidate, a violation the proctor saw themselves, formal violation report printing/sending, and CSV downloads. */
export function AttemptTools({ attemptId, running, chatSeq }: { attemptId: number; running: boolean; chatSeq?: number }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState('MEDIUM');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

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

  const save = () => {
    setBusy(true);
    router.post(
      `/admin/attempts/${attemptId}/violations`,
      { severity, message },
      {
        preserveScroll: true,
        onSuccess: () => {
          setOpen(false);
          setMessage('');
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
          Trao đổi với thí sinh
        </span>
        <div className="flex-1" />
        <FxButton size="sm" icon={Flag} onClick={() => setOpen(true)}>
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
    </Panel>
  );
}
