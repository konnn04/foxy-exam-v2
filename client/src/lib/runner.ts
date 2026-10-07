import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Toolchain {
  id: string;
  language: "cpp" | "python" | "java";
  label: string;
  version: string;
}

export interface RunResult {
  phase: "ready" | "compile" | "run" | "toolchain";
  ok: boolean;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  timed_out: boolean;
  millis: number;
}

export const listToolchains = () => invoke<Toolchain[]>("runner_toolchains");

export const runCode = (toolchain: string, source: string, stdin: string, timeoutMs: number) =>
  invoke<RunResult>("runner_run", { req: { toolchain, source, stdin, timeout_ms: timeoutMs } });

// ---------------------------------------------------------------------------------------------
// Interactive session: the in-app terminal (output streamed from the program, input typed in the app)
// ---------------------------------------------------------------------------------------------

export interface TermChunk {
  kind: "out" | "err" | "in" | "info";
  text: string;
}

export interface SessionExit {
  phase: string;
  exit_code: number | null;
  millis: number;
}

interface DataEvent {
  id: number;
  stream: "stdout" | "stderr";
  text: string;
}
interface ExitEvent extends SessionExit {
  id: number;
}

const MAX_CHUNKS = 2000;

export function useRunnerSession() {
  const [chunks, setChunks] = useState<TermChunk[]>([]);
  const [running, setRunning] = useState(false);
  const [exit, setExit] = useState<SessionExit | null>(null);
  const active = useRef<number | null>(null);
  // events can arrive before `runner_session_start` has returned the id: keep them until it is known
  const early = useRef<{ data: DataEvent[]; exit: ExitEvent[] }>({ data: [], exit: [] });
  const waiting = useRef(false);

  const push = useCallback((c: TermChunk) => setChunks((prev) => [...prev, c].slice(-MAX_CHUNKS)), []);

  const onData = useCallback((e: DataEvent) => push({ kind: e.stream === "stderr" ? "err" : "out", text: e.text }), [push]);
  const onExit = useCallback((e: ExitEvent) => {
    active.current = null;
    setRunning(false);
    setExit({ phase: e.phase, exit_code: e.exit_code, millis: e.millis });
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    const d = win.listen<DataEvent>("runner://data", (ev) => {
      if (waiting.current) early.current.data.push(ev.payload);
      else if (ev.payload.id === active.current) onData(ev.payload);
    });
    const x = win.listen<ExitEvent>("runner://exit", (ev) => {
      if (waiting.current) early.current.exit.push(ev.payload);
      else if (ev.payload.id === active.current) onExit(ev.payload);
    });
    return () => {
      void d.then((f) => f());
      void x.then((f) => f());
      if (active.current !== null) void invoke("runner_session_kill", { id: active.current });
    };
  }, [onData, onExit]);

  const start = useCallback(
    async (toolchain: string, source: string, label: string) => {
      if (active.current !== null) await invoke("runner_session_kill", { id: active.current });
      setChunks([{ kind: "info", text: `$ ${label}\n` }]);
      setExit(null);
      setRunning(true);
      early.current = { data: [], exit: [] };
      waiting.current = true;
      try {
        const id = await invoke<number>("runner_session_start", { toolchain, source });
        active.current = id;
        waiting.current = false;
        early.current.data.filter((e) => e.id === id).forEach(onData);
        const done = early.current.exit.find((e) => e.id === id);
        if (done) onExit(done);
      } catch (err) {
        waiting.current = false;
        setRunning(false);
        push({ kind: "err", text: `${String(err)}\n` });
      }
    },
    [onData, onExit, push],
  );

  const write = useCallback(
    async (line: string) => {
      if (active.current === null) return;
      push({ kind: "in", text: `${line}\n` });
      await invoke("runner_session_write", { id: active.current, text: `${line}\n` });
    },
    [push],
  );

  const eof = useCallback(() => {
    if (active.current !== null) void invoke("runner_session_close_stdin", { id: active.current });
  }, []);

  const kill = useCallback(() => {
    if (active.current !== null) void invoke("runner_session_kill", { id: active.current });
  }, []);

  return { chunks, running, exit, start, write, eof, kill, clear: () => setChunks([]) };
}
