import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Bot, Check, ChevronDown, Inbox, Mail, MessageCircleQuestion, Phone, Save, Search, ShieldCheck } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, Field, FxButton, FxInput, FxSelect, FxTextarea, PageHeader, Panel, Pill, Segmented, type Tone } from '@/components/foxy/ui';
import { Pager, type Paginated } from '@/components/foxy/pager';
import { formatDateTime } from '@/lib/datetime';

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  organization: string | null;
  locale: string;
  status: string;
  note: string | null;
  handler: string | null;
  at: string;
  terms_at: string;
  terms_hash: string;
  source?: string | null;
  plan?: string | null;
  scale?: string | null;
  message?: string | null;
}

interface ChatQuestion {
  id: number;
  question: string;
  locale: string;
  created_at: string;
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: 'Mới', tone: 'info' },
  CONTACTED: { label: 'Đã liên hệ', tone: 'warning' },
  QUALIFIED: { label: 'Tiềm năng', tone: 'success' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral' },
  SPAM: { label: 'Spam', tone: 'danger' },
};

function LeadRow({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(lead.status);
  const [note, setNote] = useState(lead.note ?? '');
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    router.post(`/admin/leads/${lead.id}`, { status, note }, { preserveScroll: true, onFinish: () => setSaving(false) });
  };

  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/40">
        <div className="min-w-0 flex-[1_1_240px]">
          <div className="truncate text-sm font-medium">{lead.name}</div>
          <div className="truncate text-xs text-muted-foreground">{lead.organization || 'Chưa ghi đơn vị'}</div>
        </div>
        <span className="text-xs text-muted-foreground">{formatDateTime(lead.at)}</span>
        {lead.source === 'chat' && (
          <Pill tone="violet">
            <Bot className="size-3" /> Từ trợ lý AI
          </Pill>
        )}
        <Pill tone={STATUS[lead.status]?.tone ?? 'neutral'}>{STATUS[lead.status]?.label ?? lead.status}</Pill>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="grid gap-5 border-t border-border bg-surface/50 px-5 py-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2.5 text-sm">
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-brand-fg hover:underline">
              <Mail className="size-4" /> {lead.email}
            </a>
            <a href={`tel:${lead.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:underline">
              <Phone className="size-4 text-muted-foreground" /> {lead.phone}
            </a>
            {(lead.plan || lead.scale || lead.message) && (
              <div className="rounded-lg border border-border bg-card p-3 text-[13px]">
                {lead.plan && (
                  <div>
                    <span className="text-muted-foreground">Gói quan tâm: </span>
                    {lead.plan}
                  </div>
                )}
                {lead.scale && (
                  <div>
                    <span className="text-muted-foreground">Quy mô: </span>
                    {lead.scale}
                  </div>
                )}
                {lead.message && <p className="mt-1 whitespace-pre-wrap">{lead.message}</p>}
              </div>
            )}
            <div className="mt-1 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-fg" />
              <span>
                Đã đồng ý điều khoản lúc {formatDateTime(lead.terms_at)}
                <br />
                Mã điều khoản: <span className="font-mono">{lead.terms_hash}</span> · Ngôn ngữ: {lead.locale.toUpperCase()}
              </span>
            </div>
            {lead.handler && <span className="text-xs text-muted-foreground">Xử lý gần nhất: {lead.handler}</span>}
          </div>

          <div className="flex flex-col gap-3">
            <Field label="Trạng thái">
              <FxSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </FxSelect>
            </Field>
            <Field label="Ghi chú nội bộ">
              <FxTextarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Đã gọi, hẹn demo thứ Ba…" />
            </Field>
            <div>
              <FxButton variant="primary" icon={Save} disabled={saving} onClick={save}>
                {saving ? 'Đang lưu…' : 'Lưu'}
              </FxButton>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

/** Questions the landing assistant could not answer: add the good ones to resources/chat/faq_public.md. */
function ChatQuestions({ rows }: { rows: ChatQuestion[] }) {
  if (!rows.length) return null;
  return (
    <Panel padded={false}>
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <MessageCircleQuestion className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Câu hỏi trợ lý AI chưa trả lời được</span>
        <span className="text-xs text-muted-foreground">Bổ sung vào FAQ để lần sau trợ lý trả lời được</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((q) => (
          <li key={q.id} className="flex items-start gap-3 px-5 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1">{q.question}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(q.created_at)}</span>
            <button
              type="button"
              onClick={() => router.post(`/admin/leads/questions/${q.id}/resolve`, {}, { preserveScroll: true })}
              className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-brand-fg hover:underline"
            >
              <Check className="size-3.5" /> Đã xử lý
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function LeadsIndex({
  user,
  teams,
  leads,
  filters,
  counts,
  chatQuestions = [],
}: {
  user: any;
  teams: TeamItem[];
  leads: Paginated<Lead>;
  filters: { status: string | null; q: string };
  counts: Record<string, number>;
  chatQuestions?: ChatQuestion[];
}) {
  const [q, setQ] = useState(filters.q ?? '');

  const visit = (next: { status?: string | null; q?: string }) => {
    const params: Record<string, string> = {};
    const status = next.status !== undefined ? next.status : filters.status;
    const query = next.q !== undefined ? next.q : q;
    if (status) params.status = status;
    if (query) params.q = query;
    router.get('/admin/leads', params, { preserveState: true, preserveScroll: true, replace: true });
  };

  // search as you type, once the visitor pauses
  useEffect(() => {
    if (q === (filters.q ?? '')) return;
    const id = window.setTimeout(() => visit({ q }), 350);
    return () => window.clearTimeout(id);
  }, [q]);

  return (
    <AdminLayout user={user} teams={teams} currentTab="leads" title="Khách tiềm năng" breadcrumbs={[{ label: 'Khách hàng' }, { label: 'Khách tiềm năng' }]}>
      <div className="flex flex-col gap-4">
        <PageHeader title="Khách tiềm năng" desc="Yêu cầu thí điểm gửi từ trang công khai, kèm bằng chứng khách đã đồng ý điều khoản." />

        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={filters.status ?? 'ALL'}
            onChange={(v) => visit({ status: v === 'ALL' ? null : v })}
            options={[{ value: 'ALL', label: `Tất cả ${counts.ALL ?? 0}` }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: `${v.label} ${counts[k] ?? 0}` }))]}
          />
          <div className="min-w-[220px] flex-1 sm:max-w-xs">
            <FxInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, email, đơn vị…" suffix={<Search className="size-3.5" />} />
          </div>
        </div>

        <Panel padded={false}>
          {leads.data.length === 0 ? (
            <EmptyState icon={Inbox} title="Chưa có yêu cầu nào" desc="Khi khách điền phiếu đăng ký ở trang chủ, yêu cầu sẽ xuất hiện ở đây." />
          ) : (
            <ul className="divide-y divide-border">
              {leads.data.map((l) => (
                <LeadRow key={`${l.id}-${l.status}-${l.note}`} lead={l} />
              ))}
            </ul>
          )}
        </Panel>
        <Pager page={leads} />
        <ChatQuestions rows={chatQuestions} />
      </div>
    </AdminLayout>
  );
}
