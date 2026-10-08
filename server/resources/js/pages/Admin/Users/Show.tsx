import { formatDate, formatDateTime } from '@/lib/datetime';
import React from 'react';
import { router } from '@inertiajs/react';
import { Lock, LockOpen, Pencil, ScanFace, Trash2, Upload } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { FxButton, PageHeader, Panel, PanelTitle, Pill } from '@/components/foxy/ui';
import { initials } from '@/components/foxy/domain';
import { useDialog } from '@/components/foxy/dialogs';
import { USER_ROLE, USER_STATUS } from '@/components/admin/tabs/users-tab';

interface Props {
  user: any;
  teams: TeamItem[];
  currentScopeOrg?: { id: number; name: string; code: string };
  isRootContext?: boolean;
  targetUser: {
    id: number;
    name: string;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    date_of_birth?: string | null;
    address?: string | null;
    avatar?: string | null;
    username: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
    face?: { enrolled: boolean; locked: boolean; enrolled_at: string | null } | null;
    organization?: { id: number; name: string; code: string } | null;
  };
}

export default function ShowUser({ user, teams, currentScopeOrg, targetUser: u }: Props) {
  const dialog = useDialog();
  const orgId = u.organization?.id ?? currentScopeOrg?.id;
  const q = orgId ? `?org_id=${orgId}` : '';
  const role = USER_ROLE[u.role] ?? { label: u.role, tone: 'neutral' as const };
  const st = USER_STATUS[u.status] ?? { label: u.status, tone: 'neutral' as const };
  const isSelf = u.id === user.id;
  const remove = async () => {
    const ok = await dialog.confirm({
      title: `Xóa tài khoản “${u.name}”?`,
      text: `Tài khoản ${u.username} sẽ không đăng nhập được nữa. Lịch sử làm bài cũng bị xóa.`,
      tone: 'danger',
      confirmLabel: 'Xóa tài khoản',
    });
    if (ok) router.post(`/admin/users/${u.id}/delete${q}`);
  };

  const rows: [string, React.ReactNode][] = [
    ['Họ', u.last_name || '—'],
    ['Tên đệm', u.middle_name || '—'],
    ['Tên', u.first_name || '—'],
    ['Ngày sinh', formatDate(u.date_of_birth)],
    ['Địa chỉ', u.address || '—'],
    ['Tên đăng nhập', <span className="font-mono">{u.username}</span>],
    ['Email', u.email],
    ['Tổ chức', u.organization ? `${u.organization.code} — ${u.organization.name}` : '—'],
    ['Ngày tạo', <span className="font-mono">{formatDateTime(u.created_at)}</span>],
  ];

  return (
    <AdminLayout user={user} teams={teams} currentTab="users" title={u.name} breadcrumbs={[{ label: 'Người dùng', href: `/admin/users${q}` }, { label: u.name }]}>
      <PageHeader
        onBack={() => router.visit(`/admin/users${q}`)}
        leading={
          u.avatar ? (
            <img src={u.avatar} alt="" className="size-10 rounded-full bg-muted object-cover" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">{initials(u.name)}</div>
          )
        }
        title={u.name}
        badges={
          <>
            <Pill tone={role.tone}>{role.label}</Pill>
            <Pill tone={st.tone}>{st.label}</Pill>
          </>
        }
        desc={<span className="font-mono">{u.username}</span>}
        actions={
          <>
            {!isSelf && (
              <FxButton icon={Trash2} className="text-danger-fg" onClick={remove}>
                Xóa
              </FxButton>
            )}
            <FxButton variant="primary" icon={Pencil} onClick={() => router.visit(`/admin/users/${u.id}/edit${q}`)}>
              Sửa
            </FxButton>
          </>
        }
      />
      <Panel className="max-w-[880px]" padded={false}>
        <div className="px-5 pt-4">
          <PanelTitle title="Thông tin tài khoản" />
        </div>
        <div className="mt-2 grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 border-t border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="truncate text-sm">{v}</span>
            </div>
          ))}
        </div>
      </Panel>
      {u.face && <FacePanel userId={u.id} face={u.face} />}
    </AdminLayout>
  );
}

/** Biometric reference photo: what the identity check compares the candidate against. */
function FacePanel({ userId, face }: { userId: number; face: NonNullable<Props['targetUser']['face']> }) {
  const dialog = useDialog();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const upload = (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    router.post(`/admin/users/${userId}/face`, { photo: file }, { forceFormData: true, preserveScroll: true, onFinish: () => setBusy(false) });
    if (input.current) input.current.value = '';
  };
  const remove = async () => {
    const ok = await dialog.confirm({ title: 'Xóa dữ liệu khuôn mặt?', text: 'Sinh viên sẽ phải đăng ký lại ở phòng chờ trước khi thi có xác thực khuôn mặt.', tone: 'danger', confirmLabel: 'Xóa' });
    if (ok) router.post(`/admin/users/${userId}/face/delete`, {}, { preserveScroll: true });
  };

  return (
    <Panel className="max-w-[880px]">
      <PanelTitle title="Sinh trắc học khuôn mặt" desc="Ảnh tham chiếu để xác thực sinh viên trong kỳ thi bật “Xác thực sinh viên (AI)”. Chỉ giảng viên và quản trị xem được." />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
          {face.enrolled ? <img src={`/admin/users/${userId}/face-photo?v=${encodeURIComponent(face.enrolled_at ?? '')}`} alt="Khuôn mặt đã đăng ký" className="size-full object-cover" /> : <ScanFace className="size-8 opacity-40" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={face.enrolled ? 'success' : 'warning'}>{face.enrolled ? 'Đã đăng ký' : 'Chưa đăng ký'}</Pill>
            {face.enrolled && <Pill tone={face.locked ? 'info' : 'outline'}>{face.locked ? 'Đã khoá' : 'Đang mở khoá'}</Pill>}
            {face.enrolled_at && <span className="text-xs text-muted-foreground">{formatDateTime(face.enrolled_at)}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <FxButton icon={Upload} disabled={busy} onClick={() => input.current?.click()}>
              {face.enrolled ? 'Thay ảnh' : 'Tải ảnh lên'}
            </FxButton>
            {face.enrolled && (
              <FxButton icon={face.locked ? LockOpen : Lock} onClick={() => router.post(`/admin/users/${userId}/face/lock`, { locked: !face.locked }, { preserveScroll: true })}>
                {face.locked ? 'Mở khoá cho sinh viên đăng ký lại' : 'Khoá'}
              </FxButton>
            )}
            {face.enrolled && (
              <FxButton icon={Trash2} className="text-danger-fg" onClick={remove}>
                Xóa
              </FxButton>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Ảnh chân dung rõ mặt, nhìn thẳng, một người, đủ sáng (JPG/PNG, tối đa 5 MB). Dịch vụ AI khuôn mặt phải kiểm tra đạt mới lưu.</p>
        </div>
      </div>
    </Panel>
  );
}
