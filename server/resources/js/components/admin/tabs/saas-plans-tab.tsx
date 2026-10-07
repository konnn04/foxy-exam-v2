import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Check, CreditCard, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { PlanItem } from '@/types/admin';
import { Field, FxButton, FxInput, IconButton, Meter, Modal, PageHeader, Panel, PanelTitle, Pill, Segmented, ToggleList } from '@/components/foxy/ui';
import { useDialog } from '@/components/foxy/dialogs';
import { BillingTab } from './billing-tab';
import type { InvoiceItem } from '@/types/admin';
import { cn } from '@/lib/utils';

interface Quota {
  plan_name: string;
  exams_used: number;
  exams_limit: number;
  students_limit: number;
  has_ai: boolean;
  has_code_replay?: boolean;
}

interface SaasPlansTabProps {
  plans: PlanItem[];
  /** Platform context only (server capability `managePlans`). Everyone else gets a read-only quota view. */
  canManage: boolean;
  myOrgQuota?: Quota;
  currentOrgPlan?: string;
  invoices?: InvoiceItem[];
  isSuperAdmin?: boolean;
}

const money = (n: number) => (Number(n) === 0 ? '0 đ' : `${Number(n).toLocaleString('vi-VN')} đ`);
const EMPTY = { name: '', display_name: '', price: 990000, max_exams_per_month: 20, max_students_per_exam: 100, storage_limit_gb: 25, has_ai_proctoring: true, has_code_replay: true };

export function SaasPlansTab(props: SaasPlansTabProps) {
  return props.canManage ? <PlatformPlans {...props} /> : <OrganizationQuota {...props} />;
}

/* ------------------------------------------------------------ platform: manage plans + invoices */

