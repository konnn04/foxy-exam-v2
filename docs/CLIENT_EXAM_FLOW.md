# FoxyClient — exam flow

```
Dashboard ──pick exam──▶ exam window (lobby) ──"Bắt đầu"──▶ exam screen ──submit / force-end──▶ Dashboard
                          │ device check, no attempt yet      │ attempt + clock, guard, realtime, LiveKit
```

1. **Pick an exam** (`windows/Main.tsx`): only stores a *pending exam* and shows the exam window. No attempt exists yet, so the
   exam clock does **not** run during setup.
2. **Lobby** (`components/ExamLobby.tsx`): server reachable + clock skew, exam open / enrolled / AI available (`GET /student/exams/{id}`),
   exactly one display, no banned app (Rust monitor), camera preview, microphone level meter, optional screen share.
   Required checks block the *Bắt đầu* button; each shows how to fix it. Camera is required when the exam has `ai_face_check`,
   mic when `require_mic`; screen sharing is recommended, not blocking (WebView support varies).
3. **Start** → `POST /student/exams/{id}/start` (creates or resumes the attempt) → paper (`take` for classical, `paper` for coding).
4. **Runtime** (`lib/examRuntime.ts`, one hook used by both exam windows):
   * `RealtimeClient` (`lib/realtime.ts`): one batched request per ~1 s (heartbeat with focus / fullscreen / camera / screen, violations,
     keystroke op-logs), idempotent `seq` persisted per attempt and re-synced with `GET /rt/ingest/v1/state`, gzip, retry with backoff,
     token refresh on 401, server-driven `next_flush_ms`. If the server has no realtime plane (`REALTIME_DISABLED`) or the DEV bypass
     `realtime` is on, violations / op-logs use the plain REST endpoints.
   * LiveKit: the camera / screen captured in the lobby are published to the exam room (`lib/media.ts`); the record service starts
     egress by itself. A capture that stops mid-exam is reported as a violation and flips `camera` / `screen` in the heartbeat.
   * Proctor commands arrive on the batch response: `WARN` → banner, `PAUSE` / `RESUME` → paper covered / uncovered,
     `FORCE_END` or `end: true` → the attempt is closed server-side and the window returns to the dashboard.
5. **Question types** (`windows/ExamClassic.tsx`): single / multiple choice, true-false, fill-in-the-blank (`[1] [2]` markers become inputs,
   answer = JSON array in `answer_content`), short answer, essay (word limits; audio/file modes show a "not supported yet" notice),
   groups with text / image / audio passages (limited listens, optional seeking). Answer keys never reach the client.

## Dev bypass (testing without a proctoring-grade machine)

Only in dev builds (`pnpm dev` / `pnpm tauri dev`): `lib/dev.ts` returns `false` for every flag when `import.meta.env.DEV` is false,
so a released client cannot enable them whatever is in `localStorage`.

* Floating **DEV** button (lobby + exam windows) toggles: skip lobby · no camera · no screen · ignore extra monitors / banned apps /
  keyboards · REST instead of realtime · ignore a failing health check. Choices persist in `localStorage`.
* Or preset them: `VITE_FOXY_DEV_BYPASS=all` (or `setup,camera,devices`) in `client/.env.development.local`.
* Kiosk lockdown (fullscreen, always-on-top, shortcut blocking) is already off in dev builds.
* The exam header shows `DEV bypass: …` while any flag is active, so test runs are never mistaken for real ones.
* Server side: `AI_ENFORCE=false` lets exams that ask for face monitoring start when no AI worker exists.

Config: `client/.env.example`. Verification of the batching client against a real stack: `bash realtime/scripts/smoke.sh`.
