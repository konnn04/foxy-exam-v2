/**
 * Create & edit forms for Tổ chức, Khóa học, Người dùng.
 * Each Create/Edit page pair renders the same component, so both always look identical.
 */
import { SaveBar, discardChanges, useDirty, useUnsavedGuard } from './save-bar';
import React, { useState } from 'react';
import { DateInput } from './datetime-input';
import { router } from '@inertiajs/react';
import { Building2, GraduationCap, Save, Shuffle, Trash2, UserPlus } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import type { NavTab } from '@/types/navigation';
import { Field, FxButton, FxInput, FxSelect, FxTextarea, PageHeader, Panel, PanelTitle, Pill, Segmented, Switch } from './ui';
import { ORG_STATUS, initials } from './domain';
import { useDialog } from './dialogs';
import { cn } from '@/lib/utils';

/** Frame shared by every entity form: header with save/delete, two-column body. */
function FormFrame({
  user,
  teams,
  activeTeam,
  tab,
  crumbs,
  backUrl,
  title,
  badges,
  desc,
  saveLabel,
  onSave,
  processing,
  onDelete,
  main,
  aside,
  edit = false,
  dirty = false,
}: {
  user: any;
  teams: TeamItem[];
  activeTeam?: TeamItem;
  tab: NavTab;
  crumbs: { label: string; href?: string }[];
  backUrl: string;
  title: string;
  badges?: React.ReactNode;
  desc?: React.ReactNode;
  saveLabel: string;
  onSave: () => void;
  processing: boolean;
  onDelete?: () => void;
  main: React.ReactNode;
  aside?: React.ReactNode;
  /** editing an existing record: the save button lives in a bar that appears only when something changed */
  edit?: boolean;
  dirty?: boolean;
}) {
  useUnsavedGuard(dirty);
  return (
    <AdminLayout user={user} teams={teams} activeTeam={activeTeam} currentTab={tab} title={title} breadcrumbs={crumbs}>
      <PageHeader
        onBack={() => router.visit(backUrl)}
        title={title}
        badges={badges}
        desc={desc}
        actions={
          <>
            {onDelete && (
              <FxButton icon={Trash2} className="text-danger-fg" onClick={onDelete}>
                Xóa
              </FxButton>
            )}
            {!edit && (
              <FxButton variant="primary" icon={Save} disabled={processing} onClick={onSave}>
                {saveLabel}
              </FxButton>
            )}
          </>
        }
      />
      <form
        className="flex flex-wrap items-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <div className="flex min-w-0 max-w-[880px] flex-[2_1_480px] flex-col gap-4">{main}</div>
        {aside && <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">{aside}</div>}
        <button type="submit" hidden />
      </form>
      {edit && <SaveBar visible={dirty} processing={processing} onSave={onSave} onCancel={discardChanges} saveLabel={saveLabel} />}
    </AdminLayout>
  );
}

const grid = (min = 200) => ({ gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))` });

/* ------------------------------------------------------------------ Tổ chức */

export interface OrgFormData {
  id: number;
  name: string;
  code: string;
  type: string;
  status: string;
  is_public?: boolean;
  plan_name?: string;
}
type PlanOpt = { id: number; name: string; display_name: string; max_exams_per_month?: number; has_ai_proctoring?: boolean };

const ORG_TYPES = [
  { value: 'UNIVERSITY', label: 'Đại học' },
  { value: 'CENTER', label: 'Trung tâm' },
  { value: 'INDIVIDUAL', label: 'Cá nhân' },
];

export function OrganizationForm({ user, teams, plans = [], organization }: { user: any; teams: TeamItem[]; plans?: PlanOpt[]; organization: OrgFormData | null }) {
  const [form, setForm] = useState({
    name: organization?.name ?? '',
    code: organization?.code ?? '',
    type: organization?.type ?? 'UNIVERSITY',
    status: organization?.status ?? 'ACTIVE',
    is_public: organization?.is_public ?? false,
    plan_name: (organization?.plan_name ?? 'PRO').toUpperCase(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const { dirty, markSaved } = useDirty(form);
  const dialog = useDialog();
  const removeOrg = async () => {
    if (!organization) return;
    const ok = await dialog.confirm({
      title: `Xóa tổ chức ${organization.name}?`,
      text: 'Toàn bộ giảng viên, sinh viên, kỳ thi và bằng chứng giám sát của tổ chức sẽ bị xóa. Cân nhắc Tạm khóa thay vì xóa.',
      tone: 'danger',
      requireText: organization.code,
      confirmLabel: 'Xóa vĩnh viễn',
      icon: Building2,
    });
    if (ok) router.post(`/admin/organizations/${organization.id}/delete`);
  };
  const isRoot = organization?.code === 'ROOT' || organization?.id === 1;

  const save = () => {
    setProcessing(true);
    router.post(organization ? `/admin/organizations/${organization.id}/update` : '/admin/organizations', form, {
      preserveScroll: true,
      onSuccess: () => organization && markSaved(),
      onError: setErrors,
      onFinish: () => setProcessing(false),
    });
  };

  const st = ORG_STATUS[form.status];
  return (
    <>
      <FormFrame
        user={user}
        teams={teams}
        tab="organizations"
        crumbs={[{ label: 'Tổ chức', href: '/admin/organizations' }, { label: organization ? organization.name : 'Thêm tổ chức' }]}
        backUrl={organization ? `/admin/organizations/${organization.id}` : '/admin/organizations'}
        title={organization ? 'Sửa tổ chức' : 'Thêm tổ chức'}
        badges={organization && st ? <Pill tone={st.tone}>{st.label}</Pill> : <Pill>Mới</Pill>}
        desc={organization ? 'Thay đổi gói cước có hiệu lực từ chu kỳ kế tiếp.' : 'Tạo tenant mới cho trường / trung tâm thuê nền tảng.'}
        saveLabel={organization ? 'Lưu thay đổi' : 'Tạo tổ chức'}
        onSave={save}
        processing={processing}
        edit={!!organization}
        dirty={dirty}
        onDelete={organization && !isRoot ? removeOrg : undefined}
        main={
          <>
            <Panel className="flex flex-col gap-3.5">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
                <Field label="Tên tổ chức" error={errors.name}>
                  <FxInput value={form.name} placeholder="VD: ĐH Khoa học Tự nhiên" onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Mã" error={errors.code}>
                  <FxInput
                    mono
                    value={form.code}
                    placeholder="KHTN"
                    disabled={isRoot}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) })}
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
              {organization && (
                <Field label="Trạng thái" error={errors.status}>
                  <Segmented
                    stretch
                    options={Object.entries(ORG_STATUS).map(([value, v]) => ({ value, label: v.label }))}
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                  />
                </Field>
              )}
            </Panel>
            <Panel className="flex flex-col gap-3">
              <PanelTitle title="Gói cước" desc="Quota kỳ thi mỗi tháng và tính năng giám sát" />
              <div className="grid gap-2" style={grid(150)}>
                {plans.map((p) => {
                  const on = form.plan_name === p.name.toUpperCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, plan_name: p.name.toUpperCase() })}
                      className={cn('flex cursor-pointer flex-col items-start gap-1 rounded-[10px] border p-3 text-left', on ? 'border-primary bg-primary/8' : 'border-border hover:border-foreground/20')}
                    >
                      <span className="text-sm font-bold">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.max_exams_per_month ? `${p.max_exams_per_month.toLocaleString('en')} kỳ thi / tháng` : p.display_name}
                        {p.has_ai_proctoring ? ' · giám sát AI' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.plan_name && <span className="text-xs text-danger-fg">{errors.plan_name}</span>}
            </Panel>
          </>
        }
        aside={
          <Panel className="flex flex-col gap-3">
            <PanelTitle title="Hiển thị" />
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Tổ chức công khai</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Hiện trong danh sách chọn trường trên FoxyClient</div>
              </div>
              <Switch checked={form.is_public} onChange={(v) => setForm({ ...form, is_public: v })} label="Công khai" />
            </div>
            {(errors.message || errors.form) && <span className="text-xs text-danger-fg">{errors.message || errors.form}</span>}
          </Panel>
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ Khóa học */

export interface CourseFormData {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  teacher_id?: number | null;
  organization_id?: number;
}

export function CourseForm({
  user,
  teams,
  teachers = [],
  organizations = [],
  course,
}: {
  user: any;
  teams: TeamItem[];
  teachers?: { id: number; name: string }[];
  organizations?: { id: number; name: string; code: string }[];
  course: CourseFormData | null;
}) {
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [form, setForm] = useState({
    name: course?.name ?? '',
    code: course?.code ?? '',
    description: course?.description ?? '',
    teacher_id: course?.teacher_id ?? teachers[0]?.id ?? user?.id,
    organization_id: course?.organization_id ?? user?.organization?.id,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const { dirty, markSaved } = useDirty(form);
  const dialog = useDialog();
  const removeCourse = async () => {
    if (!course) return;
    const ok = await dialog.confirm({
      title: `Xóa khóa học “${course.name}”?`,
      text: 'Khóa học bị xóa cùng danh sách ghi danh. Kỳ thi thuộc khóa cần được chuyển hoặc xóa trước.',
      tone: 'danger',
    });
    if (ok) router.post(`/admin/courses/${course.id}/delete`);
  };
  const teacher = teachers.find((t) => t.id === Number(form.teacher_id));

  const save = () => {
    setProcessing(true);
    router.post(course ? `/admin/courses/${course.id}/update` : '/admin/courses', form, { preserveScroll: true, onSuccess: () => course && markSaved(), onError: setErrors, onFinish: () => setProcessing(false) });
  };

  return (
    <>
      <FormFrame
        user={user}
        teams={teams}
        tab="courses"
        crumbs={[{ label: 'Khóa học', href: '/admin/courses' }, { label: course ? course.name : 'Thêm khóa học' }]}
        backUrl={course ? `/admin/courses/${course.id}` : '/admin/courses'}
        title={course ? 'Sửa khóa học' : 'Thêm khóa học'}
        badges={course ? <Pill tone="brand">{course.code}</Pill> : <Pill>Mới</Pill>}
        desc="Khóa học gom bộ đề, danh sách ghi danh và các kỳ thi của một môn."
        saveLabel={course ? 'Lưu thay đổi' : 'Tạo khóa học'}
        onSave={save}
        edit={!!course}
        dirty={dirty}
        processing={processing}
        onDelete={course ? removeCourse : undefined}
        main={
          <Panel className="flex flex-col gap-3.5">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
              <Field label="Mã khóa" error={errors.code}>
                <FxInput mono value={form.code} placeholder="CS163" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Tên khóa học" error={errors.name}>
                <FxInput value={form.name} placeholder="Cấu trúc dữ liệu & Giải thuật" onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-3.5" style={grid()}>
              <Field label="Giảng viên phụ trách" error={errors.teacher_id}>
                <FxSelect value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: Number(e.target.value) })}>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </FxSelect>
              </Field>
              {!course && isSuper && organizations.length > 1 && (
                <Field label="Tổ chức" error={errors.organization_id}>
                  <FxSelect value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: Number(e.target.value) })}>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.code} — {o.name}
                      </option>
                    ))}
                  </FxSelect>
                </Field>
              )}
            </div>
            <Field label="Mô tả" error={errors.description}>
              <FxTextarea rows={4} value={form.description ?? ''} placeholder="Nội dung, mục tiêu, hình thức đánh giá…" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </Panel>
        }
        aside={
          <Panel className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-primary/25">
              <GraduationCap className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{form.code || 'MÃ'} — {form.name || 'Tên khóa học'}</div>
              <div className="truncate text-xs text-muted-foreground">{teacher ? `GV: ${teacher.name}` : 'Chưa gán giảng viên'}</div>
            </div>
          </Panel>
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ Người dùng */

export interface UserFormData {
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
  organization_id?: number;
}

const ROLE_OPTS = [
  { value: 'STUDENT', label: 'Sinh viên', desc: 'Làm bài qua FoxyClient' },
  { value: 'TEACHER', label: 'Giảng viên', desc: 'Soạn đề, tạo kỳ thi, giám sát' },
  { value: 'ORG_ADMIN', label: 'Org Admin', desc: 'Quản trị toàn bộ tổ chức' },
  { value: 'SUPER_ADMIN', label: 'Root Admin', desc: 'Quản trị nền tảng' },
];
const randomAvatar = () => `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random().toString(36).slice(2, 9)}`;

export function UserForm({
  user,
  teams,
  currentScopeOrg,
  isRootContext,
  organizations = [],
  target,
}: {
  user: any;
  teams: TeamItem[];
  currentScopeOrg?: { id: number; name: string; code: string };
  isRootContext?: boolean;
  organizations?: { id: number; name: string; code: string }[];
  target: UserFormData | null;
}) {
  const scopeOrg = currentScopeOrg || user.organization;
  const [form, setForm] = useState({
    last_name: target?.last_name ?? '',
    middle_name: target?.middle_name ?? '',
    first_name: target?.first_name ?? '',
    name: target?.name ?? '',
    date_of_birth: target?.date_of_birth ?? '',
    address: target?.address ?? '',
    avatar: target?.avatar || randomAvatar(),
    username: target?.username ?? '',
    email: target?.email ?? '',
    password: '',
    role: target?.role ?? 'TEACHER',
    status: target?.status ?? 'ACTIVE',
    organization_id: target?.organization_id ?? scopeOrg.id,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const { dirty, markSaved } = useDirty(form);
  const dialog = useDialog();

  const isOrgRoot = (id: number) => {
    const o = organizations.find((x) => x.id === id);
    return o ? o.code === 'ROOT' || o.id === 1 : id === 1;
  };
  const canPickSuper = !!isRootContext && user.role === 'SUPER_ADMIN' && isOrgRoot(Number(form.organization_id));
  const roles = ROLE_OPTS.filter((r) => r.value !== 'SUPER_ADMIN' || canPickSuper);
  const backUrl = `/admin/users?org_id=${form.organization_id}`;
  const fullName = [form.last_name, form.middle_name, form.first_name].filter(Boolean).join(' ') || form.name;
  const isSelf = target?.id === user.id;
  const removeUser = async () => {
    if (!target) return;
    const ok = await dialog.confirm({
      title: `Xóa tài khoản “${target.name}”?`,
      text: `Tài khoản ${target.username} sẽ không đăng nhập được nữa. Lịch sử làm bài cũng bị xóa.`,
      tone: 'danger',
      confirmLabel: 'Xóa tài khoản',
    });
    if (ok) router.post(`/admin/users/${target.id}/delete?org_id=${form.organization_id}`);
  };

  const save = () => {
    setProcessing(true);
    const url = target ? `/admin/users/${target.id}/update?org_id=${form.organization_id}` : `/admin/users?org_id=${form.organization_id}`;
    router.post(url, { ...form, name: fullName || form.username }, { preserveScroll: true, onSuccess: () => target && markSaved(), onError: setErrors, onFinish: () => setProcessing(false) });
  };

  return (
    <>
      <FormFrame
        user={user}
        teams={teams}
        tab="users"
        crumbs={[{ label: 'Người dùng', href: backUrl }, { label: target ? target.name : 'Thêm người dùng' }]}
        backUrl={target ? `/admin/users/${target.id}?org_id=${form.organization_id}` : backUrl}
        title={target ? 'Sửa người dùng' : 'Thêm người dùng'}
        badges={target ? <Pill tone={form.status === 'ACTIVE' ? 'success' : 'danger'}>{form.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}</Pill> : <Pill>Mới</Pill>}
        desc={`Thuộc tổ chức ${organizations.find((o) => o.id === Number(form.organization_id))?.name ?? scopeOrg.name}`}
        saveLabel={target ? 'Lưu thay đổi' : 'Tạo tài khoản'}
        onSave={save}
        edit={!!target}
        dirty={dirty}
        processing={processing}
        onDelete={target && !isSelf ? removeUser : undefined}
        main={
          <>
            <Panel className="flex flex-col gap-3.5">
              <PanelTitle title="Hồ sơ" />
              <div className="grid gap-3" style={grid(150)}>
                <Field label="Họ" error={errors.last_name}>
                  <FxInput value={form.last_name ?? ''} placeholder="Nguyễn" onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </Field>
                <Field label="Tên đệm" error={errors.middle_name}>
                  <FxInput value={form.middle_name ?? ''} placeholder="Minh" onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
                </Field>
                <Field label="Tên" error={errors.first_name ?? errors.name}>
                  <FxInput value={form.first_name ?? ''} placeholder="Khoa" onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3" style={grid()}>
                <Field label="Ngày sinh" error={errors.date_of_birth}>
                  <DateInput value={form.date_of_birth || null} onChange={(v) => setForm({ ...form, date_of_birth: v })} />
                </Field>
                <Field label="Địa chỉ" error={errors.address}>
                  <FxInput value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </Field>
              </div>
            </Panel>
            <Panel className="flex flex-col gap-3.5">
              <PanelTitle title="Đăng nhập" />
              <div className="grid gap-3" style={grid()}>
                <Field label="Tên đăng nhập / MSSV" error={errors.username}>
                  <FxInput mono value={form.username} placeholder="22120187" onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <FxInput type="email" value={form.email} placeholder="ten@truong.edu.vn" onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              </div>
              <Field label={target ? 'Mật khẩu mới' : 'Mật khẩu'} error={errors.password} hint={target ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'}>
                <FxInput type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
            </Panel>
            <Panel className="flex flex-col gap-3">
              <PanelTitle title="Vai trò" />
              <div className="grid gap-2" style={grid(160)}>
                {roles.map((r) => {
                  const on = form.role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={isSelf}
                      onClick={() => setForm({ ...form, role: r.value })}
                      className={cn(
                        'flex cursor-pointer flex-col items-start gap-1 rounded-[10px] border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60',
                        on ? 'border-primary bg-primary/8' : 'border-border hover:border-foreground/20',
                      )}
                    >
                      <span className="text-sm font-semibold">{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.desc}</span>
                    </button>
                  );
                })}
              </div>
              {errors.role && <span className="text-xs text-danger-fg">{errors.role}</span>}
            </Panel>
          </>
        }
        aside={
          <>
            <Panel className="flex flex-col items-center gap-3 text-center">
              {form.avatar ? (
                <img src={form.avatar} alt="" className="size-20 rounded-full bg-muted object-cover" />
              ) : (
                <span className="flex size-20 items-center justify-center rounded-full bg-muted text-xl font-semibold">{initials(fullName)}</span>
              )}
              <div>
                <div className="font-semibold">{fullName || 'Họ và tên'}</div>
                <div className="font-mono text-xs text-muted-foreground">{form.username || 'username'}</div>
              </div>
              <FxButton size="sm" icon={Shuffle} onClick={() => setForm({ ...form, avatar: randomAvatar() })}>
                Đổi ảnh đại diện
              </FxButton>
            </Panel>
            <Panel className="flex flex-col gap-3.5">
              {user.role === 'SUPER_ADMIN' && organizations.length > 1 && (
                <Field label="Tổ chức" error={errors.organization_id}>
                  <FxSelect
                    value={form.organization_id}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setForm({ ...form, organization_id: id, role: !isOrgRoot(id) && form.role === 'SUPER_ADMIN' ? 'ORG_ADMIN' : form.role });
                    }}
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.code} — {o.name}
                      </option>
                    ))}
                  </FxSelect>
                </Field>
              )}
              {target && (
                <Field label="Trạng thái" error={errors.status}>
                  <Segmented
                    stretch
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                    options={[
                      { value: 'ACTIVE', label: 'Hoạt động' },
                      { value: 'SUSPENDED', label: 'Tạm khóa' },
                    ]}
                  />
                </Field>
              )}
              {!target && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserPlus className="size-3.5" />
                  Tài khoản mới ở trạng thái Hoạt động.
                </div>
              )}
              {errors.message && <span className="text-xs text-danger-fg">{errors.message}</span>}
            </Panel>
          </>
        }
      />
    </>
  );
}
