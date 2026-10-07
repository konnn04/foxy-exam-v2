/**
 * Runs the REAL RealtimeClient (src/lib/realtime.ts) against a running server + ingest.
 * Used by realtime/scripts/smoke.sh (needs the stack up); run by hand with:
 *
 *   VITE_API_BASE_URL=http://127.0.0.1:8770/api/v1 npx vite-node client/scripts/realtime-e2e.ts
 *
 * Exits non-zero on failure. No Tauri, no DOM: only the few browser globals the module touches are shimmed.
 */
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const API = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8770/api/v1";

async function main() {
  // login like the lobby would (student01 / CLAS-2026 has no face monitoring)
  const login = await fetch(`${API}/student/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ exam_code: "CLAS-2026", username: "student01", password: "student123" }),
  }).then((r) => r.json());
  if (!login.success) throw new Error("login failed: " + JSON.stringify(login));
  store.set("foxyexam:auth", JSON.stringify({ token: login.data.token, remember: false, user: { id: 1, username: "student01", name: "x" } }));
  const attemptId: number = login.data.attempt_id;

  const { RealtimeClient } = await import("../src/lib/realtime");
  const commands: string[] = [];
  let ended: string | null = null;
  const rt = new RealtimeClient({ onCommand: (c) => commands.push(c.type), onEnd: (s) => (ended = s) });

  if (!(await rt.start(attemptId))) throw new Error("realtime did not start (is RT_JWT_SECRET configured?)");
  rt.setState({ focus: true, fullscreen: true, camera: true, screen: false, question: 3 });
  rt.emit("violation", { violation_type: "TAB_SWITCH", severity: "MEDIUM", details: { via: "client-e2e" } });
  rt.emit("oplog", { batch_seq: 1, keystroke_count: 42, paste_event_count: 0, raw_ops_payload: JSON.stringify([[65, 1, 0]]) });

  // a proctor warns the candidate: simulate through the hub-independent path (ingest command store is Redis);
  // here we only prove the loop keeps flowing, then end it
  await new Promise((r) => setTimeout(r, 2600));
  await rt.stop();

  console.log(JSON.stringify({ ok: true, attemptId, commands, ended }));
}

main().catch((e) => {
  console.error("CLIENT E2E FAIL:", e);
  process.exit(1);
});
