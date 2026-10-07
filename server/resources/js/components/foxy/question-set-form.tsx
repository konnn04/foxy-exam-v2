import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Code, ListChecks, Send } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { Field, FxButton, FxInput, FxSelect, FxTextarea, PageHeader, Panel, PanelTitle, Pill } from './ui';
import { cn } from '@/lib/utils';

export interface QuestionSetCreateProps {
  user: any;
  teams: TeamItem[];
  courses: { id: number; name: string; code: string }[];
  defaultCourseId?: number | null;
}

const META = {
  CLASSICAL: {
    title: 'Tạo bộ đề phổ thông',
    label: 'Phổ thông',
    tone: 'info' as const,
    icon: ListChecks,
    chip: 'bg-info/25',
    codePh: 'EN-B1-03',
    namePh: 'Tiếng Anh B1 — Đề 03',
    descPh: '4 kỹ năng: Nghe – Đọc – Viết – Nói, cấu trúc theo khung B1.',
    next: 'Sau khi tạo, bạn soạn câu hỏi trong trình soạn bộ đề.',
  },
  PROGRAMMING: {
    title: 'Tạo bộ bài lập trình',
    label: 'Lập trình',
    tone: 'brand' as const,
    icon: Code,
    chip: 'bg-primary/25',
    codePh: 'CS163-MID',
    namePh: 'Giữa kỳ CTDL & Giải thuật',
    descPh: 'Hashing, hai con trỏ, đồ thị cơ bản.',
    next: 'Sau khi tạo, bạn được chuyển thẳng tới trình soạn bài toán đầu tiên.',
  },
};

/** Shared body of the two "create question set" pages. */
export function QuestionSetCreateForm({
  type,
  page,
  aside,
}: {
  type: 'CLASSICAL' | 'PROGRAMMING';
  page: QuestionSetCreateProps;
  aside: React.ReactNode;
}) {
  const m = META[type];
  const [form, setForm] = useState({
    name: '',
    code: '',
    course_id: (page.defaultCourseId ?? '') as number | '',
    description: '',
    max_score: type === 'CLASSICAL' ? 10 : 100,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  const submit = (status: 'DRAFT' | 'PUBLISHED' = 'DRAFT') => {
    setProcessing(true);
    router.post(
      '/admin/question-sets',
      { ...form, course_id: form.course_id || null, type, status },
      { onError: setErrors, onFinish: () => setProcessing(false) },
    );
  };

  return (
    <AdminLayout
      user={page.user}
      teams={page.teams}
      currentTab="problem-banks"
      title={m.title}
      breadcrumbs={[{ label: 'Ngân hàng đề', href: '/admin/problem-banks' }, { label: m.title }]}
    >
      <PageHeader
        onBack={() => router.visit('/admin/problem-banks')}
        title={m.title}
        badges={
          <>
            <Pill tone={m.tone}>{m.label}</Pill>
            <Pill>Bản nháp</Pill>
          </>
        }
        desc={m.next}
        actions={
          <>
            <FxButton variant="primary" icon={Send} disabled={processing} onClick={() => submit('DRAFT')}>
              {type === 'PROGRAMMING' ? 'Tạo & soạn bài đầu tiên' : 'Tạo & soạn câu hỏi'}
            </FxButton>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <Panel className="flex min-w-0 max-w-[880px] flex-[2_1_480px] flex-col gap-3.5">
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)' }}>
            <Field label="Mã bộ đề" error={errors.code}>
              <FxInput mono value={form.code} placeholder={m.codePh} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Tên bộ đề" error={errors.name}>
              <FxInput value={form.name} placeholder={m.namePh} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <Field label="Môn học" error={errors.course_id}>
              <FxSelect value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">Dùng chung toàn trường</option>
                {page.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </FxSelect>
            </Field>
            <Field label="Điểm tối đa" error={errors.max_score} hint={type === 'PROGRAMMING' ? 'Thường 100 điểm / bài' : 'Thang điểm của cả bộ đề'}>
              <FxInput type="number" min={0} step={0.5} value={form.max_score} onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Mô tả" error={errors.description} hint="Hiển thị trong ngân hàng đề">
            <FxTextarea rows={3} value={form.description} placeholder={m.descPh} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {errors.type && <span className="text-xs text-danger-fg">{errors.type}</span>}
        </Panel>

        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <Panel className="flex items-start gap-3.5">
            <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-[10px]', m.chip)}>
              <m.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold">Bộ đề {m.label.toLowerCase()}</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                Muốn tạo loại khác?{' '}
                <button
                  type="button"
                  className="cursor-pointer text-brand-fg hover:underline"
                  onClick={() => router.visit(`/admin/question-sets/new/${type === 'CLASSICAL' ? 'programming' : 'classical'}`)}
                >
                  {type === 'CLASSICAL' ? 'Bộ bài lập trình' : 'Bộ đề phổ thông'}
                </button>
              </div>
            </div>
          </Panel>
          {aside}
        </div>
      </div>
    </AdminLayout>
  );
}

export function FeatureList({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <Panel className="flex flex-col gap-3">
      <PanelTitle title={title} />
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 border-t border-border pt-3 first-of-type:border-0">
          <span className="text-[13px] font-medium">{k}</span>
          <span className="text-xs text-muted-foreground">{v}</span>
        </div>
      ))}
    </Panel>
  );
}
