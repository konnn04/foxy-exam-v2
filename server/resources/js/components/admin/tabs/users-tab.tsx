import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Eye, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { type TeamItem } from '@/components/team-switcher';
import type { UserItem } from '@/types/admin';
import { FxButton, IconButton, PageHeader, Pill, type Tone } from '@/components/foxy/ui';
import { FxList, useServerQuery } from '@/components/foxy/fx-list';
import { useDialog } from '@/components/foxy/dialogs';
import type { ListMeta } from './organizations-tab';
import { initials } from '@/components/foxy/domain';

export type UserRow = UserItem;

interface UsersTabProps {
  users: UserRow[];
  currentUserId: number;
  isSuperAdmin: boolean;
  activeTeamName?: string;
  activeTeam?: TeamItem;
  isRootContext?: boolean;
  onOpenCreateModal?: () => void;
  listMeta: ListMeta;
}

export const USER_ROLE: Record<string, { label: string; tone: Tone }> = {
  SUPER_ADMIN: { label: 'Root Admin', tone: 'violet' },
  ORG_ADMIN: { label: 'Org Admin', tone: 'info' },
  TEACHER: { label: 'Giảng viên', tone: 'success' },
  STUDENT: { label: 'Sinh viên', tone: 'neutral' },
};
export const USER_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Hoạt động', tone: 'success' },
  INACTIVE: { label: 'Chưa kích hoạt', tone: 'warning' },
  SUSPENDED: { label: 'Tạm khóa', tone: 'danger' },
};

export function UsersTab({ users, currentUserId, activeTeamName, activeTeam, isRootContext = true, onOpenCreateModal, listMeta }: UsersTabProps) {
  const dialog = useDialog();
  const onQuery = useServerQuery(['usersList', 'listMeta']);
  const q = activeTeam?.id ? `?org_id=${activeTeam.id}` : '';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={isRootContext ? 'Tài khoản hệ thống' : 'Giảng viên & Sinh viên'}
        desc={`Tài khoản thuộc ${activeTeamName ?? 'tổ chức hiện tại'} — vai trò, trạng thái và thông tin đăng nhập.`}
        actions={
          <FxButton variant="primary" icon={UserPlus} onClick={onOpenCreateModal ?? (() => router.visit(`/admin/users/new${q}`))}>
            Thêm người dùng
          </FxButton>
        }
      />
      <FxList
        rows={users}
        server={{ total: listMeta.total, page: listMeta.page, lastPage: listMeta.last_page, perPage: listMeta.per_page, values: listMeta.filters, onQuery }}
        searchText={(u) => `${u.name} ${u.username} ${u.email}`}
        searchPlaceholder="Tìm theo họ tên, tên đăng nhập, email…"
        filters={[
          {
            key: 'role',
            label: 'Vai trò',
            options: Object.entries(USER_ROLE).map(([value, r]) => ({ value, label: r.label })),
            test: (u, v) => u.role === v,
          },
          {
            key: 'status',
            label: 'Trạng thái',
            options: Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label })),
            test: (u, v) => u.status === v,
          },
        ]}
        onRowClick={(u) => router.visit(`/admin/users/${u.id}${q}`)}
        empty={{ icon: Users, title: 'Chưa có người dùng', desc: 'Thêm giảng viên, sinh viên hoặc quản trị viên cho tổ chức.' }}
        bulk={(ids) => {
          const deletable = ids.filter((id) => id !== currentUserId);
          return (
            <FxButton
              size="sm"
              icon={Trash2}
              className="text-danger-fg"
              onClick={async () => {
                const ok = await dialog.confirm({
                  title: `Xóa ${deletable.length} tài khoản đã chọn?`,
                  text: 'Tài khoản của bạn không nằm trong danh sách xóa.',
                  tone: 'danger',
                  confirmLabel: 'Xóa tất cả',
                });
                if (ok) deletable.forEach((id) => router.post(`/admin/users/${id}/delete${q}`, {}, { preserveScroll: true }));
              }}
            >
              Xóa {deletable.length} tài khoản
            </FxButton>
          );
        }}
        columns={[
          {
            key: 'name',
            label: 'Người dùng',
            width: 'minmax(240px,2.2fr)',
            render: (u) => (
              <div className="flex min-w-0 items-center gap-2.5">
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="size-8 shrink-0 rounded-full bg-muted object-cover" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(u.name)}</span>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {u.name}
                    {u.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(bạn)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
              </div>
            ),
          },
          { key: 'username', label: 'Tên đăng nhập', width: 'minmax(130px,1fr)', render: (u) => <span className="block truncate font-mono text-[13px]">{u.username}</span> },
          {
            key: 'role',
            label: 'Vai trò',
            width: '120px',
            render: (u) => {
              const r = USER_ROLE[u.role] ?? { label: u.role, tone: 'neutral' as const };
              return <Pill tone={r.tone}>{r.label}</Pill>;
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            width: '130px',
            render: (u) => {
              const s = USER_STATUS[u.status] ?? { label: u.status, tone: 'neutral' as const };
              return <Pill tone={s.tone}>{s.label}</Pill>;
            },
          },
          { key: 'created', label: 'Ngày tạo', width: '130px', render: (u) => <span className="font-mono text-xs text-muted-foreground">{u.created_at}</span> },
        ]}
        actions={(u) => (
          <>
            <IconButton icon={Eye} label="Xem" onClick={() => router.visit(`/admin/users/${u.id}${q}`)} />
            <IconButton icon={Pencil} label="Sửa" onClick={() => router.visit(`/admin/users/${u.id}/edit${q}`)} />
            <IconButton
              icon={Trash2}
              label="Xóa"
              danger
              disabled={u.id === currentUserId}
              className="disabled:opacity-30"
              onClick={async () => {
                const ok = await dialog.confirm({
                  title: `Xóa tài khoản “${u.name}”?`,
                  text: `Tài khoản ${u.username} sẽ không đăng nhập được nữa. Lịch sử làm bài của tài khoản cũng bị xóa.`,
                  tone: 'danger',
                  confirmLabel: 'Xóa tài khoản',
                });
                if (ok) router.post(`/admin/users/${u.id}/delete${q}`, {}, { preserveScroll: true });
              }}
            />
          </>
        )}
      />
    </div>
  );
}