function PlatformPlans({ plans, invoices = [], isSuperAdmin }: SaasPlansTabProps) {
  const dialog = useDialog();
  const [view, setView] = useState<'plans' | 'invoices'>('plans');
  const [editing, setEditing] = useState<PlanItem | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  const open = (plan: PlanItem | 'new') => {
    setErrors({});
    setForm(
      plan === 'new'
        ? EMPTY
        : {
            name: plan.name,
            display_name: plan.display_name,
            price: plan.price,
            max_exams_per_month: plan.max_exams_per_month,
            max_students_per_exam: plan.max_students_per_exam,
            storage_limit_gb: plan.storage_limit_gb,
            has_ai_proctoring: plan.has_ai_proctoring,
            has_code_replay: plan.has_code_replay,
          },
    );
    setEditing(plan);
  };

  const save = () => {
    setProcessing(true);
    const url = editing === 'new' ? '/admin/plans' : `/admin/plans/${(editing as PlanItem).id}/update`;
    router.post(url, form, {
      preserveScroll: true,
      onError: setErrors,
      onSuccess: () => {
        setEditing(null);
        dialog.toast.success(editing === 'new' ? 'Đã tạo gói cước' : 'Đã cập nhật gói cước');
      },
      onFinish: () => setProcessing(false),
    });
  };

  const remove = async (plan: PlanItem) => {
    const ok = await dialog.confirm({
      title: `Xóa gói “${plan.display_name}”?`,
      text: 'Các tổ chức đang dùng gói này cần được chuyển sang gói khác trước.',
      tone: 'danger',
      confirmLabel: 'Xóa gói',
    });
    if (ok) router.post(`/admin/plans/${plan.id}/delete`, {}, { preserveScroll: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Gói cước"
        desc="Cấu hình gói SaaS cho các tổ chức thuê nền tảng và theo dõi hóa đơn."
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'plans', label: `Gói cước (${plans.length})` },
                { value: 'invoices', label: `Hóa đơn (${invoices.length})` },
              ]}
            />
            {view === 'plans' && (
              <FxButton variant="primary" icon={Plus} onClick={() => open('new')}>
                Thêm gói
              </FxButton>
            )}
          </>
        }
      />

      {view === 'invoices' ? (
        <BillingTab invoices={invoices} isSuperAdmin={!!isSuperAdmin} />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
          {plans.map((p) => (
            <Panel key={p.id} className="flex flex-col gap-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs text-muted-foreground">{p.name}</div>
                  <div className="mt-0.5 font-semibold">{p.display_name}</div>
                </div>
                <IconButton icon={Pencil} label="Sửa" onClick={() => open(p)} />
                {p.name !== 'FREE' && <IconButton icon={Trash2} label="Xóa" danger onClick={() => remove(p)} />}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums">{money(p.price)}</span>
                <span className="text-xs text-muted-foreground">/ tháng</span>
              </div>
              <PlanFacts plan={p} />
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        width={640}
        title={editing === 'new' ? 'Thêm gói cước' : 'Sửa gói cước'}
        desc="Thay đổi áp dụng cho các tổ chức dùng gói từ chu kỳ kế tiếp."
        footer={
          <>
            <FxButton onClick={() => setEditing(null)}>Hủy</FxButton>
            <FxButton variant="primary" disabled={processing} onClick={save}>
              {editing === 'new' ? 'Tạo gói' : 'Lưu thay đổi'}
            </FxButton>
          </>
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
          <Field label="Mã gói" error={errors.name}>
            <FxInput mono value={form.name} disabled={editing !== 'new'} placeholder="PRO" onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Tên hiển thị" error={errors.display_name}>
            <FxInput value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
          <Field label="Giá / tháng" error={errors.price}>
            <FxInput type="number" min={0} suffix="đ" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </Field>
          <Field label="Kỳ thi tối đa / tháng" error={errors.max_exams_per_month}>
            <FxInput type="number" min={1} value={form.max_exams_per_month} onChange={(e) => setForm({ ...form, max_exams_per_month: Number(e.target.value) })} />
          </Field>
          <Field label="Thí sinh tối đa / kỳ" error={errors.max_students_per_exam}>
            <FxInput type="number" min={1} value={form.max_students_per_exam} onChange={(e) => setForm({ ...form, max_students_per_exam: Number(e.target.value) })} />
          </Field>
          <Field label="Dung lượng lưu trữ" error={errors.storage_limit_gb}>
            <FxInput type="number" min={1} suffix="GB" value={form.storage_limit_gb} onChange={(e) => setForm({ ...form, storage_limit_gb: Number(e.target.value) })} />
          </Field>
        </div>
        <ToggleList
          items={[
            { key: 'ai', label: 'Giám sát AI', desc: 'Xác thực khuôn mặt, phát hiện vật cấm', checked: form.has_ai_proctoring, onChange: (v) => setForm({ ...form, has_ai_proctoring: v }) },
            { key: 'replay', label: 'Phát lại Op-Log', desc: 'Phát lại quá trình gõ code của thí sinh', checked: form.has_code_replay, onChange: (v) => setForm({ ...form, has_code_replay: v }) },
          ]}
        />
      </Modal>
    </div>
  );
}

function PlanFacts({ plan }: { plan: Pick<PlanItem, 'max_exams_per_month' | 'max_students_per_exam' | 'storage_limit_gb' | 'has_ai_proctoring' | 'has_code_replay'> }) {
  const rows: [string, React.ReactNode][] = [
    ['Kỳ thi / tháng', plan.max_exams_per_month.toLocaleString('en')],
    ['Thí sinh / kỳ', plan.max_students_per_exam.toLocaleString('en')],
    ['Lưu trữ', `${plan.storage_limit_gb} GB`],
    ['Giám sát AI', <Flag on={plan.has_ai_proctoring} />],
    ['Phát lại Op-Log', <Flag on={plan.has_code_replay} />],
  ];
  return (
    <div className="flex flex-col">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-t border-border py-2 text-[13px]">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Flag({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-success-fg">
      <Check className="size-3.5" /> Có
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <X className="size-3.5" /> Không
    </span>
  );
}

/* ------------------------------------------------------------ organization: read-only quota */

function OrganizationQuota({ plans, myOrgQuota, currentOrgPlan }: SaasPlansTabProps) {
  const q = myOrgQuota;
  const used = q ? (q.exams_limit ? (q.exams_used / q.exams_limit) * 100 : 0) : 0;
  const current = plans.find((p) => p.display_name === q?.plan_name || p.name === currentOrgPlan);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Quota & Gói cước" desc="Gói dịch vụ và hạn mức sử dụng của tổ chức. Để nâng cấp gói, liên hệ quản trị nền tảng Foxy." />

      {q && (
        <Panel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <PanelTitle title={q.plan_name} desc="Gói đang kích hoạt" />
            <Pill tone="success">Hoạt động</Pill>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <div className="flex flex-col gap-2 bg-card px-4 py-3.5">
              <span className="text-xs text-muted-foreground">Kỳ thi đã tạo tháng này</span>
              <span className="font-mono text-lg font-semibold">
                {q.exams_used} <span className="text-sm text-muted-foreground">/ {q.exams_limit}</span>
              </span>
              <Meter value={used} />
            </div>
            <div className="flex flex-col gap-1 bg-card px-4 py-3.5">
              <span className="text-xs text-muted-foreground">Thí sinh tối đa / kỳ</span>
              <span className="font-mono text-lg font-semibold">{q.students_limit}</span>
            </div>
            <div className="flex flex-col gap-1 bg-card px-4 py-3.5">
              <span className="text-xs text-muted-foreground">Giám sát AI</span>
              <span className="text-[15px] font-semibold">
                <Flag on={q.has_ai} />
              </span>
            </div>
            <div className="flex flex-col gap-1 bg-card px-4 py-3.5">
              <span className="text-xs text-muted-foreground">Phát lại Op-Log</span>
              <span className="text-[15px] font-semibold">
                <Flag on={!!q.has_code_replay} />
              </span>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {plans.map((p) => {
          const on = current?.id === p.id;
          return (
            <Panel key={p.id} className={cn('flex flex-col gap-3', on && 'border-primary')}>
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 opacity-70" />
                <span className="flex-1 font-semibold">{p.display_name}</span>
                {on && <Pill tone="brand">Gói hiện tại</Pill>}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums">{money(p.price)}</span>
                <span className="text-xs text-muted-foreground">/ tháng</span>
              </div>
              <PlanFacts plan={p} />
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
