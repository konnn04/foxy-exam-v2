/**
 * Reads a spreadsheet in the browser with no dependency: .xlsx (a zip of XML, inflated with the native
 * DecompressionStream), .csv / .tsv, or cells pasted straight from Excel (tab separated).
 * Everything stays on the visitor's machine until the rows are sent to the import endpoint.
 */

export type Grid = string[][];

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** name -> bytes of the zip entries we ask for (only those are inflated). */
export async function unzip(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Tệp không phải định dạng .xlsx hợp lệ.');

  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const out = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();

  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) break;
    const method = u16(view, p + 10);
    const compSize = u32(view, p + 20);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const local = u32(view, p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    if (!wanted(name)) continue;
    const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    const raw = bytes.subarray(start, start + compSize);
    out.set(name, method === 0 ? raw : await inflateRaw(raw));
  }
  return out;
}

export const xml = (b: Uint8Array) => new DOMParser().parseFromString(new TextDecoder().decode(b), 'application/xml');

/** "C12" -> 2 (zero-based column) */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function readXlsx(buf: ArrayBuffer): Promise<Grid> {
  const files = await unzip(buf, (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(n));

  // first sheet of the workbook (not necessarily sheet1.xml)
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const rid = xml(wb).getElementsByTagName('sheet')[0]?.getAttribute('r:id');
    const rel = Array.from(xml(rels).getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  const sheet = files.get(sheetPath) ?? files.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('Không đọc được trang tính đầu tiên của tệp.');

  const shared: string[] = [];
  const ss = files.get('xl/sharedStrings.xml');
  if (ss) {
    for (const si of Array.from(xml(ss).getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
    }
  }

  const grid: Grid = [];
  for (const row of Array.from(xml(sheet).getElementsByTagName('row'))) {
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const idx = colIndex(c.getAttribute('r') ?? '');
      const type = c.getAttribute('t');
      let val = '';
      if (type === 'inlineStr') val = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
      else {
        const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        val = type === 's' ? shared[Number(v)] ?? '' : v;
      }
      if (idx >= 0) cells[idx] = val.trim();
    }
    grid.push(Array.from(cells, (v) => v ?? ''));
  }
  return trim(grid);
}

/** Splits delimited text (quotes, escaped quotes and newlines inside quotes are honoured). */
export function parseDelimited(text: string): Grid {
  const clean = text.replace(/^﻿/, '');
  const first = clean.split(/\r?\n/, 1)[0] ?? '';
  const delim = ['\t', ';', ','].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];

  const grid: Grid = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim());
      grid.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  grid.push(row);
  return trim(grid);
}

/** Drops fully empty rows and pads every row to the same width. */
function trim(grid: Grid): Grid {
  const rows = grid.filter((r) => r.some((c) => c !== ''));
  const width = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
}

export async function readSpreadsheet(file: File): Promise<Grid> {
  if (/\.xlsx$/i.test(file.name)) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt chưa hỗ trợ đọc .xlsx. Hãy lưu tệp thành .csv hoặc dán trực tiếp các ô.');
    return readXlsx(await file.arrayBuffer());
  }
  if (/\.xls$/i.test(file.name)) throw new Error('Định dạng .xls cũ chưa được hỗ trợ. Hãy lưu lại thành .xlsx hoặc .csv.');
  return parseDelimited(await file.text());
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export type ImportField = 'username' | 'name' | 'email' | 'course' | 'password';

const SYNONYMS: Record<ImportField, string[]> = {
  username: ['mssv', 'ma sv', 'masv', 'ma sinh vien', 'ma so sinh vien', 'username', 'ten dang nhap', 'student id', 'studentid', 'id'],
  name: ['ho ten', 'ho va ten', 'ten sinh vien', 'full name', 'fullname', 'name', 'ten'],
  email: ['email', 'e mail', 'mail', 'thu dien tu'],
  course: ['ma khoa hoc', 'khoa hoc', 'ma lop', 'lop', 'lop hoc phan', 'course', 'course code', 'class'],
  password: ['mat khau', 'password', 'pass'],
};

/** Guesses which column holds which field from the header row; -1 = not found. */
export function guessMapping(header: string[]): Record<ImportField, number> {
  const out = { username: -1, name: -1, email: -1, course: -1, password: -1 } as Record<ImportField, number>;
  const folded = header.map(fold);
  (Object.keys(SYNONYMS) as ImportField[]).forEach((f) => {
    const exact = folded.findIndex((h, i) => SYNONYMS[f].includes(h) && !Object.values(out).includes(i));
    out[f] = exact;
  });
  return out;
}
