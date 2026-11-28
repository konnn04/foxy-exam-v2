import React, { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { CheckCircle2, Globe2, KeyRound, Loader2, Lock, PlugZap, RotateCcw, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { Field, FxButton, FxInput, FxSelect, PageHeader, Panel, PanelTitle, Pill, RadioCards, Segmented, Switch } from '@/components/foxy/ui';
import { DEFAULT_BANNED_APPS_LIST, OsPicker, PROHIBITED_DEFAULT } from '@/components/foxy/exam-form';

interface OrganizationData {
  id: number;
  name: string;
  code: string;
  type?: string;
  status?: string;
  is_public?: boolean;
}


type Policy = {
  prevent_tab_switch: boolean;
  prevent_paste: boolean;
  track_keystroke_dynamics: boolean;
  ai_face_check: boolean;
  ai_identity: boolean;
  ai_objects: boolean;
  require_mic: boolean;
  require_screen: boolean;
  extra_camera: 'off' | 'optional' | 'required';
  extra_camera_objects: boolean;
  extra_camera_spot_check: boolean;
  violation_clips: boolean;
  lock_device: boolean;
  offline_minutes: number;
  block_vm: boolean;
  block_virtual_camera: boolean;
  allowed_os: string[];
  max_paste_chars: number;
  prohibited_labels: string[];
  banned_apps: string[];
};

const SYSTEM_POLICY: Policy = {
  prevent_tab_switch: true,
  prevent_paste: true,
  track_keystroke_dynamics: true,
  ai_face_check: true,
  ai_identity: false,
  ai_objects: false,
  require_mic: false,
  require_screen: false,
  extra_camera: 'off',
  extra_camera_objects: false,
  extra_camera_spot_check: false,
  violation_clips: false,
  lock_device: true,
  offline_minutes: 5,
  block_vm: true,
  block_virtual_camera: true,
  allowed_os: [],
  max_paste_chars: 80,
  prohibited_labels: PROHIBITED_DEFAULT,
  banned_apps: DEFAULT_BANNED_APPS_LIST,
};

function PolicyRow({ label, desc, checked, onChange, disabled }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-[10px] bg-surface p-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked && !disabled} onChange={(v) => !disabled && onChange(v)} label={label} />
    </div>
  );
}

