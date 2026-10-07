import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Building2, LogIn, Pencil, Plus, Trash2 } from 'lucide-react';
import type { OrganizationItem, PlanItem } from '@/types/admin';
import { Field, FxButton, FxInput, IconButton, Meter, Modal, PageHeader, Pill, Segmented } from '@/components/foxy/ui';
import { FxList, NameCell, useServerQuery } from '@/components/foxy/fx-list';
import { useDialog } from '@/components/foxy/dialogs';
import { ORG_STATUS, PLAN_TONE } from '@/components/foxy/domain';
import { cn } from '@/lib/utils';

export type OrganizationRow = OrganizationItem;

export interface ListMeta {
  total: number;
  page: number;
  last_page: number;
  per_page: number;
  filters: Record<string, string>;
}

interface OrganizationsTabProps {
  organizations: OrganizationRow[];
  plans?: PlanItem[];
  listMeta: ListMeta;
}

const ORG_TYPES = [
  { value: 'UNIVERSITY', label: 'Đại học' },
  { value: 'CENTER', label: 'Trung tâm' },
  { value: 'INDIVIDUAL', label: 'Cá nhân' },
];

type OrgForm = { name: string; code: string; type: string; plan_name: string; status: string; is_public: boolean };
const fmt = (n: number) => n.toLocaleString('en');
const BLANK: OrgForm = { name: '', code: '', type: 'UNIVERSITY', plan_name: 'PRO', status: 'ACTIVE', is_public: false };

