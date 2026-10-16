import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Download, Flag, MessageSquare } from 'lucide-react';
import { Field, FxButton, FxSelect, FxTextarea, Modal, Panel } from './ui';
import { AttemptChat } from './attempt-chat';

const SEVERITIES = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'CRITICAL', label: 'Nghiêm trọng' },
];

/** Chat with the candidate, a violation the proctor saw themselves, and the CSV downloads of one attempt. */
export function AttemptTools({ attemptId, running, chatSeq }: { attemptId: number; running: boolean; chatSeq?: number }) {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState('MEDIUM');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
        <a href={`/admin/attempts/${attemptId}/export/violations.csv`}>
          <FxButton size="sm" icon={Download}>
            CSV vi phạm
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
    </Panel>
  );
}
