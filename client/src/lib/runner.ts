import { invoke } from "@tauri-apps/api/core";

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