/** Default monitoring policy: what every NEW exam of this school starts with (existing exams are not touched). */
function PolicyPanel() {
  const saved = (usePage().props as { orgPolicy?: Partial<Policy> | null }).orgPolicy;
  const [p, setP] = useState<Policy>({ ...SYSTEM_POLICY, ...(saved ?? {}) });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => setP((x) => ({ ...x, [k]: v }));

  const save = (reset = false) => {
    setSaving(true);
    router.post('/admin/organization/policy', reset ? { reset: true, extra_camera: 'off' } : p, {
      preserveScroll: true,
      onSuccess: () => reset && setP(SYSTEM_POLICY),
      onFinish: () => setSaving(false),
    });
  };

  const camera = p.ai_face_check;
  const phone = p.extra_camera !== 'off';

  return (
    <Panel className="flex flex-col gap-3.5">
      <PanelTitle
        title="Chính sách giám sát mặc định"
        desc="Mỗi kỳ thi mới bắt đầu từ các lựa chọn này. Giảng viên vẫn chỉnh được cho từng kỳ thi; kỳ thi đã tạo không bị đổi."
        actions={
          <>
            <FxButton icon={RotateCcw} disabled={saving} onClick={() => save(true)}>
              Về mặc định hệ thống
            </FxButton>
            <FxButton variant="primary" icon={ShieldCheck} disabled={saving} onClick={() => save()}>
              {saving ? 'Đang lưu…' : 'Lưu chính sách'}
            </FxButton>
          </>
        }
      />
      <div className="grid gap-2.5 lg:grid-cols-2">
        <PolicyRow label="Khoá máy thí sinh" desc="Chặn phím tắt hệ thống, ứng dụng điều khiển từ xa và màn hình phụ." checked={p.lock_device} onChange={(v) => set('lock_device', v)} />
        <PolicyRow label="Chặn chuyển tab / rời cửa sổ" desc="Ghi nhận và cảnh báo khi thí sinh rời cửa sổ làm bài." checked={p.prevent_tab_switch} onChange={(v) => set('prevent_tab_switch', v)} />
        <PolicyRow label="Chặn dán nội dung lớn" desc={`Báo vi phạm khi dán quá ${p.max_paste_chars} ký tự.`} checked={p.prevent_paste} onChange={(v) => set('prevent_paste', v)} />
        <PolicyRow label="Theo dõi nhịp gõ phím" desc="Phát hiện nhập liệu giả lập hoặc dán tự động." checked={p.track_keystroke_dynamics} onChange={(v) => set('track_keystroke_dynamics', v)} />
        <PolicyRow label="Camera trước + AI khuôn mặt" desc="Bật webcam và kiểm tra người trong khung hình." checked={p.ai_face_check} onChange={(v) => set('ai_face_check', v)} />
        <PolicyRow label="Đối chiếu danh tính" desc="So khuôn mặt với ảnh đã đăng ký của sinh viên." checked={p.ai_identity} onChange={(v) => set('ai_identity', v)} disabled={!camera} />
        <PolicyRow label="Phát hiện vật dụng cấm" desc="Điện thoại, sách, laptop… trong khung hình camera trước." checked={p.ai_objects} onChange={(v) => set('ai_objects', v)} disabled={!camera} />
        <PolicyRow label="Yêu cầu micro" desc="Thí sinh phải bật micro khi thi." checked={p.require_mic} onChange={(v) => set('require_mic', v)} />
        <PolicyRow label="Chia sẻ màn hình" desc="Ghi lại màn hình trong suốt giờ thi." checked={p.require_screen} onChange={(v) => set('require_screen', v)} />
        <PolicyRow label="Chặn máy ảo" desc="VMware, VirtualBox, Hyper-V, QEMU… bị từ chối ở bước precheck. Điều khiển từ xa luôn bị chặn." checked={p.block_vm} onChange={(v) => set('block_vm', v)} />
        <PolicyRow label="Chặn camera ảo" desc="OBS Virtual Camera, ManyCam, DroidCam, NVIDIA Broadcast… không được làm camera thi." checked={p.block_virtual_camera} onChange={(v) => set('block_virtual_camera', v)} />
        <PolicyRow label="Quay clip quanh vi phạm" desc="Lưu khoảng 10 giây camera và màn hình làm bằng chứng." checked={p.violation_clips} onChange={(v) => set('violation_clips', v)} disabled={!camera && !p.require_screen} />
      </div>

      <div className="flex flex-col gap-2.5 rounded-[10px] bg-surface p-3">
        <div className="text-[13px] font-medium">Camera phụ (điện thoại)</div>
        <Segmented
          value={p.extra_camera}
          onChange={(v) => set('extra_camera', v)}
          options={[
            { value: 'off', label: 'Tắt' },
            { value: 'optional', label: 'Tuỳ chọn' },
            { value: 'required', label: 'Bắt buộc' },
          ]}
        />
        <div className="grid gap-2.5 lg:grid-cols-2">
          <PolicyRow label="Nhận diện vật cấm ở camera phụ" desc="Chạy AI trên hình từ điện thoại." checked={p.extra_camera_objects} onChange={(v) => set('extra_camera_objects', v)} disabled={!phone} />
          <PolicyRow label="Kiểm tra góc đặt điện thoại" desc="Yêu cầu giữ đúng góc quay trong lúc thi." checked={p.extra_camera_spot_check} onChange={(v) => set('extra_camera_spot_check', v)} disabled={!phone} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-[10px] bg-surface p-3">
        <div>
          <div className="text-[13px] font-medium">Hệ điều hành được phép</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Không chọn gì = cho phép tất cả.</div>
        </div>
        <OsPicker value={p.allowed_os} onChange={(v) => set('allowed_os', v)} />
      </div>

      <div className="grid gap-3 rounded-[10px] bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
        <div className="min-w-0">
          <div className="text-[13px] font-medium">Tự thu bài khi mất kết nối</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {p.offline_minutes > 0
              ? `Thí sinh mất kết nối hơn ${p.offline_minutes} phút thì bài được nộp với các câu đã lưu và ghi "Vắng thi". Nhập 0 để giám thị tự xử lý.`
              : 'Không tự thu khi mất kết nối; giám thị tự xử lý.'}{' '}
            Bài hết giờ luôn được thu tự động.
          </div>
        </div>
        <FxInput
          type="number"
          min={0}
          max={60}
          suffix="phút"
          aria-label="Số phút mất kết nối tối đa"
          value={p.offline_minutes}
          onChange={(e) => set('offline_minutes', Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
        />
      </div>
    </Panel>
  );
}

interface OrgAi {
  provider: 'gemini' | 'deepseek';
  model: string;
  enabled: boolean;
  has_key: boolean;
  key_hint: string | null;
}

const AI_PROVIDERS = {
  gemini: { label: 'Google Gemini', model: 'gemini-2.5-flash', note: 'Đọc được PDF scan và ảnh chụp đề (có OCR). Lấy khoá tại aistudio.google.com.', keyHint: 'AIza…' },
  deepseek: { label: 'DeepSeek', model: 'deepseek-chat', note: 'Chi phí thấp, chỉ đọc văn bản: Word và PDF có chữ. Lấy khoá tại platform.deepseek.com.', keyHint: 'sk-…' },
} as const;

/** The school's own AI key for "Tạo câu hỏi bằng AI". The key is encrypted on the server and never shown again. */
function AiPanel() {
  const saved = (usePage().props as { orgAi?: OrgAi | null }).orgAi;
  const [provider, setProvider] = useState<OrgAi['provider']>(saved?.provider ?? 'gemini');
  const [model, setModel] = useState(saved?.model ?? '');
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const meta = AI_PROVIDERS[provider];

  const save = (removeKey = false) => {
    setSaving(true);
    router.post('/admin/organization/ai', { provider, model, enabled, api_key: key || null, remove_key: removeKey }, {
      preserveScroll: true,
      onSuccess: () => {
        setKey('');
        setTest(null);
      },
      onFinish: () => setSaving(false),
    });
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const xsrf = decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] ?? '');
      const res = await fetch('/admin/organization/ai/test', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf, 'X-Requested-With': 'XMLHttpRequest' } });
      const body = await res.json().catch(() => ({}));
      setTest(res.ok && body.ok ? { ok: true, text: `Kết nối được (${body.model}).` } : { ok: false, text: body.message || `Lỗi ${res.status}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Panel className="flex flex-col gap-4">
      <PanelTitle
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-fg" /> Trợ lý AI soạn đề
          </span>
        }
        desc="Giảng viên tải giáo trình hoặc đề cũ lên, AI soạn câu hỏi nháp để duyệt. Trường dùng khoá API của mình; chi phí tính theo tài khoản của nhà cung cấp."
        actions={
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">{enabled ? 'Đang bật' : 'Đang tắt'}</span>
            <Switch checked={enabled} onChange={setEnabled} label="Bật Trợ lý AI" />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Nhà cung cấp">
          <RadioCards
            minWidth={200}
            value={provider}
            onChange={(v) => {
              setProvider(v);
              setModel('');
            }}
            options={(Object.keys(AI_PROVIDERS) as OrgAi['provider'][]).map((k) => ({ value: k, label: AI_PROVIDERS[k].label, desc: AI_PROVIDERS[k].note }))}
          />
        </Field>
        <div className="flex flex-col gap-4">
          <Field
            label="Khoá API"
            hint={saved?.has_key && saved.provider === provider ? `Đã lưu khoá ${saved.key_hint}. Để trống nếu không đổi.` : 'Khoá được mã hoá trên máy chủ và không hiển thị lại.'}
            aside={
              saved?.has_key ? (
                <button type="button" className="cursor-pointer text-danger-fg hover:underline" onClick={() => save(true)}>
                  Xoá khoá
                </button>
              ) : undefined
            }
          >
            <FxInput type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={meta.keyHint} mono />
          </Field>
          <Field label="Mô hình" optional hint={`Để trống để dùng ${meta.model}.`}>
            <FxInput mono value={model} onChange={(e) => setModel(e.target.value.trim())} placeholder={meta.model} />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {test && (
          <span className={`flex min-w-0 flex-1 items-center gap-1.5 text-[13px] ${test.ok ? 'text-success-fg' : 'text-danger-fg'}`} role="status">
            {test.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <KeyRound className="size-4 shrink-0" />} {test.text}
          </span>
        )}
        {!test && <span className="flex-1" />}
        <FxButton icon={testing ? Loader2 : PlugZap} disabled={testing || !saved?.has_key} onClick={runTest} title={saved?.has_key ? undefined : 'Lưu khoá trước rồi kiểm tra'}>
          Kiểm tra kết nối
        </FxButton>
        <FxButton variant="primary" icon={Save} disabled={saving} onClick={() => save()}>
          {saving ? 'Đang lưu…' : 'Lưu cấu hình AI'}
        </FxButton>
      </div>
    </Panel>
  );
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
          <Field label="Tên tổ chức" required error={errors.name}>
            <FxInput value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Trường Đại học Mở TP.HCM" />
          </Field>
          <Field
            label="Mã tổ chức"
            required
            aside={
              <span className="flex items-center gap-3">
                <button type="button" onClick={codeFromName} className="flex cursor-pointer items-center gap-1 text-brand-fg hover:underline">
                  <Sparkles className="size-3" /> Tạo từ tên
                </button>
                <button type="button" onClick={randomCode} className="cursor-pointer text-muted-foreground hover:underline">
                  Ngẫu nhiên
                </button>
              </span>
            }
            hint="Viết hoa, không dấu, không khoảng trắng."
            error={errors.code}
          >
            <FxInput className="font-mono font-semibold uppercase tracking-wider" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VD: OU" />
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

      <PolicyPanel />
      <AiPanel />
    </div>
  );
}
