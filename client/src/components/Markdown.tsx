import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { highlight } from "../lib/highlight";
import { cx } from "./ui";

/** Markdown with GitHub tables, LaTeX math ($x^2$, $$...$$) and highlighted code blocks. Never renders raw HTML. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx("md selectable text-[13px] leading-relaxed text-fg/90", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className: c, children: body, ...rest }) {
            const lang = /language-([\w+-]+)/.exec(c ?? "")?.[1];
            const text = String(body).replace(/\n$/, "");
            if (!lang && !text.includes("\n")) return <code className="rounded bg-surface-3 px-1 py-px font-mono text-[0.9em]" {...rest}>{body}</code>;
            return <code className="font-mono text-[12px]" dangerouslySetInnerHTML={{ __html: highlight(text, lang ?? "") }} />;
          },
          pre: ({ children: c }) => <pre className="my-2 overflow-auto rounded-lg border border-line bg-surface-2 px-3 py-2.5">{c}</pre>,
          a: ({ children: c }) => <span className="text-accent-fg underline">{c}</span>,
          table: ({ children: c }) => <table className="my-2 border-collapse text-xs">{c}</table>,
          th: ({ children: c }) => <th className="border border-line bg-surface-2 px-2 py-1 text-left font-semibold">{c}</th>,
          td: ({ children: c }) => <td className="border border-line px-2 py-1">{c}</td>,
          ul: ({ children: c }) => <ul className="my-1.5 list-disc pl-5">{c}</ul>,
          ol: ({ children: c }) => <ol className="my-1.5 list-decimal pl-5">{c}</ol>,
          p: ({ children: c }) => <p className="my-1.5">{c}</p>,
          h1: ({ children: c }) => <h3 className="mb-1 mt-3 text-base font-semibold text-fg">{c}</h3>,
          h2: ({ children: c }) => <h4 className="mb-1 mt-3 text-sm font-semibold text-fg">{c}</h4>,
          h3: ({ children: c }) => <h5 className="mb-1 mt-2 text-[13px] font-semibold text-fg">{c}</h5>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