/** Platform only: the partner organizations. Searched / filtered / paged on the server. */
export function OrganizationsTab({ organizations, plans = [], listMeta }: OrganizationsTabProps) {
  const dialog = useDialog();
  const onQuery = useServerQuery(['organizations', 'listMeta']);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<OrganizationRow | null>(null);
  const [form, setForm] = useState<OrgForm>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  // deep link: /admin/organizations?new=1 (also used by the switcher)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new')) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planOptions = plans.length ? plans : (['FREE', 'PRO', 'ENTERPRISE'].map((name) => ({ name, display_name: name })) as PlanItem[]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setErrors({});
    setModal(true);
  };
  const openEdit = (o: OrganizationRow) => {
    setEditing(o);
    setForm({
      name: o.name,
      code: o.code,
      type: o.type || 'UNIVERSITY',
      plan_name: (o.plan || o.active_plan_name || 'FREE').toUpperCase(),
      status: o.status || 'ACTIVE',
      is_public: !!o.is_public,
    });
    setErrors({});
    setModal(true);
  };
  const close = () => {
    setModal(false);
    if (window.location.search.includes('new=')) window.history.replaceState({}, '', window.location.pathname);
  };

  const save = () => {
    if (!form.name.trim() || !form.code.trim()) {
      setErrors({ form: 'Cần nhập Tên và Mã tổ chức.' });
      return;
    }
    setProcessing(true);
    router.post(editing ? `/admin/organizations/${editing.id}/update` : '/admin/organizations', form, {
      preserveScroll: true,
      onError: setErrors,
      onSuccess: () => {
        close();
        dialog.toast.success(editing ? `Đã cập nhật ${form.name}` : `Đã tạo tổ chức ${form.name}`);
      },
      onFinish: () => setProcessing(false),
    });
  };

  const remove = async (o: OrganizationRow) => {
    const ok = await dialog.confirm({
      title: `Xóa tổ chức ${o.name}?`,
      text: 'Toàn bộ giảng viên, sinh viên, kỳ thi và bằng chứng giám sát của tổ chức sẽ bị xóa. Cân nhắc Tạm khóa thay vì xóa.',
      tone: 'danger',
      requireText: o.code,
      confirmLabel: 'Xóa vĩnh viễn',
      icon: Building2,
    });
    if (ok) router.post(`/admin/organizations/${o.id}/delete`, {}, { preserveScroll: true, onSuccess: () => dialog.toast.success(`Đã xóa ${o.name}`) });
  };

  const enter = (o: OrganizationRow) => router.post('/admin/switch-organization', { org_id: o.id, redirect_to: '/admin' });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tổ chức đối tác"
        desc="Quản lý trường, trung tâm thuê nền tảng — gói cước, quota và trạng thái."
        actions={
          <FxButton variant="primary" icon={Plus} onClick={openCreate}>
            Thêm tổ chức
          </FxButton>
        }
      />

      <FxList
        rows={organizations}
        minWidth={940}
        searchText={(o) => `${o.name} ${o.code}`}
        searchPlaceholder="Tìm theo tên, mã, tên miền…"
        server={{
          total: listMeta.total,
          page: listMeta.page,
          lastPage: listMeta.last_page,
          perPage: listMeta.per_page,
          values: listMeta.filters,
          onQuery,
        }}
        filters={[
          { key: 'plan', label: 'Gói cước', options: planOptions.map((p) => ({ value: p.name.toUpperCase(), label: p.name })) },
          { key: 'status', label: 'Trạng thái', options: Object.entries(ORG_STATUS).map(([value, v]) => ({ value, label: v.label })) },
        ]}
        onRowClick={(o) => router.visit(`/admin/organizations/${o.id}`)}
        empty={{ icon: Building2, title: 'Không có tổ chức phù hợp', desc: 'Thử bỏ bớt bộ lọc hoặc thêm tổ chức mới.' }}
        columns={[
          { key: 'org', label: 'Tổ chức', width: 'minmax(220px,2fr)', render: (o) => <NameCell code={o.code} name={o.name} sub={`${(o.slug || o.code).toLowerCase()}.foxyexam.vn`} /> },
          {
            key: 'plan',
            label: 'Gói',
            width: '110px',
            render: (o) => {
              const p = (o.plan || o.active_plan_name || 'FREE').toUpperCase();
              return <Pill tone={PLAN_TONE[p] ?? 'neutral'}>{p}</Pill>;
            },
          },
          {
            key: 'quota',
            label: 'Quota kỳ thi / tháng',
            width: 'minmax(160px,1.3fr)',
            render: (o) => (
              <div className="flex flex-col gap-1.5 pr-4">
                <Meter value={o.exams_used ?? 0} max={o.exams_limit || 1} />
                <span className="font-mono text-xs text-muted-foreground">
                  {fmt(o.exams_used ?? 0)} / {o.exams_limit ? fmt(o.exams_limit) : '∞'}
                </span>
              </div>
            ),
          },
          { key: 'teachers', label: 'Giảng viên', width: '90px', render: (o) => <span className="tabular-nums">{o.teachers_count ?? 0}</span> },
          { key: 'live', label: 'Ca đang mở', width: '100px', render: (o) => <span className="tabular-nums">{o.live_exams_count ?? 0}</span> },
          {
            key: 'status',
            label: 'Trạng thái',
            width: '110px',
            render: (o) => {
              const s = ORG_STATUS[o.status] ?? { label: o.status, tone: 'neutral' as const };
              return <Pill tone={s.tone}>{s.label}</Pill>;
            },
          },
        ]}
        actions={(o) => (
          <>
            {o.code !== 'ROOT' && <IconButton icon={LogIn} label="Vào tổ chức này" onClick={() => enter(o)} />}
            <IconButton icon={Pencil} label="Sửa" onClick={() => openEdit(o)} />
            <IconButton icon={Trash2} label="Xóa" danger disabled={o.code === 'ROOT' || o.id === 1} className="disabled:opacity-30" onClick={() => remove(o)} />
          </>
        )}
      />

      <Modal
        open={modal}
        onClose={close}
        title={editing ? 'Sửa tổ chức' : 'Thêm tổ chức'}
        desc={editing ? 'Thay đổi gói cước có hiệu lực từ chu kỳ kế tiếp.' : 'Tạo tenant mới cho trường / trung tâm.'}
        footer={
          <>
            <FxButton onClick={close}>Hủy</FxButton>
            <FxButton variant="primary" onClick={save} disabled={processing}>
              {editing ? 'Lưu thay đổi' : 'Tạo tổ chức'}
            </FxButton>
          </>
        }
      >
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <Field label="Tên tổ chức" error={errors.name}>
            <FxInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: ĐH Khoa học Tự nhiên" />
          </Field>
          <Field label="Mã" error={errors.code}>
            <FxInput
              mono
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) })}
              placeholder="KHTN"
              className="uppercase"
            />
          </Field>
        </div>
        <Field label="Tên miền">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2.5">
            <span className="font-mono text-[13px]">{(form.code || 'ma-to-chuc').toLowerCase()}.foxyexam.vn</span>
            <span className="flex-1" />
            <span className="text-xs text-muted-foreground">tự cấp SSL (Caddy)</span>
          </div>
        </Field>
        <Field label="Loại hình" error={errors.type}>
          <Segmented stretch options={ORG_TYPES} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
        </Field>
        <Field label="Gói cước" error={errors.plan_name}>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            {planOptions.map((p) => {
              const on = form.plan_name === p.name.toUpperCase();
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setForm({ ...form, plan_name: p.name.toUpperCase() })}
                  className={cn('flex cursor-pointer flex-col items-start gap-1 rounded-[10px] border p-3 text-left', on ? 'border-primary bg-primary/8' : 'border-border hover:border-foreground/20')}
                >
                  <span className="text-sm font-bold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.max_exams_per_month ? `${fmt(p.max_exams_per_month)} kỳ thi / tháng` : p.display_name}
                    {p.has_ai_proctoring ? ' · giám sát AI' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
        {editing && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <Field label="Email Org Admin">
              <div className="flex h-9 items-center rounded-lg border border-border bg-surface px-2.5 text-sm text-muted-foreground">{editing.admin_email || 'Chưa có Org Admin'}</div>
            </Field>
            <Field label="Trạng thái" error={errors.status}>
              <Segmented stretch options={Object.entries(ORG_STATUS).map(([value, v]) => ({ value, label: v.label }))} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
            </Field>
          </div>
        )}
        {(errors.form || errors.message) && <span className="text-xs text-danger-fg">{errors.form || errors.message}</span>}
      </Modal>
    </div>
  );
}
