import React, { useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Check, ClipboardCopy, FileText, Loader2, Settings2, Sparkles, Upload, X } from 'lucide-react';
import { Field, FxButton, FxInput, FxSelect, FxTextarea, Modal, Pill, Segmented } from './ui';
import { useDialog } from './dialogs';
import { DOC_ACCEPT, extractText, isImage, isPdf } from '@/lib/documents';
import { DIFFICULTY } from './domain';
import { cn } from '@/lib/utils';

type AiKind = 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'essay';
const KIND_LABEL: Record<AiKind, string> = {
  single_choice: 'Một đáp án đúng',
  multiple_choice: 'Nhiều đáp án đúng',
  true_false: 'Đúng / Sai',
  fill_blank: 'Điền khuyết',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
};
const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: 'Một đáp án đúng',
  MULTIPLE_CHOICE: 'Nhiều đáp án đúng',
  TRUE_FALSE: 'Đúng / Sai',
  MULTIPLE_FILL_IN_BLANK: 'Điền khuyết',
  SHORT_ANSWER: 'Trả lời ngắn',
  ESSAY: 'Tự luận',
};

interface OrgAi {
  provider: 'gemini' | 'deepseek';
  model: string;
  enabled: boolean;
  has_key: boolean;
}
interface Drafted {
  type: string;
  content: string;
  explanation?: string | null;
  points: number;
  difficulty: string;
  skill?: string | null;
  is_true?: boolean;
  answers?: { content: string; is_correct: boolean }[];
  settings?: { blanks?: { answers: string[] }[]; reference?: string };
}

const PROVIDER_LABEL = { gemini: 'Google Gemini', deepseek: 'DeepSeek' } as const;

function xsrf(): string {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}
const headers = (json = true): Record<string, string> => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  Accept: 'application/json',
  'X-XSRF-TOKEN': xsrf(),
  'X-Requested-With': 'XMLHttpRequest',
});
async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = body?.errors ? (Object.values(body.errors)[0] as string[])[0] : null;
    throw new Error(first || body?.message || `Lỗi ${res.status}`);
  }
  return body as T;
}

/**
 * "Tạo câu hỏi bằng AI": a document (Word, PDF, image, text) in, reviewed draft questions out.
 * With the school's API key the server calls the provider; without it the lecturer copies a ready-made prompt into any
 * chatbot and pastes the JSON answer back. Either way nothing is saved until the lecturer keeps the questions.
 */
