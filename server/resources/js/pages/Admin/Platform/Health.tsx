import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { Dot, FxButton, PageHeader, Panel, Pill, type Tone } from '@/components/foxy/ui';

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
    <AdminLayout user={user} teams={teams} currentTab="health" title="Sức khỏe hệ thống" breadcrumbs={[{ label: 'Nền tảng' }, { label: 'Sức khỏe hệ thống' }]}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Sức khỏe hệ thống"
          desc="Trạng thái các dịch vụ mà một ca thi phụ thuộc vào."
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

        <p className="text-xs text-muted-foreground">Cập nhật lúc {at.toLocaleTimeString('vi-VN')}. Dịch vụ “Chưa bật” là dịch vụ chưa được cấu hình trong biến môi trường, không phải lỗi.</p>
      </div>
    </AdminLayout>
  );
}
