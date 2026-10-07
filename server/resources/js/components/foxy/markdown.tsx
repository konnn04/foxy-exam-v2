import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { highlight } from '@/lib/highlight';
import { cn } from '@/lib/utils';

/**
 * Markdown for problem statements and question text: GitHub tables, LaTeX math ($x^2$ and $$...$$)
 * and highlighted code blocks. Raw HTML is never rendered.
 */
export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn('text-sm leading-[1.65] text-foreground/85 [text-wrap:pretty]', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className: c, children, ...rest }) {
            const lang = /language-([\w+-]+)/.exec(c ?? '')?.[1];
            const text = String(children).replace(/\n$/, '');
            if (!lang && !text.includes('\n')) return <code className="rounded bg-muted px-1 py-px font-mono text-[0.9em]" {...rest}>{children}</code>;
            return <code className="font-mono text-[13px]" dangerouslySetInnerHTML={{ __html: highlight(text, lang ?? '') }} />;
          },
          pre: ({ children }) => <pre className="my-2 overflow-auto rounded-lg border border-border bg-surface px-3 py-2.5">{children}</pre>,
          a: ({ children }) => <span className="text-brand-fg underline">{children}</span>,
          table: ({ children }) => <table className="my-2 border-collapse text-[13px]">{children}</table>,
          th: ({ children }) => <th className="border border-border bg-surface px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          ul: ({ children }) => <ul className="my-1.5 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5">{children}</ol>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          h1: ({ children }) => <h3 className="mb-1 mt-3 text-xl font-semibold">{children}</h3>,
          h2: ({ children }) => <h4 className="mb-1 mt-3 text-lg font-semibold">{children}</h4>,
          h3: ({ children }) => <h5 className="mb-1 mt-2 text-[15px] font-semibold">{children}</h5>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
