import * as React from 'react';

/**
 * Minimal Markdown preview for problem statements: headings, paragraphs,
 * "- " lists, fenced code, `inline code`, **bold**, *italic*.
 * Renders React nodes only — never injects HTML.
 */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith('`')) out.push(<code key={k} className="rounded bg-muted px-1 py-px font-mono text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownPreview({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={blocks.length} className="m-0 overflow-auto rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-[13px]">
          {body.join('\n')}
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const cls = h[1].length === 1 ? 'text-xl' : h[1].length === 2 ? 'text-lg' : 'text-[15px]';
      blocks.push(
        <div key={blocks.length} className={`font-semibold ${cls}`}>
          {inline(h[2], `h${i}`)}
        </div>,
      );
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push(
        <ul key={blocks.length} className="m-0 list-disc pl-5 text-foreground/85">
          {items.map((t, j) => (
            <li key={j}>{inline(t, `l${i}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*[-*]\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={blocks.length} className="m-0 text-foreground/85">
        {inline(para.join(' '), `p${i}`)}
      </p>,
    );
  }
  return <div className="flex flex-col gap-3 text-sm leading-[1.65] [text-wrap:pretty]">{blocks}</div>;
}
