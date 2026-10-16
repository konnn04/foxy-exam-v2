import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Check, Lock, LockOpen, ScanFace, Trash2, X } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { FxButton, IconButton, PageHeader, Pill, Segmented } from '@/components/foxy/ui';
import { FxList, useServerQuery } from '@/components/foxy/fx-list';
import { useDialog } from '@/components/foxy/dialogs';
import { Modal } from '@/components/foxy/ui';
import { formatDateTime } from '@/lib/datetime';
import type { ListMeta } from '@/components/admin/tabs/organizations-tab';

interface FaceRow {
  id: number;
  name: string;
  username: string;
  email: string;
  enrolled_at: string | null;
  locked: boolean;
  consent_at: string | null;
  consents: number;
  pending: boolean;
}

interface RequestRow {
  id: number;
  user_id: number;
  name: string;
  username: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  decided_by: string | null;
  at: string | null;
  decided_at: string | null;
}

interface Props {
  user: any;
  teams: TeamItem[];
  tab: 'faces' | 'requests';
  counts: { students: number; enrolled: number; locked: number; pending: number };
  rows: FaceRow[] | RequestRow[];
  listMeta: ListMeta;
}

const STATUS = { PENDING: { label: 'Chờ duyệt', tone: 'warning' }, APPROVED: { label: 'Đã duyệt', tone: 'success' }, REJECTED: { label: 'Từ chối', tone: 'danger' } } as const;

