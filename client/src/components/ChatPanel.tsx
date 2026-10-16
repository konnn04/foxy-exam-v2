import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { getAttemptChat, sendAttemptChat, type ChatMessage } from "../lib/api";
import { formatTime } from "../lib/datetime";
import { getSession } from "../lib/session";
import { cx } from "./ui";
import { useI18n } from "../lib/i18n";

/** Chat with the proctor. Messages arrive as realtime commands (no polling); the history is read once. */
export function ChatPanel({ incoming }: { incoming: { id: string; message: string } | null }) {
  const { t } = useI18n();
  const attemptId = getSession()?.attemptId ?? 0;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const lastId = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const merge = useCallback((list: ChatMessage[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = list.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh].sort((a, b) => a.id - b.id);
      lastId.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!attemptId) return;
    getAttemptChat(attemptId)
      .then((r) => merge(r.data))
      .catch(() => {});
  }, [attemptId, merge]);

  useEffect(() => {
    if (!incoming || !attemptId) return;
    const id = Number(incoming.id.replace("chat-", ""));
    merge([{ id, role: "PROCTOR", name: null, body: incoming.message, at: new Date().toISOString() }]);
    setOpen((o) => {
      if (!o) setUnread((n) => n + 1);
      return true;
    });
  }, [incoming, attemptId, merge]);

  useEffect(() => {
    if (open) setUnread(0);
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [open, messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !attemptId) return;
    setError("");
    try {
      const r = await sendAttemptChat(attemptId, body);
      merge([r.data]);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được.");
    }
  };

  if (!attemptId) return null;
  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="flex w-80 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs font-semibold">
            {t("chat.title")}
            <button type="button" className="ml-auto text-muted hover:text-fg" onClick={() => setOpen(false)} aria-label={t("chat.close")}>
              <X size={14} />
            </button>
          </div>
          <div ref={box} className="flex h-64 flex-col gap-1.5 overflow-y-auto p-2.5">
            {messages.length === 0 && <p className="m-auto text-center text-[11px] text-muted">{t("chat.empty")}</p>}
            {messages.map((m) => (
              <div key={m.id} className={cx("max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px]", m.role === "STUDENT" ? "self-end bg-accent/15" : "self-start bg-surface-2")}>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="mt-0.5 text-[10px] text-muted">
                  {m.role === "STUDENT" ? t("chat.you") : (m.name ?? t("chat.proctor"))} · {m.at ? formatTime(m.at) : ""}
                </div>
              </div>
            ))}
          </div>
          {error && <p className="px-3 pb-1 text-[11px] text-danger">{error}</p>}
          <div className="flex gap-1.5 border-t border-line p-2">
            <input
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send()}
              placeholder={t("chat.placeholder")}
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-app px-2.5 text-[13px] outline-none focus:border-accent"
            />
            <button type="button" onClick={() => void send()} disabled={!text.trim()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-40" aria-label={t("chat.send")}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface shadow-lg" aria-label={t("chat.title")}>
          <MessageSquare size={18} />
          {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>}
        </button>
      )}
    </div>
  );
}
