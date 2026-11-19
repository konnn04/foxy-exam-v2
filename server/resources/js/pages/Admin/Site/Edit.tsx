import React, { useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { ExternalLink, ImageIcon, Loader2, RotateCcw, Save, Upload } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { Field, FxButton, FxInput, FxTextarea, PageHeader, Panel, PanelTitle, Segmented, Switch } from '@/components/foxy/ui';
import { useDialog } from '@/components/foxy/dialogs';
import { TRANSLATIONS } from '@/constants/translations';
import { DEFAULT_TERMS } from '@/constants/terms';

type Kind = 'text' | 'area' | 'long' | 'url' | 'image' | 'bool';
interface FieldDef {
  key: string;
  label: string;
  kind: Kind;
  /** localized: stored as `<key>.vi` / `<key>.en` */
  loc?: boolean;
  hint?: string;
  /** built-in text shown as placeholder (what the site uses when the field is left empty) */
  builtin?: (lang: 'vi' | 'en') => string;
}

const T = (lang: 'vi' | 'en') => TRANSLATIONS[lang];

const METRIC_DEFAULTS = ['latency', 'ratio', 'cost', 'data'] as const;

const SECTIONS: { id: string; title: string; desc: string; fields: FieldDef[] }[] = [
  {
    id: 'brand',
    title: 'Thương hiệu',
    desc: 'Tên, logo và khẩu hiệu hiển thị ở đầu và chân mọi trang công khai.',
    fields: [
      { key: 'brand.name', label: 'Tên thương hiệu', kind: 'text' },
      { key: 'brand.badge', label: 'Nhãn cạnh tên (để trống nếu không cần)', kind: 'text' },
      { key: 'brand.logo', label: 'Logo', kind: 'image', hint: 'Ảnh vuông, nền trong suốt, tối thiểu 128×128.' },
      { key: 'brand.tagline', label: 'Khẩu hiệu dưới tên', kind: 'text', loc: true, builtin: (l) => (l === 'vi' ? 'Hệ thống Giám sát Thi cử Trực tuyến' : 'Smart Online Proctoring System') },
    ],
  },
  {
    id: 'banner',
    title: 'Dải thông tin trên cùng',
    desc: 'Thanh tối phía trên thanh điều hướng, thường ghi đơn vị chủ quản.',
    fields: [
      { key: 'banner.enabled', label: 'Hiện dải thông tin', kind: 'bool' },
      { key: 'banner.institution', label: 'Đơn vị', kind: 'text', loc: true, builtin: (l) => T(l).topBanner.institution },
      { key: 'banner.project', label: 'Tên dự án / chương trình', kind: 'text', loc: true, builtin: (l) => T(l).topBanner.project },
      { key: 'banner.faculty', label: 'Khoa / bộ phận (góc phải)', kind: 'text', loc: true, builtin: (l) => T(l).topBanner.faculty },
    ],
  },
  {
    id: 'hero',
    title: 'Trang chủ: phần đầu',
    desc: 'Tiêu đề và mô tả khách nhìn thấy đầu tiên.',
    fields: [
      { key: 'hero.badge', label: 'Nhãn nhỏ phía trên tiêu đề', kind: 'text', loc: true, builtin: (l) => T(l).landing.badge },
      { key: 'hero.title', label: 'Tiêu đề', kind: 'text', loc: true, builtin: (l) => T(l).landing.heroTitle },
      { key: 'hero.highlight', label: 'Dòng nhấn (chữ màu)', kind: 'text', loc: true, builtin: (l) => T(l).landing.heroTitleHighlight },
      { key: 'hero.description', label: 'Mô tả', kind: 'area', loc: true, builtin: (l) => T(l).landing.heroDesc },
    ],
  },
  {
    id: 'metrics',
    title: 'Trang chủ: bốn con số nổi bật',
    desc: 'Mỗi ô gồm một giá trị ngắn và một dòng giải thích.',
    fields: METRIC_DEFAULTS.flatMap((m, i): FieldDef[] => [
      { key: `metrics.${i + 1}.value`, label: `Ô ${i + 1}: giá trị`, kind: 'text', builtin: () => (T('vi').landing.metrics as Record<string, string>)[`${m}Num`] },
      { key: `metrics.${i + 1}.label`, label: `Ô ${i + 1}: giải thích`, kind: 'text', loc: true, builtin: (l) => (T(l).landing.metrics as Record<string, string>)[`${m}Label`] },
    ]),
  },
  {
    id: 'media',
    title: 'Hình ảnh & video',
    desc: 'Ảnh chụp giao diện dùng trên Trang chủ, Tính năng, Tải ứng dụng. Chưa có ảnh thì trang tự hiện khung minh hoạ.',
    fields: [
      { key: 'media.dashboard', label: 'Bảng điều khiển giám thị (ảnh đầu trang chủ)', kind: 'image' },
      { key: 'media.operator', label: 'Giám sát trực tiếp phòng thi', kind: 'image' },
      { key: 'media.kiosk', label: 'Màn hình làm bài của thí sinh', kind: 'image' },
      { key: 'media.phone', label: 'Camera phụ trên điện thoại', kind: 'image' },
      { key: 'media.report', label: 'Biên bản vi phạm', kind: 'image' },
      ...[1, 2, 3, 4, 5, 6].map((n): FieldDef => ({ key: `media.feature.${n}`, label: `Trang Tính năng: ảnh cho tính năng ${n}`, kind: 'image', hint: n === 1 ? 'Để trống để dùng ảnh mặc định của mục tương ứng.' : undefined })),
      { key: 'media.video_url', label: 'Video giới thiệu (đường dẫn nhúng)', kind: 'url', hint: 'Ví dụ: https://www.youtube.com/embed/… hoặc Google Drive …/preview. Để trống để ẩn mục video.' },
    ],
  },
  {
    id: 'contact',
    title: 'Liên hệ',
    desc: 'Hiển thị ở chân trang và nhận phiếu đăng ký thí điểm.',
    fields: [
      { key: 'contact.email', label: 'Email', kind: 'text' },
      { key: 'contact.phone', label: 'Hotline', kind: 'text' },
      { key: 'contact.phone_role', label: 'Chú thích hotline', kind: 'text', loc: true, builtin: (l) => T(l).footer.leaderRole },
      { key: 'contact.address', label: 'Địa chỉ', kind: 'text', loc: true, builtin: (l) => T(l).footer.address },
    ],
  },
  {
    id: 'legal',
    title: 'Điều khoản & chính sách dữ liệu',
    desc: 'Hiện trong cửa sổ xác nhận trước khi khách gửi thông tin liên hệ. Dòng bắt đầu bằng "## " là tiêu đề mục; để một dòng trống giữa các đoạn.',
    fields: [{ key: 'legal.terms', label: 'Nội dung điều khoản', kind: 'long', loc: true, builtin: (l) => DEFAULT_TERMS[l], hint: 'Nội dung mẫu đã được lưu sẵn, hãy nhờ bộ phận pháp lý rà soát trước khi công bố.' }],
  },
  {
    id: 'footer',
    title: 'Chân trang',
    desc: 'Mô tả ngắn và dòng pháp lý ở cuối mọi trang.',
    fields: [
      { key: 'footer.description', label: 'Mô tả', kind: 'area', loc: true, builtin: (l) => T(l).footer.brandDesc },
      { key: 'footer.badge', label: 'Dòng phụ dưới mô tả', kind: 'text', loc: true, builtin: (l) => T(l).footer.stemBadge },
      { key: 'footer.copyright', label: 'Bản quyền', kind: 'text', loc: true, builtin: (l) => T(l).footer.copyright },
      { key: 'footer.legal', label: 'Dòng pháp lý', kind: 'text', loc: true, builtin: (l) => T(l).footer.legalBadge },
    ],
  },
];

function xsrf(): string {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

interface Props {
  user: any;
  teams: TeamItem[];
  values: Record<string, string>;
  defaults: Record<string, string>;
}

function ImageField({ value, onChange, fallback }: { value: string; onChange: (v: string) => void; fallback: string }) {
  const dialog = useDialog();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/admin/site/upload', {
        method: 'POST',
        body,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.errors?.file?.[0] || json?.message || `Lỗi ${res.status}`);
      setBroken(false);
      onChange(json.url);
    } catch (e) {
      await dialog.alert({ title: 'Không tải được ảnh', text: (e as Error).message, tone: 'danger' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {value && !broken ? (
          <img src={value} alt="" className="size-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <FxInput value={value} onChange={(e) => { setBroken(false); onChange(e.target.value); }} placeholder="/duong-dan-anh hoặc https://…" mono />
        <div className="flex items-center gap-2">
          <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <FxButton size="sm" icon={busy ? Loader2 : Upload} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Đang tải…' : 'Tải ảnh lên'}
          </FxButton>
          {value !== fallback && (
            <button type="button" className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:underline" onClick={() => onChange(fallback)}>
              <RotateCcw className="size-3" /> Mặc định
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** White-label editor of the public website. Empty text = the built-in wording stays (shown as the placeholder). */
export default function SiteEdit({ user, teams, values: stored, defaults }: Props) {
  const initial = useMemo(
    () => ({ ...stored, 'legal.terms.vi': stored['legal.terms.vi'] || DEFAULT_TERMS.vi, 'legal.terms.en': stored['legal.terms.en'] || DEFAULT_TERMS.en }),
    [stored],
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);

  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));
  const val = (key: string) => values[key] ?? '';

  const save = () => {
    setSaving(true);
    // every known key is sent: the server drops values equal to the default / empty ones (= back to built-in text)
    router.post('/admin/site', { values }, { preserveScroll: true, onFinish: () => setSaving(false) });
  };

  const renderField = (f: FieldDef) => {
    const key = f.loc ? `${f.key}.${lang}` : f.key;
    const placeholder = f.builtin?.(lang) ?? defaults[key] ?? '';
    const label = f.loc ? `${f.label} (${lang === 'vi' ? 'Tiếng Việt' : 'English'})` : f.label;

    if (f.kind === 'bool') {
      return (
        <div key={key} className="flex items-center justify-between gap-3 rounded-[10px] bg-surface p-3">
          <span className="text-[13px] font-medium">{f.label}</span>
          <Switch checked={val(key) !== '0'} onChange={(on) => set(key, on ? '1' : '0')} label={f.label} />
        </div>
      );
    }
    return (
      <Field key={key} label={label} hint={f.hint}>
        {f.kind === 'image' ? (
          <ImageField value={val(key)} onChange={(v) => set(key, v)} fallback={defaults[key] ?? ''} />
        ) : f.kind === 'long' ? (
          <FxTextarea value={val(key)} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} rows={16} maxLength={20000} className="font-mono text-[12.5px]" />
        ) : f.kind === 'area' ? (
          <FxTextarea value={val(key)} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} maxLength={1000} />
        ) : (
          <FxInput value={val(key)} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} maxLength={f.kind === 'url' ? 500 : 255} />
        )}
      </Field>
    );
  };

  return (
    <AdminLayout user={user} teams={teams} currentTab="site" title="Nội dung website" breadcrumbs={[{ label: 'Nền tảng' }, { label: 'Nội dung website' }]}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Nội dung website"
          desc="Tuỳ chỉnh thương hiệu, văn bản, hình ảnh và liên hệ của trang công khai. Ô để trống sẽ dùng nội dung mặc định."
          actions={
            <>
              <a href="/" target="_blank" rel="noreferrer">
                <FxButton icon={ExternalLink}>Xem website</FxButton>
              </a>
              <FxButton variant="primary" icon={Save} disabled={saving || !dirty} onClick={save}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </FxButton>
            </>
          }
        />

        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground">Ngôn ngữ đang chỉnh:</span>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'vi', label: 'Tiếng Việt' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-2">
          {SECTIONS.map((s) => (
            <Panel key={s.id} className="flex flex-col gap-3.5">
              <PanelTitle title={s.title} desc={s.desc} />
              {s.fields.map(renderField)}
            </Panel>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
