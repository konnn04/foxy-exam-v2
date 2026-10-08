import { formatDateTime } from '@/lib/datetime';
import React from 'react';
import { router } from '@inertiajs/react';
import { Check, Receipt } from 'lucide-react';
import type { InvoiceItem } from '@/types/admin';
import { FxButton, Panel, Pill, type Tone } from '@/components/foxy/ui';
import { FxList, NameCell } from '@/components/foxy/fx-list';
import { useDialog } from '@/components/foxy/dialogs';

interface BillingTabProps {
  invoices: InvoiceItem[];
  isSuperAdmin: boolean;
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
  CANCELLED: { label: 'Đã hủy', tone: 'outline' },
  REFUNDED: { label: 'Hoàn tiền', tone: 'info' },
};
const METHOD: Record<string, string> = { VNPAY: 'VNPAY', MOMO: 'MoMo', BANK_TRANSFER: 'Chuyển khoản', CREDIT_CARD: 'Thẻ tín dụng' };
const money = (n: number) => `${Number(n).toLocaleString('vi-VN')} đ`;

/** Platform invoice ledger. */
export function BillingTab({ invoices }: BillingTabProps) {
  const dialog = useDialog();
  const paid = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + Number(i.amount), 0);
  const pending = invoices.filter((i) => i.status === 'PENDING').reduce((s, i) => s + Number(i.amount), 0);

  const confirmPayment = async (inv: InvoiceItem) => {
    const ok = await dialog.confirm({
      title: `Xác nhận thu tiền hóa đơn ${inv.invoice_code}?`,
      text: `${inv.organization_name} · ${money(inv.amount)}. Hóa đơn chuyển sang trạng thái Đã thanh toán.`,
      confirmLabel: 'Xác nhận đã thu',
    });
    if (ok) router.post(`/admin/invoices/${inv.id}/confirm`, {}, { preserveScroll: true, onSuccess: () => dialog.toast.success('Đã ghi nhận thanh toán') });
  };

  const showDetail = (inv: InvoiceItem) =>
    dialog.alert({
      title: `Hóa đơn ${inv.invoice_code}`,
      text: (
        <span className="flex flex-col gap-1">
          <span>
            {inv.organization_name} · {inv.plan_name}
          </span>
          <span>Số tiền: {money(inv.amount)}</span>
          <span>Phương thức: {METHOD[inv.payment_method] ?? inv.payment_method}</span>
          {inv.transaction_id && <span className="font-mono">Mã GD: {inv.transaction_id}</span>}
          <span>Ghi chú: {inv.notes || 'Không có'}</span>
        </span>
      ),
      okLabel: 'Đóng',
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        {[
          ['Đã thu', money(paid)],
          ['Chờ thanh toán', money(pending)],
          ['Số hóa đơn', invoices.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex flex-col gap-1 bg-card px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{k}</span>
            <span className="text-xl font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <FxList
        rows={invoices}
        minWidth={820}
        searchText={(i) => `${i.invoice_code} ${i.organization_name} ${i.organization_code} ${i.transaction_id ?? ''}`}
        searchPlaceholder="Tìm theo mã hóa đơn, tổ chức…"
        filters={[
          {
            key: 'status',
            label: 'Trạng thái',
            options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
            test: (i, v) => i.status === v,
          },
        ]}
        empty={{ icon: Receipt, title: 'Chưa có hóa đơn' }}
        onRowClick={showDetail}
        columns={[
          { key: 'code', label: 'Hóa đơn', width: 'minmax(180px,1.4fr)', render: (i) => <NameCell code={i.organization_code} name={i.invoice_code} sub={i.organization_name} /> },
          { key: 'plan', label: 'Gói', width: 'minmax(120px,1fr)', render: (i) => <span className="block truncate text-muted-foreground">{i.plan_name}</span> },
          { key: 'amount', label: 'Số tiền', width: '130px', render: (i) => <span className="font-medium tabular-nums">{money(i.amount)}</span> },
          { key: 'method', label: 'Phương thức', width: '120px', render: (i) => <span className="text-muted-foreground">{METHOD[i.payment_method] ?? i.payment_method}</span> },
          {
            key: 'status',
            label: 'Trạng thái',
            width: '130px',
            render: (i) => {
              const s = STATUS[i.status] ?? { label: i.status, tone: 'neutral' as const };
              return <Pill tone={s.tone}>{s.label}</Pill>;
            },
          },
          { key: 'created', label: 'Ngày tạo', width: '130px', render: (i) => <span className="font-mono text-xs text-muted-foreground">{formatDateTime(i.created_at)}</span> },
        ]}
        actionsWidth="150px"
        actions={(i) =>
          i.status === 'PENDING' ? (
            <FxButton size="sm" icon={Check} onClick={() => confirmPayment(i)}>
              Đã thu
            </FxButton>
          ) : null
        }
      />
      <Panel className="p-3 text-center text-xs text-muted-foreground">Hiển thị tối đa 200 hóa đơn gần nhất.</Panel>
    </div>
  );
}
