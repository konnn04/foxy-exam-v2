import React from 'react';
import { router } from '@inertiajs/react';
import { Building2, ClipboardList, Pencil, Trash2, Users } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { EmptyState, FxButton, PageHeader, Panel, PanelBar, PanelTitle, Pill } from '@/components/foxy/ui';
import { ORG_STATUS, PLAN_TONE, initials } from '@/components/foxy/domain';
import { EXAM_STATUS } from '@/components/foxy/exam-form';
import { USER_ROLE } from '@/components/admin/tabs/users-tab';
import { useDialog } from '@/components/foxy/dialogs';

interface Props {
  user: any;
  teams: TeamItem[];
  organization: {
    id: number;
    name: string;
    code: string;
    type: string;
    status: string;
    plan_name?: string;
    exams_count: number;
    users_count: number;
    created_at: string;
    users?: { id: number; name: string; username: string; email: string; role: string }[];
    exams?: { id: number; title: string; code: string; type?: string; status: string; duration_minutes: number }[];
  };
}

const TYPE: Record<string, string> = { UNIVERSITY: 'Đại học', CENTER: 'Trung tâm', INDIVIDUAL: 'Cá nhân' };

export default function ShowOrganization({ user, teams, organization: o }: Props) {
  const dialog = useDialog();
  const remove = async () => {
    const ok = await dialog.confirm({
      title: `Xóa tổ chức ${o.name}?`,
      text: 'Toàn bộ giảng viên, sinh viên, kỳ thi và bằng chứng giám sát của tổ chức sẽ bị xóa. Cân nhắc Tạm khóa thay vì xóa.',
      tone: 'danger',
      requireText: o.code,
      confirmLabel: 'Xóa vĩnh viễn',
      icon: Building2,
    });
    if (ok) router.post(`/admin/organizations/${o.id}/delete`);
  };
  const st = ORG_STATUS[o.status] ?? { label: o.status, tone: 'neutral' as const };
  const plan = (o.plan_name ?? 'FREE').toUpperCase();
  const isRoot = o.code === 'ROOT' || o.id === 1;
  const users = o.users ?? [];
  const exams = o.exams ?? [];
  const byRole = (r: string) => users.filter((u) => u.role === r).length;

  return (
    <AdminLayout user={user} teams={teams} currentTab="organizations" title={o.name} breadcrumbs={[{ label: 'Tổ chức', href: '/admin/organizations' }, { label: o.name }]}>
      <PageHeader
        onBack={() => router.visit('/admin/organizations')}
        leading={<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-[11px] font-bold">{o.code.slice(0, 4)}</div>}
        title={o.name}
        badges={
          <>
            <Pill tone={PLAN_TONE[plan] ?? 'neutral'}>{plan}</Pill>
            <Pill tone={st.tone}>{st.label}</Pill>
          </>
        }
        desc={
          <>
            <span className="font-mono">{o.code.toLowerCase()}.foxyexam.vn</span> · {TYPE[o.type] ?? o.type} · tạo {o.created_at}
          </>
        }
        actions={
          <>
            {!isRoot && (
              <FxButton icon={Trash2} className="text-danger-fg" onClick={remove}>
                Xóa
              </FxButton>
            )}
            <FxButton variant="primary" icon={Pencil} onClick={() => router.visit(`/admin/organizations/${o.id}/edit`)}>
              Sửa
            </FxButton>
          </>
        }
      />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        {[
          ['Tài khoản', o.users_count],
          ['Org Admin', byRole('ORG_ADMIN')],
          ['Giảng viên', byRole('TEACHER')],
          ['Sinh viên', byRole('STUDENT')],
          ['Kỳ thi', o.exams_count],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex flex-col gap-1 bg-card px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="text-[22px] font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Panel padded={false} className="min-w-0 flex-[1_1_420px] overflow-hidden">
          <PanelBar>
            <PanelTitle className="flex-1" title="Tài khoản" desc={`${users.length} người dùng`} />
          </PanelBar>
          {users.length === 0 ? (
            <EmptyState icon={Users} title="Chưa có tài khoản" />
          ) : (
            users.slice(0, 50).map((u) => {
              const r = USER_ROLE[u.role] ?? { label: u.role, tone: 'neutral' as const };
              return (
                <div
                  key={u.id}
                  onClick={() => router.visit(`/admin/users/${u.id}?org_id=${o.id}`)}
                  className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(u.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Pill tone={r.tone}>{r.label}</Pill>
                </div>
              );
            })
          )}
        </Panel>
        <Panel padded={false} className="min-w-0 flex-[1_1_420px] overflow-hidden">
          <PanelBar>
            <PanelTitle className="flex-1" title="Kỳ thi" desc={`${exams.length} kỳ thi`} />
          </PanelBar>
          {exams.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Chưa có kỳ thi" />
          ) : (
            exams.slice(0, 50).map((e) => {
              const s = EXAM_STATUS[e.status] ?? { label: e.status, tone: 'neutral' as const };
              return (
                <div key={e.id} onClick={() => router.visit(`/admin/exams/${e.id}`)} className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{e.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {e.code} · {e.duration_minutes}′
                    </div>
                  </div>
                  <Pill tone={e.type !== 'QUIZ' ? 'brand' : 'info'}>{e.type !== 'QUIZ' ? 'Lập trình' : 'Phổ thông'}</Pill>
                  <Pill tone={s.tone}>{s.label}</Pill>
                </div>
              );
            })
          )}
        </Panel>
      </div>

    </AdminLayout>
  );
}
