import React, { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Plus, Send, Trash2 } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import {
  Field,
  FxButton,
  FxInput,
  FxTextarea,
  IconButton,
  PageHeader,
  Panel,
  PanelBar,
  PanelTitle,
  Pill,
  Segmented,
  StepFooter,
  StepTabs,
  Switch,
} from '@/components/foxy/ui';
import { MarkdownPreview } from '@/components/foxy/markdown';
import type { TestCaseItem } from '@/types/questions';
import { cn } from '@/lib/utils';

interface ProblemPayload {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  allowed_languages: string[];
  starter_templates: Record<string, string>;
  updated_at?: string | null;
  test_cases: TestCaseItem[];
}

interface Props {
  user: any;
  teams: TeamItem[];
  questionSet: { id: number; name: string; code: string; course_name?: string | null };
  problem: ProblemPayload | null;
}

const STEPS = ['Thông tin', 'Đề bài', 'Mã khởi tạo', 'Testcase'];
const LANGS: { key: string; label: string; starter: string }[] = [
  {
    key: 'cpp',
    label: 'C++17',
    starter: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Viết lời giải ở đây\n    return 0;\n}',
  },
  {
    key: 'python',
    label: 'Python 3',
    starter: 'import sys\ninput = sys.stdin.readline\n\ndef main():\n    # Viết lời giải ở đây\n    pass\n\nif __name__ == "__main__":\n    main()',
  },
  {
    key: 'java',
    label: 'Java',
    starter: 'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        // Viết lời giải ở đây\n    }\n}',
  },
  { key: 'c', label: 'C', starter: '#include <stdio.h>\n\nint main(void) {\n    // Viết lời giải ở đây\n    return 0;\n}' },
];
const DIFFS = [
  { value: 'EASY', label: 'Dễ' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HARD', label: 'Khó' },
  { value: 'EXPERT', label: 'Rất khó' },
];
const EMPTY_STATEMENT =
  '## Tên bài\n\nMô tả bài toán…\n\n### Ràng buộc\n- 1 ≤ n ≤ 2·10^5\n\n### Input\nDòng 1: …\n\n### Output\nMột số nguyên — …\n\n```\n5 6\n1 5 3 3 2\n```';

export default function ProblemEditor({ user, teams, questionSet, problem }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    title: problem?.title ?? '',
    description: problem?.description ?? EMPTY_STATEMENT,
    difficulty: problem?.difficulty ?? 'MEDIUM',
    time_limit_ms: problem?.time_limit_ms ?? 1000,
    memory_limit_mb: problem?.memory_limit_mb ?? 256,
    allowed_languages: problem?.allowed_languages ?? ['cpp', 'python'],
    starter_templates: {
      ...Object.fromEntries(LANGS.map((l) => [l.key, l.starter])),
      ...(problem?.starter_templates ?? {}),
    } as Record<string, string>,
    test_cases: (problem?.test_cases?.length
      ? problem.test_cases
      : [
          { input_data: '', expected_output: '', is_sample: true, score_weight: 10 },
          { input_data: '', expected_output: '', is_sample: false, score_weight: 10 },
        ]) as TestCaseItem[],
  }));
  const [mdMode, setMdMode] = useState<'write' | 'split'>('split');
  const [lang, setLang] = useState(form.allowed_languages[0] ?? 'cpp');
  const [tSel, setTSel] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const patch = (p: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...p }));
    setDirty(true);
  };
  const setCase = (i: number, p: Partial<TestCaseItem>) => patch({ test_cases: form.test_cases.map((t, j) => (j === i ? { ...t, ...p } : t)) });

  const totals = useMemo(() => {
    const samples = form.test_cases.filter((t) => t.is_sample).length;
    return { samples, hidden: form.test_cases.length - samples, points: form.test_cases.reduce((n, t) => n + Number(t.score_weight || 0), 0) };
  }, [form.test_cases]);

  const done = [
    form.title.trim() ? 0 : -1,
    form.description.trim() ? 1 : -1,
    form.allowed_languages.length ? 2 : -1,
    form.test_cases.some((t) => t.input_data && t.expected_output) ? 3 : -1,
  ].filter((i) => i >= 0);

  const save = () => {
    if (!form.title.trim()) {
      setErrors({ title: 'Nhập tên bài.' });
      setStep(0);
      return;
    }
    setProcessing(true);
    router.post(
      `/admin/question-sets/${questionSet.id}/programming-problems`,
      {
        id: problem?.id ?? null,
        ...form,
        starter_templates: Object.fromEntries(form.allowed_languages.map((k) => [k, form.starter_templates[k] ?? ''])),
        test_cases: form.test_cases
          .filter((t) => t.input_data !== '' || t.expected_output !== '')
          .map((t) => ({ input_data: t.input_data, expected_output: t.expected_output, is_sample: t.is_sample, score_weight: t.score_weight })),
      },
      {
        preserveScroll: true,
        onError: (e) => {
          setErrors(e);
          if (e.title || e.difficulty || e.time_limit_ms || e.memory_limit_mb) setStep(0);
          else if (e.description) setStep(1);
        },
        onSuccess: () => {
          setDirty(false);
          if (!problem) router.visit(`/admin/question-sets/${questionSet.id}`);
        },
        onFinish: () => setProcessing(false),
      },
    );
  };

  const starter = form.starter_templates[lang] ?? '';
  const sel = form.test_cases[tSel] ?? form.test_cases[0];

  return (
    <AdminLayout
      user={user}
      teams={teams}
      currentTab="problem-banks"
      title="Soạn bài lập trình"
      breadcrumbs={[
        { label: 'Ngân hàng đề', href: '/admin/problem-banks' },
        { label: questionSet.name, href: `/admin/question-sets/${questionSet.id}` },
        { label: problem ? problem.title : 'Bài mới' },
      ]}
    >
      <PageHeader
        onBack={() => router.visit(`/admin/question-sets/${questionSet.id}`)}
        title={form.title || 'Bài toán mới'}
        badges={
          <>
            <Pill tone="brand">Lập trình</Pill>
            {dirty ? <Pill tone="warning">Chưa lưu</Pill> : problem ? <Pill tone="success">Đã lưu</Pill> : <Pill>Bản nháp</Pill>}
          </>
        }
        desc={
          <>
            {problem && <span className="font-mono">P-{problem.id}</span>}
            {problem && ' · '}Bộ đề: {questionSet.code} — {questionSet.name}
          </>
        }
        actions={
          <FxButton variant="primary" icon={Send} disabled={processing} onClick={save}>
            {problem ? 'Lưu thay đổi' : 'Tạo bài'}
          </FxButton>
        }
      />

      <StepTabs labels={STEPS} current={step} done={done} onChange={setStep} />

      {step === 0 && (
        <Panel className="flex max-w-[880px] flex-col gap-4">
          <Field label="Tên bài" error={errors.title}>
            <FxInput value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="VD: Đếm cặp có tổng bằng K" />
          </Field>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
            <Field label="Giới hạn thời gian" error={errors.time_limit_ms} hint="100 – 10 000 ms">
              <FxInput mono type="number" min={100} max={10000} suffix="ms" value={form.time_limit_ms} onChange={(e) => patch({ time_limit_ms: Number(e.target.value) })} />
            </Field>
            <Field label="Bộ nhớ" error={errors.memory_limit_mb} hint="16 – 1024 MB">
              <FxInput mono type="number" min={16} max={1024} suffix="MB" value={form.memory_limit_mb} onChange={(e) => patch({ memory_limit_mb: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Độ khó" error={errors.difficulty}>
            <Segmented stretch className="max-w-[420px]" options={DIFFS} value={form.difficulty} onChange={(v) => patch({ difficulty: v })} />
          </Field>
          <Field label="Ngôn ngữ cho phép" error={errors.allowed_languages}>
            <div className="flex flex-wrap gap-1.5">
              {LANGS.map((l) => {
                const on = form.allowed_languages.includes(l.key);
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() =>
                      patch({ allowed_languages: on ? form.allowed_languages.filter((k) => k !== l.key) : [...form.allowed_languages, l.key] })
                    }
                    className={cn(
                      'h-8 cursor-pointer rounded-lg border px-3 text-[13px] font-medium',
                      on ? 'border-primary/60 bg-primary/12 text-brand-fg' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {on ? '✓ ' : '+ '}
                    {l.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </Panel>
      )}

      {step === 1 && (
        <Panel padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 pl-4 pr-2">
            <span className="text-[13px] text-muted-foreground">Markdown · hiển thị cho thí sinh trong FoxyClient</span>
            <Segmented
              size="sm"
              value={mdMode}
              onChange={setMdMode}
              options={[
                { value: 'write', label: 'Soạn thảo' },
                { value: 'split', label: 'Chia đôi' },
              ]}
            />
          </div>
          <div className="flex flex-wrap">
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              spellCheck={false}
              className="min-h-[420px] flex-[1_1_360px] resize-y bg-transparent p-4 font-mono text-[13px] leading-[1.7] text-foreground/85 outline-none"
            />
            {mdMode === 'split' && (
              <div className="flex-[1_1_360px] border-l border-border p-5">
                <MarkdownPreview source={form.description} />
              </div>
            )}
          </div>
          {errors.description && <div className="border-t border-border px-4 py-2 text-xs text-danger-fg">{errors.description}</div>}
        </Panel>
      )}

      {step === 2 && (
        <Panel padded={false} className="overflow-hidden">
          <PanelBar>
            <PanelTitle title="Mã khởi tạo" desc="Thí sinh nhận khung này trong FoxyClient" />
          </PanelBar>
          <div className="flex border-b border-border px-2">
            {LANGS.filter((l) => form.allowed_languages.includes(l.key)).map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLang(l.key)}
                className={cn(
                  'h-10 cursor-pointer px-3 text-[13px] font-medium',
                  lang === l.key ? 'text-foreground shadow-[inset_0_-2px_0_var(--primary)]' : 'text-muted-foreground',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          {form.allowed_languages.includes(lang) ? (
            <div className="flex bg-code py-3 font-mono text-[13px] leading-[1.7]">
              <div className="select-none px-3 text-right text-muted-foreground/60">
                {starter.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={starter}
                onChange={(e) => patch({ starter_templates: { ...form.starter_templates, [lang]: e.target.value } })}
                spellCheck={false}
                rows={Math.max(10, starter.split('\n').length)}
                className="min-w-0 flex-1 resize-none whitespace-pre bg-transparent text-foreground/90 outline-none"
              />
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">Bật ít nhất một ngôn ngữ ở bước Thông tin.</div>
          )}
        </Panel>
      )}

      {step === 3 && (
        <div className="flex flex-wrap items-start gap-4">
          <Panel padded={false} className="min-w-0 flex-[2_1_460px] overflow-hidden">
            <PanelBar>
              <PanelTitle
                className="flex-1"
                title="Testcase"
                desc={`${totals.samples} mẫu · ${totals.hidden} ẩn · tổng ${totals.points} điểm`}
              />
              <FxButton
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  patch({ test_cases: [...form.test_cases, { input_data: '', expected_output: '', is_sample: false, score_weight: 10 }] });
                  setTSel(form.test_cases.length);
                }}
              >
                Thêm
              </FxButton>
            </PanelBar>
            <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,0.7fr)_64px_44px_30px] gap-2.5 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>#</span>
              <span>Input</span>
              <span>Output</span>
              <span>Loại</span>
              <span className="text-right">Điểm</span>
              <span />
            </div>
            {form.test_cases.map((t, i) => (
              <div
                key={i}
                onClick={() => setTSel(i)}
                className={cn(
                  'grid cursor-pointer grid-cols-[36px_minmax(0,1fr)_minmax(0,0.7fr)_64px_44px_30px] items-center gap-2.5 border-b border-border px-4 py-[9px] text-[13px] last:border-b-0',
                  i === tSel ? 'bg-muted/60' : 'hover:bg-surface',
                )}
              >
                <span className="font-mono text-muted-foreground">#{i + 1}</span>
                <span className="truncate font-mono text-foreground/85">{t.input_data.replace(/\n/g, ' / ') || '—'}</span>
                <span className="truncate font-mono text-foreground/85">{t.expected_output.replace(/\n/g, ' / ') || '—'}</span>
                <Pill tone={t.is_sample ? 'info' : 'neutral'} size="sm">
                  {t.is_sample ? 'Mẫu' : 'Ẩn'}
                </Pill>
                <span className="text-right">{t.score_weight}</span>
                <IconButton
                  icon={Trash2}
                  label="Xóa test"
                  danger
                  className="size-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    patch({ test_cases: form.test_cases.filter((_, j) => j !== i) });
                    setTSel(Math.max(0, Math.min(tSel, form.test_cases.length - 2)));
                  }}
                />
              </div>
            ))}
          </Panel>
          {sel && (
            <Panel className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Test #{tSel + 1}</span>
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  Test mẫu
                  <Switch checked={sel.is_sample} onChange={(v) => setCase(tSel, { is_sample: v })} label="Test mẫu" />
                </span>
              </div>
              <Field label={<span className="text-xs text-muted-foreground">input.txt</span>}>
                <FxTextarea className="bg-code font-mono text-[13px]" rows={5} value={sel.input_data} onChange={(e) => setCase(tSel, { input_data: e.target.value })} />
              </Field>
              <Field label={<span className="text-xs text-muted-foreground">output.txt</span>}>
                <FxTextarea className="bg-code font-mono text-[13px]" rows={3} value={sel.expected_output} onChange={(e) => setCase(tSel, { expected_output: e.target.value })} />
              </Field>
              <Field label="Điểm">
                <FxInput type="number" min={0} step={0.5} value={sel.score_weight} onChange={(e) => setCase(tSel, { score_weight: Number(e.target.value) })} />
              </Field>
            </Panel>
          )}
        </div>
      )}

      <StepFooter
        labels={STEPS}
        current={step}
        onChange={setStep}
        lastAction={
          <FxButton variant="primary" icon={Send} disabled={processing} onClick={save}>
            {problem ? 'Lưu thay đổi' : 'Tạo bài'}
          </FxButton>
        }
      />
    </AdminLayout>
  );
}