export function AiGenerateModal({ open, onClose, questionSetId }: { open: boolean; onClose: () => void; questionSetId: number }) {
  const dialog = useDialog();
  const ai = (usePage().props as { orgAi?: OrgAi | null }).orgAi ?? null;
  const ready = !!ai?.enabled && !!ai?.has_key;
  const canSendFiles = ready && ai?.provider === 'gemini';

  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'api' | 'manual'>(ready ? 'api' : 'manual');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [sendFile, setSendFile] = useState(false);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [count, setCount] = useState(10);
  const [kinds, setKinds] = useState<AiKind[]>(['single_choice', 'true_false']);
  const [difficulty, setDifficulty] = useState('mixed');
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [points, setPoints] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [pasted, setPasted] = useState('');

  const [busy, setBusy] = useState<null | 'generate' | 'copy' | 'parse' | 'save'>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafted[] | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [keep, setKeep] = useState<boolean[]>([]);

  const options = { count, kinds, difficulty, language, points, instructions };

  const reset = () => {
    setDrafts(null);
    setRejected([]);
    setError(null);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const pick = async (f: File) => {
    setError(null);
    setNote(null);
    setFile(f);
    setText('');
    setSendFile(false);
    setReading(true);
    try {
      const r = await extractText(f);
      setText(r.text);
      if (r.scanned) {
        if (canSendFiles) {
          setSendFile(true);
          setNote(isImage(f) ? 'Ảnh sẽ được gửi nguyên bản để Gemini tự nhận dạng chữ (OCR).' : 'PDF này là bản scan: Gemini sẽ tự nhận dạng chữ (OCR) từ tệp gốc.');
        } else {
          setError(
            isImage(f) || !r.text
              ? 'Tệp này là ảnh hoặc bản scan, không có chữ để đọc. Cần bật Gemini (đọc được ảnh) trong Cài đặt tổ chức, hoặc dán nội dung vào ô bên dưới.'
              : 'PDF có rất ít chữ, có thể là bản scan. Kết quả có thể thiếu; Gemini sẽ đọc tốt hơn.',
          );
        }
      } else {
        setNote(`Đã đọc ${r.text.length.toLocaleString('vi-VN')} ký tự${r.pages ? ` từ ${r.pages} trang` : ''}.`);
        if (canSendFiles && isPdf(f)) setSendFile(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  };

  const hasSource = text.trim().length > 0 || (sendFile && !!file);

  const generate = async () => {
    setBusy('generate');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('text', text);
      if (sendFile && file) fd.append('file', file);
      fd.append('count', String(count));
      kinds.forEach((k) => fd.append('kinds[]', k));
      fd.append('difficulty', difficulty);
      fd.append('language', language);
      fd.append('points', String(points));
      if (instructions.trim()) fd.append('instructions', instructions.trim());
      const res = await fetch(`/admin/question-sets/${questionSetId}/ai/generate`, { method: 'POST', body: fd, credentials: 'same-origin', headers: headers(false) });
      show(await readJson<{ questions: Drafted[]; rejected: string[] }>(res));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const copyPrompt = async () => {
    setBusy('copy');
    setError(null);
    try {
      const res = await fetch(`/admin/question-sets/${questionSetId}/ai/prompt`, { method: 'POST', credentials: 'same-origin', headers: headers(), body: JSON.stringify(options) });
      const { prompt } = await readJson<{ prompt: string }>(res);
      await navigator.clipboard.writeText(`${prompt}\n\nSource material:\n"""\n${text.trim()}\n"""`);
      dialog.toast.success('Đã sao chép prompt kèm tài liệu');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const parse = async () => {
    setBusy('parse');
    setError(null);
    try {
      const res = await fetch(`/admin/question-sets/${questionSetId}/ai/parse`, { method: 'POST', credentials: 'same-origin', headers: headers(), body: JSON.stringify({ json: pasted, points }) });
      show(await readJson<{ questions: Drafted[]; rejected: string[] }>(res));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const show = (r: { questions: Drafted[]; rejected: string[] }) => {
    if (!r.questions.length) {
      setError(r.rejected.length ? `Không có câu nào dùng được. ${r.rejected[0]}` : 'AI không trả về câu hỏi nào. Thử lại với tài liệu dài hơn hoặc bớt yêu cầu.');
      return;
    }
    setDrafts(r.questions);
    setRejected(r.rejected);
    setKeep(r.questions.map(() => true));
  };

  const save = async () => {
    if (!drafts) return;
    const chosen = drafts.filter((_, i) => keep[i]);
    setBusy('save');
    setError(null);
    try {
      const res = await fetch(`/admin/question-sets/${questionSetId}/ai/save`, { method: 'POST', credentials: 'same-origin', headers: headers(), body: JSON.stringify({ questions: chosen }) });
      const { saved } = await readJson<{ saved: number }>(res);
      dialog.toast.success(`Đã thêm ${saved} câu hỏi vào bộ đề`);
      reset();
      setFile(null);
      setText('');
      setPasted('');
      onClose();
      router.reload({ only: ['classicalQuestions', 'questionSet'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const kept = keep.filter(Boolean).length;

  const footer = drafts ? (
    <>
      <FxButton icon={ArrowLeft} disabled={!!busy} onClick={reset}>
        Tạo lại
      </FxButton>
      <FxButton variant="primary" icon={busy === 'save' ? Loader2 : Check} disabled={!!busy || kept === 0} onClick={save}>
        {busy === 'save' ? 'Đang thêm…' : `Thêm ${kept} câu vào bộ đề`}
      </FxButton>
    </>
  ) : mode === 'api' ? (
    <>
      <FxButton onClick={close} disabled={!!busy}>
        Huỷ
      </FxButton>
      <FxButton variant="primary" icon={busy === 'generate' ? Loader2 : Sparkles} disabled={!!busy || reading || !hasSource || kinds.length === 0} onClick={generate}>
        {busy === 'generate' ? 'AI đang soạn câu hỏi…' : 'Tạo câu hỏi'}
      </FxButton>
    </>
  ) : (
    <>
      <FxButton onClick={close} disabled={!!busy}>
        Huỷ
      </FxButton>
      <FxButton variant="primary" icon={busy === 'parse' ? Loader2 : Check} disabled={!!busy || !pasted.trim()} onClick={parse}>
        Đọc kết quả
      </FxButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      width={880}
      title="Tạo câu hỏi bằng AI"
      desc={drafts ? 'Xem lại trước khi thêm. Bỏ chọn những câu chưa đạt; câu đã thêm vẫn sửa được trong bộ đề.' : 'Tải lên giáo trình, đề cương hoặc đề cũ. AI soạn câu hỏi nháp, bạn duyệt rồi mới thêm vào bộ đề.'}
      footer={footer}
    >
      {!drafts && (
        <>
          <Segmented
            stretch
            value={mode}
            onChange={setMode}
            options={[
              { value: 'api', label: ready ? `Dùng AI của trường (${PROVIDER_LABEL[ai!.provider]})` : 'Dùng AI của trường' },
              { value: 'manual', label: 'Tự dán vào chatbot' },
            ]}
          />
          {mode === 'api' && !ready && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 text-[13px]">
              <Settings2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">Trường chưa bật Trợ lý AI. Quản trị viên nhập khoá Gemini hoặc DeepSeek ở Cài đặt tổ chức, hoặc chọn “Tự dán vào chatbot”.</span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="text-[13px] font-medium">Tài liệu nguồn</div>
              <input ref={input} type="file" hidden accept={DOC_ACCEPT} onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{reading ? 'Đang đọc tệp…' : note}</div>
                  </div>
                  <FxButton size="sm" onClick={() => input.current?.click()} disabled={reading}>
                    Đổi tệp
                  </FxButton>
                  <button type="button" aria-label="Bỏ tệp" className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={() => { setFile(null); setText(''); setNote(null); setSendFile(false); }}>
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.dataTransfer.files[0] && pick(e.dataTransfer.files[0]);
                  }}
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  <Upload className="size-6" />
                  <span className="font-medium text-foreground">Chọn hoặc kéo tệp vào đây</span>
                  <span className="text-xs">Word (.docx), PDF, ảnh chụp, .txt — tối đa 15 MB</span>
                </button>
              )}
              <Field label="Hoặc dán nội dung" hint={text ? `${text.length.toLocaleString('vi-VN')} ký tự · AI đọc tối đa 60.000 ký tự đầu` : undefined}>
                <FxTextarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dán chương giáo trình, đề cương ôn tập hoặc đề thi cũ…" className="text-[13px]" />
              </Field>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Số câu">
                  <FxInput type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} suffix="câu" />
                </Field>
                <Field label="Điểm mỗi câu">
                  <FxInput type="number" min={0} step={0.25} value={points} onChange={(e) => setPoints(Number(e.target.value))} suffix="điểm" />
                </Field>
              </div>
              <Field label="Dạng câu hỏi" hint="Chọn một hoặc nhiều dạng; AI chia đều số câu.">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(KIND_LABEL) as AiKind[]).map((k) => {
                    const on = kinds.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
                        className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors', on ? 'border-primary bg-primary/12 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
                      >
                        {on && <Check className="size-3.5" />}
                        {KIND_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Độ khó">
                  <FxSelect value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="mixed">Trộn nhiều mức</option>
                    {Object.entries(DIFFICULTY).map(([k, d]) => (
                      <option key={k} value={k}>
                        Toàn bộ: {d.label}
                      </option>
                    ))}
                  </FxSelect>
                </Field>
                <Field label="Ngôn ngữ">
                  <FxSelect value={language} onChange={(e) => setLanguage(e.target.value as 'vi' | 'en')}>
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </FxSelect>
                </Field>
              </div>
              <Field label="Yêu cầu thêm" optional>
                <FxTextarea rows={2} maxLength={1000} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Chỉ lấy chương 3; ưu tiên câu vận dụng; không hỏi định nghĩa." />
              </Field>
            </div>
          </div>

          {mode === 'manual' && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 text-[13px] leading-relaxed">
                  <b>1.</b> Sao chép prompt (đã kèm tài liệu) và dán vào ChatGPT, Gemini hoặc DeepSeek. <b>2.</b> Dán câu trả lời JSON của chatbot vào ô dưới.
                </span>
                <FxButton icon={busy === 'copy' ? Loader2 : ClipboardCopy} disabled={!!busy || !text.trim() || kinds.length === 0} onClick={copyPrompt}>
                  Sao chép prompt
                </FxButton>
              </div>
              <FxTextarea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{"questions": [ … ]}' className="font-mono text-xs" aria-label="Kết quả JSON từ chatbot" />
            </div>
          )}

          {mode === 'api' && ready && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nội dung tài liệu được gửi tới {PROVIDER_LABEL[ai!.provider]} bằng khoá API của trường để soạn câu hỏi. Không gửi tài liệu có thông tin cá nhân của sinh viên.
            </p>
          )}
        </>
      )}

      {drafts && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="success">{drafts.length} câu hợp lệ</Pill>
            {rejected.length > 0 && <Pill tone="warning">{rejected.length} câu bị loại</Pill>}
            <span className="flex-1" />
            <button type="button" className="cursor-pointer text-[13px] font-medium text-brand-fg hover:underline" onClick={() => setKeep(drafts.map(() => kept !== drafts.length))}>
              {kept === drafts.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>

          <ol className="flex flex-col gap-2">
            {drafts.map((d, i) => {
              const diff = DIFFICULTY[d.difficulty as keyof typeof DIFFICULTY];
              return (
                <li key={i}>
                  <label className={cn('flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors', keep[i] ? 'border-primary/50 bg-primary/5' : 'border-border opacity-70')}>
                    <input type="checkbox" className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--primary)]" checked={keep[i]} onChange={(e) => setKeep(keep.map((k, j) => (j === i ? e.target.checked : k)))} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">Câu {i + 1}</span>
                        <Pill size="sm">{TYPE_LABEL[d.type] ?? d.type}</Pill>
                        {diff && <Pill size="sm" tone={diff.tone}>{diff.label}</Pill>}
                        {d.skill && <Pill size="sm" tone="outline">{d.skill}</Pill>}
                      </div>
                      <p className="whitespace-pre-line text-sm leading-relaxed">{d.content}</p>
                      {d.answers && (
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {d.answers.map((a, j) => (
                            <li key={j} className={cn('flex items-start gap-2 text-[13px]', a.is_correct ? 'font-medium text-success-fg' : 'text-muted-foreground')}>
                              <span className="w-4 shrink-0 font-mono text-xs">{String.fromCharCode(65 + j)}.</span>
                              <span className="min-w-0">{a.content}</span>
                              {a.is_correct && <Check className="mt-0.5 size-3.5 shrink-0" />}
                            </li>
                          ))}
                        </ul>
                      )}
                      {d.type === 'TRUE_FALSE' && <p className="mt-1.5 text-[13px] font-medium text-success-fg">Đáp án: {d.is_true ? 'Đúng' : 'Sai'}</p>}
                      {d.settings?.blanks && <p className="mt-1.5 text-[13px] text-success-fg">Đáp án: {d.settings.blanks.map((b, j) => `[${j + 1}] ${b.answers.join(' / ')}`).join('; ')}</p>}
                      {d.settings?.reference && <p className="mt-1.5 text-[13px] text-success-fg">Đáp án mẫu: {d.settings.reference}</p>}
                      {d.explanation && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Giải thích: {d.explanation}</p>}
                    </div>
                  </label>
                </li>
              );
            })}
          </ol>

          {rejected.length > 0 && (
            <details className="rounded-lg border border-border px-3 py-2 text-[13px]">
              <summary className="cursor-pointer text-muted-foreground">Vì sao {rejected.length} câu bị loại</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {rejected.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
    </Modal>
  );
}
