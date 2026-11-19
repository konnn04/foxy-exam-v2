import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { type TeamItem } from '@/components/team-switcher';
import { Field, FxButton, FxSelect, FxTextarea, PageHeader, Panel, PanelTitle, Pill } from '@/components/foxy/ui';
import { guessMapping, parseDelimited, readSpreadsheet, type Grid, type ImportField } from '@/lib/spreadsheet';

interface Props {
  user: any;
  teams: TeamItem[];
  courses: { code: string; name: string }[];
  maxRows: number;
}
interface PreviewRow {
  line: number;
  username: string;
  name: string;
  email: string;
  course: string;
  status: 'new' | 'exists' | 'error';
  errors: string[];
}
interface Summary {
  new: number;
  exists: number;
  error: number;
}

const FIELD_LABEL: Record<ImportField, string> = { username: 'Mã sinh viên (tên đăng nhập) *', name: 'Họ và tên', email: 'Email', course: 'Mã khóa học', password: 'Mật khẩu' };
const COMMIT_CHUNK = 40; // each new account hashes a password: small requests keep every call quick

function xsrf(): string {
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function post<T>(url: string, data: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Lỗi ${res.status}`);
  return json as T;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export default function ImportStudents({ user, teams, courses, maxRows }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [map, setMap] = useState<Record<ImportField, number>>({ username: -1, name: -1, email: -1, course: -1, password: -1 });
  const [defaultCourse, setDefaultCourse] = useState('');
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'check' | 'import'>(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; summary: Summary } | null>(null);
  const [result, setResult] = useState<{ created: number; enrolled: number; errors: number; credentials: { username: string; name: string; password: string }[] } | null>(null);

  const header = grid && hasHeader ? grid[0] : null;
  const body = grid ? (hasHeader ? grid.slice(1) : grid) : [];
  const width = grid?.[0]?.length ?? 0;

  const rows = useMemo(
    () =>
      body.map((r) => {
        const get = (f: ImportField) => (map[f] >= 0 ? r[map[f]] ?? '' : '');
        return { username: get('username'), name: get('name'), email: get('email'), course: get('course'), password: get('password') };
      }),
    [body, map],
  );

  const load = (g: Grid) => {
    setError(null);
    setPreview(null);
    setResult(null);
    if (g.length === 0) return setError('Không tìm thấy dòng dữ liệu nào.');
    // a first row that contains a recognisable column name is a header
    const guessed = guessMapping(g[0]);
    const isHeader = Object.values(guessed).some((i) => i >= 0);
    setHasHeader(isHeader);
    setMap(isHeader ? guessed : { username: 0, name: g[0].length > 1 ? 1 : -1, email: g[0].length > 2 ? 2 : -1, course: -1, password: -1 });
    setGrid(g);
  };

  const onFile = async (file: File) => {
    try {
      load(await readSpreadsheet(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const reset = () => {
    setGrid(null);
    setPreview(null);
    setResult(null);
    setPaste('');
    setError(null);
  };

  const chunks = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

  const check = async () => {
    setBusy('check');
    setError(null);
    setProgress(0);
    try {
      if (rows.length > 5000) throw new Error('Mỗi lần nhập tối đa 5.000 dòng. Hãy tách tệp.');
      const all: PreviewRow[] = [];
      const summary: Summary = { new: 0, exists: 0, error: 0 };
      let offset = 0;
      for (const part of chunks(rows, maxRows)) {
        const res = await post<{ rows: PreviewRow[]; summary: Summary }>('/admin/import/students/preview', { rows: part, default_course: defaultCourse });
        // line numbers are relative to the chunk: make them relative to the file
        res.rows.forEach((r) => all.push({ ...r, line: r.line + offset + (hasHeader ? 1 : 0) }));
        (Object.keys(summary) as (keyof Summary)[]).forEach((k) => (summary[k] += res.summary[k]));
        offset += part.length;
        setProgress(Math.round((offset / rows.length) * 100));
      }
      // the server only sees one chunk at a time: catch duplicates across chunks here
      const seen = new Map<string, number>();
      all.forEach((r) => {
        if (!r.username || r.status === 'error') return;
        const first = seen.get(r.username);
        if (first !== undefined) {
          const was = r.status as 'new' | 'exists';
          r.status = 'error';
          r.errors = [...r.errors, `Trùng với dòng ${first} trong tệp.`];
          summary.error++;
          summary[was] = Math.max(0, summary[was] - 1);
        } else seen.set(r.username, r.line);
      });
      setPreview({ rows: all, summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    setBusy('import');
    setError(null);
    setProgress(0);
    const total = { created: 0, enrolled: 0, errors: 0, credentials: [] as { username: string; name: string; password: string }[] };
    try {
      let done = 0;
      for (const part of chunks(rows, COMMIT_CHUNK)) {
        const res = await post<typeof total>('/admin/import/students/commit', { rows: part, default_course: defaultCourse });
        total.created += res.created;
        total.enrolled += res.enrolled;
        total.errors += res.errors;
        total.credentials.push(...res.credentials);
        done += part.length;
        setProgress(Math.round((done / rows.length) * 100));
      }
      setResult(total);
      setPreview(null);
      setGrid(null);
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)) + ' Các dòng đã nhập trước đó vẫn được giữ; chạy lại sẽ bỏ qua các tài khoản đã có.');
    } finally {
      setBusy(null);
    }
  };

  const credentialsCsv = () =>
    download('tai-khoan-sinh-vien.csv', ['Mã sinh viên,Họ tên,Mật khẩu', ...(result?.credentials ?? []).map((c) => [c.username, c.name, c.password].map(csvCell).join(','))].join('\r\n'));

  const colOptions = (
    <>
      <option value={-1}>— Không có —</option>
      {Array.from({ length: width }, (_, i) => (
        <option key={i} value={i}>
          {header ? `${header[i] || `Cột ${i + 1}`}` : `Cột ${i + 1}`}
        </option>
      ))}
    </>
  );

  return (
    <AdminLayout user={user} teams={teams} currentTab="import" title="Nhập sinh viên" breadcrumbs={[{ label: 'Tổ chức' }, { label: 'Nhập sinh viên' }]}>
      <div className="flex flex-col gap-5">
        <PageHeader title="Nhập sinh viên từ Excel" desc="Tạo hàng loạt tài khoản sinh viên và ghi danh vào khóa học. Tệp được đọc ngay trên máy bạn, chỉ các dòng dữ liệu mới được gửi lên." />

        {result && (
          <Panel className="flex flex-col gap-3 border-success/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-success-fg">
              <CheckCircle2 className="size-5" /> Đã nhập xong
            </div>
            <p className="text-sm">
              Tạo mới <b>{result.created}</b> tài khoản, ghi danh <b>{result.enrolled}</b> lượt{result.errors ? `, bỏ qua ${result.errors} dòng lỗi` : ''}.
            </p>
            {result.credentials.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg bg-warning-soft p-3 text-[13px]">
                <span>
                  <b>{result.credentials.length}</b> tài khoản được hệ thống tự tạo mật khẩu. Danh sách này chỉ hiện <b>một lần</b>, hãy tải về và gửi cho sinh viên.
                </span>
                <div>
                  <FxButton icon={Download} onClick={credentialsCsv}>
                    Tải danh sách mật khẩu (.csv)
                  </FxButton>
                </div>
              </div>
            )}
            <div>
              <FxButton onClick={reset}>Nhập thêm tệp khác</FxButton>
            </div>
          </Panel>
        )}

        {!grid && !result && (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel className="flex flex-col gap-3">
              <PanelTitle title="1. Chọn tệp" desc="Hỗ trợ .xlsx, .csv và .tsv. Dòng đầu nên là tên cột." />
              <input ref={input} type="file" hidden accept=".xlsx,.csv,.tsv,.txt" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]);
                }}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                <FileSpreadsheet className="size-8" />
                <span className="font-medium">Bấm để chọn hoặc kéo tệp vào đây</span>
              </button>
              <p className="text-xs text-muted-foreground">Các cột nhận diện được: Mã sinh viên (MSSV), Họ tên, Email, Mã khóa học, Mật khẩu. Thiếu mật khẩu thì hệ thống tự tạo; thiếu email thì dùng email nội bộ.</p>
            </Panel>

            <Panel className="flex flex-col gap-3">
              <PanelTitle title="Hoặc dán từ Excel" desc="Chọn các ô trong Excel, sao chép rồi dán vào đây." />
              <FxTextarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={7} placeholder={'MSSV\tHọ tên\tEmail\n2351050084\tLê Minh Khôi\tkhoi@ou.edu.vn'} className="font-mono text-xs" />
              <div>
                <FxButton icon={Upload} disabled={!paste.trim()} onClick={() => load(parseDelimited(paste))}>
                  Đọc dữ liệu
                </FxButton>
              </div>
            </Panel>
          </div>
        )}

        {grid && (
          <>
            <Panel className="flex flex-col gap-4">
              <PanelTitle
                title="2. Ghép cột"
                desc={`${rows.length.toLocaleString('vi-VN')} dòng dữ liệu. Kiểm tra hệ thống đã đoán đúng cột chưa.`}
                actions={
                  <FxButton onClick={reset} disabled={busy !== null}>
                    Chọn tệp khác
                  </FxButton>
                }
              />
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); setPreview(null); }} />
                Dòng đầu là tên cột
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {(Object.keys(FIELD_LABEL) as ImportField[]).map((f) => (
                  <Field key={f} label={FIELD_LABEL[f]}>
                    <FxSelect value={map[f]} onChange={(e) => { setMap({ ...map, [f]: Number(e.target.value) }); setPreview(null); }}>
                      {colOptions}
                    </FxSelect>
                  </Field>
                ))}
              </div>
              <Field label="Khóa học áp dụng cho các dòng không ghi mã khóa học" hint="Để trống nếu chỉ tạo tài khoản, chưa ghi danh.">
                <FxSelect value={defaultCourse} onChange={(e) => { setDefaultCourse(e.target.value); setPreview(null); }}>
                  <option value="">— Không ghi danh —</option>
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </FxSelect>
              </Field>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Mã sinh viên</th>
                      <th className="px-3 py-2">Họ tên</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Khóa học</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono">{r.username || <span className="text-danger-fg">trống</span>}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.email}</td>
                        <td className="px-3 py-2 font-mono">{r.course || defaultCourse}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <FxButton variant="primary" icon={busy === 'check' ? Loader2 : CheckCircle2} disabled={busy !== null || map.username < 0 || rows.length === 0} onClick={check}>
                  {busy === 'check' ? `Đang kiểm tra… ${progress}%` : 'Kiểm tra dữ liệu'}
                </FxButton>
                {map.username < 0 && <span className="text-xs text-danger-fg">Cần chọn cột mã sinh viên.</span>}
              </div>
            </Panel>

            {preview && (
              <Panel className="flex flex-col gap-4">
                <PanelTitle title="3. Kết quả kiểm tra" desc="Chưa có gì được lưu. Chỉ các dòng hợp lệ sẽ được nhập." />
                <div className="flex flex-wrap gap-2">
                  <Pill tone="success">{preview.summary.new} tài khoản mới</Pill>
                  <Pill tone="info">{preview.summary.exists} đã có (chỉ ghi danh)</Pill>
                  <Pill tone={preview.summary.error ? 'danger' : 'neutral'}>{preview.summary.error} dòng lỗi</Pill>
                </div>

                {preview.summary.error > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <ul className="divide-y divide-border text-xs">
                      {preview.rows.filter((r) => r.status === 'error').slice(0, 200).map((r) => (
                        <li key={r.line} className="flex gap-3 px-3 py-2">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger-fg" />
                          <span>
                            <b>Dòng {r.line}</b> · <span className="font-mono">{r.username || '—'}</span>: {r.errors.join(' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <FxButton variant="primary" icon={busy === 'import' ? Loader2 : Upload} disabled={busy !== null || preview.summary.new + preview.summary.exists === 0} onClick={run}>
                    {busy === 'import' ? `Đang nhập… ${progress}%` : `Nhập ${preview.summary.new + preview.summary.exists} dòng hợp lệ`}
                  </FxButton>
                  {preview.summary.error > 0 && <span className="text-xs text-muted-foreground">Các dòng lỗi sẽ được bỏ qua.</span>}
                </div>
              </Panel>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-fg">
            {error}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
