import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Square, Trash2 } from "lucide-react";
import { cx, Tip } from "./ui";
import type { SessionExit, TermChunk } from "../lib/runner";

const COLOR: Record<TermChunk["kind"], string> = {
  out: "text-[#d6d6d6]",
  err: "text-[#ff8a80]",
  in: "text-[#8ad7ff]",
  info: "text-[#7e7e7e]",
};

/** The in-app console of a running program: it shows the output and takes the keyboard input, no OS console involved. */
export function Terminal({
  chunks,
  running,
  exit,
  onSend,
  onEof,
  onKill,
  onClear,
  className,
}: {
  chunks: TermChunk[];
  running: boolean;
  exit: SessionExit | null;
  onSend: (line: string) => void;
  onEof: () => void;
  onKill: () => void;
  onClear: () => void;
  className?: string;
}) {
  const [line, setLine] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [chunks]);
  useEffect(() => {
    if (running) input.current?.focus();
  }, [running]);

  const status = running
    ? "đang chạy"
    : exit
      ? exit.phase === "killed"
        ? "đã dừng"
        : exit.phase === "timeout"
          ? "quá thời gian"
          : exit.phase === "compile"
            ? "lỗi biên dịch"
            : `kết thúc · mã ${exit.exit_code ?? "?"} · ${exit.millis}ms`
      : "sẵn sàng";

  return (
    <div className={cx("flex min-h-0 flex-col bg-[#14151a] font-mono text-xs", className)}>
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-white/10 px-3 text-[11px] text-[#9a9a9a]">
        <span className={cx("h-1.5 w-1.5 rounded-full", running ? "live-dot bg-[#4ade80]" : "bg-[#666]")} />
        Terminal · {status}
        <span className="ml-auto flex items-center gap-1">
          {running && (
            <>
              <Tip label="Kết thúc nhập (Ctrl+D)" side="top">
                <button type="button" onClick={onEof} className="rounded px-1.5 py-0.5 hover:bg-white/10">
                  EOF
                </button>
              </Tip>
              <Tip label="Dừng chương trình" side="top">
                <button type="button" onClick={onKill} className="rounded p-1 text-[#ff8a80] hover:bg-white/10" aria-label="Dừng">
                  <Square size={11} />
                </button>
              </Tip>
            </>
          )}
          <Tip label="Xoá màn hình" side="top">
            <button type="button" onClick={onClear} className="rounded p-1 hover:bg-white/10" aria-label="Xoá">
              <Trash2 size={11} />
            </button>
          </Tip>
        </span>
      </div>
      <div ref={body} className="selectable min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-all px-3 py-2 leading-relaxed" onClick={() => input.current?.focus()}>
        {chunks.length === 0 && <span className="text-[#6a6a6a]">Nhấn “Chạy” để biên dịch và chạy. Chương trình đọc dữ liệu bạn gõ ở đây.</span>}
        {chunks.map((c, i) => (
          <span key={i} className={COLOR[c.kind]}>
            {c.text}
          </span>
        ))}
      </div>
      <form
        className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running) return;
          onSend(line);
          setLine("");
        }}
      >
        <span className="text-[#4ade80]">›</span>
        <input
          ref={input}
          value={line}
          disabled={!running}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key.toLowerCase() === "d") {
              e.preventDefault();
              onEof();
            }
          }}
          placeholder={running ? "Nhập dữ liệu rồi nhấn Enter…" : "Chương trình chưa chạy"}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[#d6d6d6] outline-none placeholder:text-[#555]"
        />
        <CornerDownLeft size={12} className="text-[#555]" />
      </form>
    </div>
  );
}