/** Reference faces of the whole organization: who has one, who is locked, bulk actions, and the change requests to decide. */
export default function FacesIndex({ user, teams, tab, counts, rows, listMeta }: Props) {
  const dialog = useDialog();
  const onQuery = useServerQuery(['rows', 'listMeta', 'counts']);
  const [photo, setPhoto] = useState<FaceRow | null>(null);

  const bulk = async (ids: number[], action: 'lock' | 'unlock' | 'delete', clear: () => void) => {
    if (action === 'delete') {
      const ok = await dialog.confirm({ title: `Xoá khuôn mặt của ${ids.length} sinh viên?`, text: 'Họ sẽ phải đăng ký lại trong phòng chờ trước khi thi có xác thực khuôn mặt.', tone: 'danger', confirmLabel: 'Xoá' });
      if (!ok) return;
    }
    router.post('/admin/faces/bulk', { ids, action }, { preserveScroll: true, onSuccess: clear });
  };

  const lockAll = async () => {
    const ok = await dialog.confirm({ title: 'Khoá tất cả khuôn mặt đã đăng ký?', text: 'Sinh viên không tự đổi được ảnh nữa. Nên làm trước mùa thi.', confirmLabel: 'Khoá tất cả' });
    if (ok) router.post('/admin/faces/lock-all', {}, { preserveScroll: true });
  };

  const decide = async (r: RequestRow, decision: 'approve' | 'reject') => {
    let note: string | null | undefined = '';
    if (decision === 'reject') {
      note = await dialog.prompt({ title: `Từ chối yêu cầu của ${r.name}`, label: 'Lý do (sinh viên sẽ thấy)', initial: '' });
      if (note === null) return;
    } else if (!(await dialog.confirm({ title: `Duyệt yêu cầu của ${r.name}?`, text: 'Khuôn mặt hiện tại được mở khoá để sinh viên đăng ký lại.', confirmLabel: 'Duyệt và mở khoá' }))) return;
    router.post(`/admin/faces/requests/${r.id}`, { decision, note }, { preserveScroll: true });
  };

  const stats: [string, number][] = [
    ['Sinh viên', counts.students],
    ['Đã đăng ký', counts.enrolled],
    ['Đã khoá', counts.locked],
    ['Chờ duyệt đổi', counts.pending],
  ];

  return (
    <AdminLayout user={user} teams={teams} currentTab="live" title="Khuôn mặt sinh viên" breadcrumbs={[{ label: 'Giám sát kỳ thi', href: '/admin/live' }, { label: 'Khuôn mặt' }]}>
      <PageHeader
        title="Khuôn mặt sinh viên"
        desc="Ảnh tham chiếu để xác thực danh tính khi thi. Mỗi lần đăng nhập sinh viên phải đồng ý chính sách sinh trắc học; lịch sử đồng ý nằm ở cột bên dưới."
        actions={
          <>
            <a href="/biometric-policy" target="_blank" rel="noreferrer">
              <FxButton>Chính sách</FxButton>
            </a>
            <FxButton icon={Lock} onClick={lockAll}>
              Khoá tất cả
            </FxButton>
          </>
        }
      />
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        {stats.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 bg-card px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="text-[22px] font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <Segmented
        value={tab}
        onChange={(v) => router.get('/admin/faces', v === 'requests' ? { tab: 'requests' } : {}, { replace: true })}
        options={[
          { value: 'faces', label: 'Khuôn mặt' },
          { value: 'requests', label: counts.pending ? `Yêu cầu đổi (${counts.pending})` : 'Yêu cầu đổi' },
        ]}
      />

      {tab === 'faces' ? (
        <FxList<FaceRow>
          rows={rows as FaceRow[]}
          server={{ total: listMeta.total, page: listMeta.page, lastPage: listMeta.last_page, perPage: listMeta.per_page, values: listMeta.filters, onQuery }}
          searchText={(r) => `${r.name} ${r.username}`}
          searchPlaceholder="Tìm theo tên, tên đăng nhập, email…"
          filters={[
            {
              key: 'state',
              label: 'Trạng thái',
              options: [
                { value: 'enrolled', label: 'Đã đăng ký' },
                { value: 'missing', label: 'Chưa đăng ký' },
                { value: 'locked', label: 'Đã khoá' },
                { value: 'unlocked', label: 'Đăng ký, chưa khoá' },
              ],
            },
          ]}
          empty={{ icon: ScanFace, title: 'Chưa có sinh viên' }}
          bulk={(ids, clear) => (
            <>
              <FxButton size="sm" icon={Lock} onClick={() => bulk(ids, 'lock', clear)}>
                Khoá
              </FxButton>
              <FxButton size="sm" icon={LockOpen} onClick={() => bulk(ids, 'unlock', clear)}>
                Mở khoá
              </FxButton>
              <FxButton size="sm" icon={Trash2} className="text-danger-fg" onClick={() => bulk(ids, 'delete', clear)}>
                Xoá
              </FxButton>
            </>
          )}
          columns={[
            {
              key: 'name',
              label: 'Sinh viên',
              width: 'minmax(220px,2fr)',
              render: (r) => (
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{r.username}</div>
                </div>
              ),
            },
            {
              key: 'face',
              label: 'Khuôn mặt',
              width: '150px',
              render: (r) =>
                r.enrolled_at ? (
                  <div className="flex items-center gap-1.5">
                    <Pill tone="success">Đã đăng ký</Pill>
                    {r.locked && <Lock className="size-3.5 text-muted-foreground" aria-label="Đã khoá" />}
                  </div>
                ) : (
                  <Pill tone="neutral">Chưa có</Pill>
                ),
            },
            { key: 'enrolled', label: 'Đăng ký lúc', width: '140px', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.enrolled_at ? formatDateTime(r.enrolled_at) : '—'}</span> },
            {
              key: 'consent',
              label: 'Đồng ý gần nhất',
              width: '170px',
              render: (r) => (
                <span className="font-mono text-xs text-muted-foreground">
                  {r.consent_at ? `${formatDateTime(r.consent_at)} · ${r.consents} lần` : 'chưa lần nào'}
                </span>
              ),
            },
            { key: 'req', label: 'Yêu cầu', width: '110px', render: (r) => (r.pending ? <Pill tone="warning">Chờ duyệt</Pill> : <span className="text-muted-foreground">—</span>) },
          ]}
          actions={(r) => (
            <>
              {r.enrolled_at && <IconButton icon={ScanFace} label="Xem ảnh" onClick={() => setPhoto(r)} />}
              <IconButton
                icon={r.locked ? LockOpen : Lock}
                label={r.locked ? 'Mở khoá' : 'Khoá'}
                disabled={!r.enrolled_at && !r.locked}
                onClick={() => router.post(`/admin/users/${r.id}/face/lock`, { locked: !r.locked }, { preserveScroll: true })}
              />
            </>
          )}
        />
      ) : (
        <FxList<RequestRow>
          rows={rows as RequestRow[]}
          server={{ total: listMeta.total, page: listMeta.page, lastPage: listMeta.last_page, perPage: listMeta.per_page, values: listMeta.filters, onQuery }}
          searchText={(r) => r.name}
          searchPlaceholder="Yêu cầu đổi khuôn mặt"
          filters={[
            {
              key: 'status',
              label: 'Trạng thái',
              options: [
                { value: 'PENDING', label: 'Chờ duyệt' },
                { value: 'APPROVED', label: 'Đã duyệt' },
                { value: 'REJECTED', label: 'Từ chối' },
              ],
            },
          ]}
          empty={{ icon: ScanFace, title: 'Không có yêu cầu nào' }}
          columns={[
            {
              key: 'name',
              label: 'Sinh viên',
              width: 'minmax(180px,1.4fr)',
              render: (r) => (
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{r.username}</div>
                </div>
              ),
            },
            { key: 'reason', label: 'Lý do', width: 'minmax(220px,2.4fr)', render: (r) => <span className="line-clamp-2 text-[13px]">{r.reason}</span> },
            { key: 'at', label: 'Gửi lúc', width: '140px', render: (r) => <span className="font-mono text-xs text-muted-foreground">{formatDateTime(r.at)}</span> },
            {
              key: 'status',
              label: 'Trạng thái',
              width: '150px',
              render: (r) => (
                <div className="flex flex-col gap-0.5">
                  <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                  {r.decided_by && <span className="truncate text-[11px] text-muted-foreground">{r.decided_by}</span>}
                </div>
              ),
            },
          ]}
          actions={(r) =>
            r.status === 'PENDING' ? (
              <>
                <IconButton icon={Check} label="Duyệt" onClick={() => decide(r, 'approve')} />
                <IconButton icon={X} label="Từ chối" danger onClick={() => decide(r, 'reject')} />
              </>
            ) : null
          }
        />
      )}

      <Modal open={photo !== null} onClose={() => setPhoto(null)} width={520} title={photo ? `Khuôn mặt của ${photo.name}` : ''}>
        {photo && <img src={`/admin/users/${photo.id}/face-photo`} alt={photo.name} className="max-h-[70vh] w-full rounded-lg bg-black object-contain" />}
      </Modal>
    </AdminLayout>
  );
}
