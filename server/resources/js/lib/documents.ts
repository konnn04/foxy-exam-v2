import { unzip, xml } from './spreadsheet';

/**
 * Text out of the documents lecturers usually have: Word (.docx), PDF with real text, plain text / Markdown.
 * Runs in the browser. A scanned PDF or a photo has no text layer: `scanned: true` tells the caller to send the file
 * itself to a provider that reads images (Gemini).
 */
export interface ExtractResult {
  text: string;
  pages?: number;
  scanned?: boolean;
}

export const DOC_ACCEPT = '.docx,.pdf,.txt,.md,.png,.jpg,.jpeg,.webp';
export const isImage = (f: File) => /\.(png|jpe?g|webp)$/i.test(f.name);
export const isPdf = (f: File) => /\.pdf$/i.test(f.name);

async function docx(file: File): Promise<ExtractResult> {
  const files = await unzip(await file.arrayBuffer(), (n) => n === 'word/document.xml');
  const doc = files.get('word/document.xml');
  if (!doc) throw new Error('Không đọc được nội dung tệp Word.');
  const lines: string[] = [];
  // paragraphs keep their order; tabs and line breaks inside a paragraph are kept too
  const root = xml(doc);
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const byNs = root.getElementsByTagNameNS(W, 'p');
  const paragraphs = Array.from(byNs.length ? byNs : root.getElementsByTagName('w:p'));
  const name = (n: Element) => (n.localName || n.tagName).replace(/^.*:/, '');
  for (const p of paragraphs) {
    let line = '';
    // runs, hyperlinks and fields nest: walk every descendant in document order
    const walk = (el: Element) => {
      for (const node of Array.from(el.children)) {
        const n = name(node);
        if (n === 't') line += node.textContent ?? '';
        else if (n === 'tab') line += '\t';
        else if (n === 'br') line += '\n';
        else walk(node);
      }
    };
    walk(p);
    lines.push(line);
  }
  return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

async function pdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''));
  }
  const text = pages.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
  // under ~20 characters a page is almost certainly a scan
  return { text, pages: doc.numPages, scanned: text.replace(/\s/g, '').length < doc.numPages * 20 };
}

export async function extractText(file: File): Promise<ExtractResult> {
  if (/\.docx$/i.test(file.name)) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt chưa hỗ trợ đọc .docx. Hãy dùng Chrome, Edge hoặc Firefox bản mới.');
    return docx(file);
  }
  if (/\.doc$/i.test(file.name)) throw new Error('Định dạng .doc cũ chưa được hỗ trợ. Mở bằng Word và lưu lại thành .docx hoặc .pdf.');
  if (isPdf(file)) return pdf(file);
  if (isImage(file)) return { text: '', scanned: true };
  return { text: (await file.text()).trim() };
}
