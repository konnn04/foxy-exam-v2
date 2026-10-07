import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Globe2, Lock, Save, Sparkles } from 'lucide-react';
import { Field, FxButton, FxInput, FxSelect, PageHeader, Panel, PanelTitle, Pill, Switch } from '@/components/foxy/ui';

interface OrganizationData {
  id: number;
  name: string;
  code: string;
  type?: string;
  status?: string;
  is_public?: boolean;
}

/** Cài đặt tổ chức — same page anatomy as the other admin screens (PageHeader + Panels). */
export function SettingsTab({ organization }: { organization: OrganizationData }) {
  const [name, setName] = useState(organization.name || '');
  const [code, setCode] = useState(organization.code || '');
  const [type, setType] = useState(organization.type || 'UNIVERSITY');
  const [isPublic, setIsPublic] = useState(Boolean(organization.is_public));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const codeFromName = () => {
    if (!name.trim()) return;
    const initials = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    setCode(initials.length < 3 ? name.substring(0, 4).toUpperCase() : initials);
  };

  const randomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    setCode('ORG-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
  };

  const save = () => {
    setSaving(true);
    setErrors({});
    router.post(
      '/admin/organization/settings',
      { name, code: code.trim().toUpperCase(), type, is_public: isPublic },
      { preserveScroll: true, onError: setErrors, onFinish: () => setSaving(false) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cài đặt tổ chức"
        desc="Thông tin định danh và chế độ hiển thị của tổ chức trên ứng dụng FoxyClient."
        badges={
          <Pill tone={isPublic ? 'success' : 'warning'}>
            {isPublic ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
            {isPublic ? 'Công khai' : 'Riêng tư'}
          </Pill>
        }
        actions={
          <FxButton variant="primary" icon={Save} disabled={saving} onClick={save}>
            {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
          </FxButton>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <Panel className="flex max-w-[640px] flex-[1_1_420px] flex-col gap-3.5">
          <PanelTitle title="Thông tin định danh" desc="Mã tổ chức dùng cùng tên đăng nhập và mật khẩu để sinh viên vào phòng thi." />
          <Field label="Tên tổ chức" error={errors.name}>
            <FxInput value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Trường ĐH Khoa học Tự nhiên" />
          </Field>
          <Field
            label={
              <span className="flex items-center justify-between gap-2">
                Mã tổ chức
                <span className="flex items-center gap-2 text-xs font-normal">
                  <button type="button" onClick={codeFromName} className="flex cursor-pointer items-center gap-1 text-brand-fg hover:underline">
                    <Sparkles className="size-3" /> Tạo từ tên
                  </button>
                  <button type="button" onClick={randomCode} className="cursor-pointer text-muted-foreground hover:underline">
                    Ngẫu nhiên
                  </button>
                </span>
              </span>
            }
            hint="Viết hoa, không dấu, không khoảng trắng."
            error={errors.code}
          >
            <FxInput className="font-mono font-semibold uppercase tracking-wider" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VD: HCMUS" />
          </Field>
          <Field label="Loại hình" error={errors.type}>
            <FxSelect value={type} onChange={(e) => setType(e.target.value)}>
              <option value="UNIVERSITY">Đại học / Học viện</option>
              <option value="CENTER">Trung tâm đào tạo / Cao đẳng</option>
              <option value="INDIVIDUAL">Giảng viên độc lập / Cá nhân</option>
            </FxSelect>
          </Field>
        </Panel>

        <Panel className="flex flex-[1_1_320px] flex-col gap-3.5">
          <PanelTitle title="Hiển thị trên FoxyClient" desc="Sinh viên có thấy trường trong danh sách chọn nhanh hay không." />
          <div className="flex items-start gap-3 rounded-[10px] bg-surface p-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">Tổ chức công khai</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {isPublic
                  ? 'Trường xuất hiện trong danh sách; sinh viên chỉ cần chọn trường và nhập MSSV.'
                  : `Trường bị ẩn; sinh viên phải chọn “Nhập mã tổ chức” và điền đúng mã (${code || '…'}).`}
              </div>
            </div>
            <Switch checked={isPublic} onChange={setIsPublic} label="Tổ chức công khai" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
