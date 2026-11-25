import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { Dot, Field, FxButton, FxInput, PageHeader, Panel, PanelTitle, Pill, Tip, type Tone } from '@/components/foxy/ui';

type Status = 'ok' | 'warn' | 'down' | 'off';
interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
  ms: number;
}

const META: Record<Status, { tone: Tone; label: string }> = {
  ok: { tone: 'success', label: 'Hoạt động' },
  warn: { tone: 'warning', label: 'Cần chú ý' },
  down: { tone: 'danger', label: 'Lỗi' },
  off: { tone: 'neutral', label: 'Chưa bật' },
};

interface ServiceRow {
  key: string;
  label: string;
  hint: string;
  value: string;
  effective: string;
  overridden: boolean;
}

const xsrf = () => decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? '');

/** Addresses of the AI / realtime services. Empty = use the value set on the server (.env). */
function ServiceAddresses() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/admin/platform/services', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setRows(d.services);
        setDraft(Object.fromEntries(d.services.map((r: ServiceRow) => [r.key, r.value])));
      });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/admin/platform/services', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ values: draft }),
      });
      const d = await res.json();
      if (res.ok) {
        setRows(d.services);
        setErrors({});
        setSaved(true);
      } else setErrors(d.errors ?? {});
    } finally {
      setSaving(false);
    }
  };

  if (!rows.length) return null;
  return (
    <Panel>
      <PanelTitle
        title="Địa chỉ các dịch vụ"
        desc="Thay đổi địa chỉ của dịch vụ AI hoặc dịch vụ trực tuyến mà không cần cài đặt lại hệ thống. Để trống để dùng giá trị mặc định của máy chủ."
      />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <Field
            key={r.key}
            label={
              <>
                {r.label}
                <Tip>{r.hint}</Tip>
              </>
            }
            hint={draft[r.key] ? undefined : r.effective ? `Đang dùng mặc định: ${r.effective}` : 'Chưa cấu hình'}
            error={errors[r.key]}
          >
            <FxInput value={draft[r.key] ?? ''} placeholder="https://" onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value })} />
          </Field>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <FxButton variant="primary" disabled={saving} onClick={save}>
          Lưu địa chỉ
        </FxButton>
        {saved && <span className="text-xs text-success-fg">Đã lưu. Kết quả kiểm tra bên trên sẽ cập nhật ở lần kiểm tra kế tiếp.</span>}
      </div>
    </Panel>
  );
}

/** Live status of the services an exam depends on. Refreshes itself every 20 seconds. */
export default function Health({ user, teams, checks: initial }: { user: any; teams: TeamItem[]; checks: Check[] }) {
  const [checks, setChecks] = useState<Check[]>(initial);
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(() => new Date());

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await fetch('/admin/platform/health.json', { credentials: 'same-origin', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
      if (res.ok) {
        setChecks(await res.json());
        setAt(new Date());
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const id = window.setInterval(refresh, 20000);
    return () => window.clearInterval(id);
  }, []);

  const bad = checks.filter((c) => c.status === 'down').length;
  const warn = checks.filter((c) => c.status === 'warn').length;
  const overall: Status = bad ? 'down' : warn ? 'warn' : 'ok';

  return (
    <AdminLayout user={user} teams={teams} currentTab="health" title="Tình trạng hệ thống" breadcrumbs={[{ label: 'Quản trị nền tảng' }, { label: 'Tình trạng hệ thống' }]}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Tình trạng hệ thống"
          desc="Tình trạng các dịch vụ mà một kỳ thi cần để hoạt động bình thường."
          badges={<Pill tone={META[overall].tone}>{bad ? `${bad} dịch vụ lỗi` : warn ? `${warn} cảnh báo` : 'Mọi thứ ổn định'}</Pill>}
          actions={
            <FxButton icon={busy ? Loader2 : RefreshCw} disabled={busy} onClick={refresh}>
              Kiểm tra lại
            </FxButton>
          }
        />

        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {checks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Dot tone={META[c.status].tone} pulse={c.status === 'down'} />
                <div className="min-w-0 flex-[1_1_220px]">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.detail}</div>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.ms} ms</span>
                <Pill tone={META[c.status].tone}>{META[c.status].label}</Pill>
              </li>
            ))}
          </ul>
        </Panel>

        <ServiceAddresses />

        <p className="text-xs text-muted-foreground">Cập nhật lúc {at.toLocaleTimeString('vi-VN')}. Dịch vụ “Chưa bật” là dịch vụ chưa được cấu hình trong biến môi trường, không phải lỗi.</p>
      </div>
    </AdminLayout>
  );
}
