import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Megaphone, Search, Send, X } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, Field, FxButton, FxInput, FxTextarea, PageHeader, Panel, PanelTitle, Pill, Segmented } from '@/components/foxy/ui';
import { useDialog } from '@/components/foxy/dialogs';
import { formatDateTime } from '@/lib/datetime';

type Scope = 'all' | 'types' | 'orgs';
interface OrgHit {
  id: number;
  name: string;
  code: string;
}
interface Item {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  audience: { scope: Scope; types: string[]; org_ids: number[]; roles: string[] };
  recipients: number;
  author: string | null;
  at: string;
}

const TYPES: Record<string, string> = { UNIVERSITY: 'Đại học / Học viện', CENTER: 'Trung tâm / Cao đẳng', INDIVIDUAL: 'Giảng viên độc lập' };
const ROLES: Record<string, string> = { ORG_ADMIN: 'Quản trị trường', TEACHER: 'Giảng viên' };

function xsrf(): string {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" className="size-4 cursor-pointer accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export default function AnnouncementsIndex({ user, teams, history }: { user: any; teams: TeamItem[]; history: Item[] }) {
  const dialog = useDialog();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [types, setTypes] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<OrgHit[]>([]);
  const [roles, setRoles] = useState<string[]>(['ORG_ADMIN', 'TEACHER']);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<OrgHit[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const audience = { scope, types, org_ids: orgs.map((o) => o.id), roles };

  // organization search (the list of schools can be long, so it is searched on demand)
  useEffect(() => {
    if (scope !== 'orgs' || q.trim() === '') return setHits([]);
    const id = window.setTimeout(async () => {
      const res = await fetch(`/admin/switcher/organizations?q=${encodeURIComponent(q)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (res.ok) setHits(((await res.json()).data as OrgHit[]).filter((h) => !orgs.some((o) => o.id === h.id)));
    }, 300);
    return () => window.clearTimeout(id);
  }, [q, scope, orgs]);

  // how many people would receive it
  useEffect(() => {
    if (!roles.length) return setCount(0);
    const id = window.setTimeout(async () => {
      const res = await fetch('/admin/announcements/preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(audience),
      });
      setCount(res.ok ? (await res.json()).count : null);
    }, 300);
    return () => window.clearTimeout(id);
  }, [scope, types.join(), orgs.map((o) => o.id).join(), roles.join()]);

  const flip = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  const ready = title.trim() !== '' && roles.length > 0 && (scope === 'all' || (scope === 'types' && types.length > 0) || (scope === 'orgs' && orgs.length > 0)) && (count ?? 0) > 0;

  const send = async () => {
    const ok = await dialog.confirm({
      title: `Gửi thông báo tới ${count} người?`,
      text: 'Thông báo hiện ngay ở chuông của người nhận và không thể thu hồi.',
      confirmLabel: 'Gửi',
    });
    if (!ok) return;
    setSending(true);
    router.post('/admin/announcements', { ...audience, title, body, url }, {
      preserveScroll: true,
      onSuccess: () => {
        setTitle('');
        setBody('');
        setUrl('');
      },
      onFinish: () => setSending(false),
    });
  };

  return (
    <AdminLayout user={user} teams={teams} currentTab="announcements" title="Thông báo hàng loạt" breadcrumbs={[{ label: 'Khách hàng' }, { label: 'Thông báo hàng loạt' }]}>
      <div className="flex flex-col gap-5">
        <PageHeader title="Thông báo hàng loạt" desc="Gửi một thông báo tới quản trị viên và giảng viên của các trường. Nó hiện ở chuông thông báo của họ." />

        <div className="grid items-start gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Panel className="flex flex-col gap-4">
            <PanelTitle title="Soạn thông báo" />
            <Field label="Tiêu đề *">
              <FxInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Bảo trì hệ thống lúc 22:00 tối nay" />
            </Field>
            <Field label="Nội dung" hint={`${body.length}/500`}>
              <FxTextarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={4} placeholder="Hệ thống tạm ngừng khoảng 15 phút. Vui lòng không mở kỳ thi trong khung giờ này." />
            </Field>
            <Field label="Đường dẫn khi bấm vào (tuỳ chọn)" hint="Chỉ đường dẫn nội bộ, ví dụ /admin/exams">
              <FxInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/admin/exams" mono />
            </Field>

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="text-[13px] font-medium">Gửi tới</div>
              <Segmented
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'all', label: 'Tất cả trường' },
                  { value: 'types', label: 'Theo loại hình' },
                  { value: 'orgs', label: 'Chọn trường' },
                ]}
              />
              {scope === 'types' && (
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {Object.entries(TYPES).map(([k, v]) => (
                    <Check key={k} checked={types.includes(k)} onChange={(on) => setTypes(flip(types, k, on))}>
                      {v}
                    </Check>
                  ))}
                </div>
              )}
              {scope === 'orgs' && (
                <div className="flex flex-col gap-2">
                  <FxInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên hoặc mã trường…" suffix={<Search className="size-3.5" />} />
                  {hits.length > 0 && (
                    <ul className="max-h-44 overflow-y-auto rounded-lg border border-border bg-card">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button type="button" className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setOrgs([...orgs, h]); setQ(''); }}>
                            <span className="truncate">{h.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{h.code}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {orgs.map((o) => (
                      <span key={o.id} className="inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand-fg">
                        {o.name}
                        <button type="button" aria-label={`Bỏ ${o.name}`} className="cursor-pointer" onClick={() => setOrgs(orgs.filter((x) => x.id !== o.id))}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {Object.entries(ROLES).map(([k, v]) => (
                  <Check key={k} checked={roles.includes(k)} onChange={(on) => setRoles(flip(roles, k, on))}>
                    {v}
                  </Check>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-[13px] text-muted-foreground">{count === null ? '' : count === 0 ? 'Chưa có người nhận phù hợp' : `Sẽ gửi tới ${count.toLocaleString('vi-VN')} người`}</span>
              <FxButton variant="primary" icon={Send} disabled={!ready || sending} onClick={send}>
                {sending ? 'Đang gửi…' : 'Gửi thông báo'}
              </FxButton>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <PanelTitle title="Đã gửi gần đây" />
            {history.length === 0 ? (
              <EmptyState icon={Megaphone} title="Chưa gửi thông báo nào" />
            ) : (
              <ul className="divide-y divide-border">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-col gap-1 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium">{h.title}</span>
                      <Pill tone="neutral">{h.recipients.toLocaleString('vi-VN')} người</Pill>
                    </div>
                    {h.body && <p className="line-clamp-2 text-xs text-muted-foreground">{h.body}</p>}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(h.at)} · {h.author ?? '—'} · {h.audience.scope === 'all' ? 'Tất cả trường' : h.audience.scope === 'types' ? 'Theo loại hình' : `${h.audience.org_ids.length} trường`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}
