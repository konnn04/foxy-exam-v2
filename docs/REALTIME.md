# Realtime plane & deployment

Server stack = `docker.compose.server.yml` (Linux / Coolify). Source of the Go services: `realtime/`.
Client apps are **not** part of the stack.

## 1. Why it is built this way

| Problem | Decision |
|---|---|
| 10k candidates must not become 10k requests per event | Client **batches ~1 s** of events into one request; ingest costs one JWT check + **one pipelined Redis round-trip**, no DB |
| Writing every event to SQL is the bottleneck | Events go to a **Redis Stream**; the **worker drains it in bulk** and sends *one* signed request per round to Laravel |
| Proctor dashboard showed hard-coded status | The **hub** derives status from real signals (last heartbeat age, focus, fullscreen, lifecycle) and pushes **one delta per second** |
| Retries / flaky Wi-Fi | Every event has a per-attempt `seq`; ingest dedupes, Laravel dedupes on `client_event_id` ⇒ at-least-once delivery, exactly-once effect |
| Overload | Ingest tells clients to **slow down** (`next_flush_ms` grows) before it ever drops data; per-attempt token bucket |
| Recordings | LiveKit **egress → MinIO (S3)**; the **record** service keeps metadata (Postgres) and hands out **presigned URLs**; evidence is uploaded **straight to storage** |

```
FoxyClient ──batch/1s──▶ gateway /rt/ingest ──▶ ingest ──▶ Redis Stream ──▶ worker ──bulk──▶ app (Laravel, source of truth)
                                                   │                           └──raw keystrokes (gz)──▶ MinIO
                                                   └─ live state + pub/sub ──▶ hub ──WS, 1 tick/s──▶ Proctor UI
FoxyClient ──WebRTC──▶ livekit ──egress──▶ MinIO ◀── record (Postgres metadata) ◀── livekit webhooks
```

Trust: Laravel mints **HS256 JWTs** (`RT_JWT_SECRET`): *candidate* (bound to one attempt) and *proctor* (bound to a list of exams).
Service-to-service calls carry `X-Foxy-Timestamp` + `X-Foxy-Signature = hex(HMAC-SHA256(RT_INTERNAL_SECRET, "<ts>.<body>"))` (±5 min).
The Go services never read the Laravel database. `go test ./...` contains known-answer tests against the PHP encoding.

## 2. Client API (FoxyClient)

All paths below are relative to `https://<APP_DOMAIN>`.

### 2.1 Existing REST flow (unchanged)
`POST /api/v1/student/login` → `{token, attempt_id, exam, ...}` (Sanctum token) · `GET /api/v1/student/paper` · `POST /api/v1/student/submit` · `POST /api/v1/student/finish` · classical: `/api/v1/student/exams/{exam}/...`

### 2.2 Realtime session — `POST /api/v1/student/realtime/session`
Auth: Sanctum bearer. Body (optional): `{"attempt_id": 5}` (default: the running attempt). Call right after login/start and again before `expires_at` or after a 401 from ingest.
```json
{ "success": true, "data": {
  "attempt_id": 5, "exam_id": 2, "server_time_ms": 1760000000000, "remaining_seconds": 5400,
  "expires_at": "2026-10-08T10:00:00+00:00",
  "ingest": { "url": ".../rt/ingest/v1/batch", "time_url": ".../rt/ingest/v1/time", "token": "<jwt>",
              "flush_interval_ms": 1000, "max_batch_events": 500, "max_body_bytes": 1048576, "compress": "gzip" },
  "evidence": { "presign_url": ".../rt/record/v1/evidence/presign", "commit_url": ".../rt/record/v1/evidence/{id}/commit",
                "allowed_content_types": ["image/jpeg","image/png","image/webp","video/webm","video/mp4"] },
  "livekit": { "url": "wss://lk.<domain>", "room": "exam-2", "identity": "attempt-5", "token": "<livekit jwt>" } } }
```
`503 REALTIME_DISABLED` → fall back to the plain REST endpoints (`/student/op-log`, `/student/violation`, `/student/heartbeat`).
`409` → no running attempt. The LiveKit token can publish but **cannot subscribe** (a candidate never sees other candidates).

### 2.3 Telemetry batch — `POST /rt/ingest/v1/batch`
`Authorization: Bearer <ingest.token>` · `Content-Type: application/json` · optional `Content-Encoding: gzip`.
```json
{ "events": [
  {"seq": 101, "t": "hb",        "ts": 1760000000123, "data": {"focus": true, "fullscreen": true, "camera": true, "screen": true, "latency_ms": 42, "question": 3}},
  {"seq": 102, "t": "violation", "ts": 1760000000500, "data": {"violation_type": "TAB_SWITCH", "severity": "MEDIUM", "details": {"to": "chrome"}, "evidence_id": "…"}},
  {"seq": 103, "t": "oplog",     "ts": 1760000000900, "data": {"programming_problem_id": 7, "batch_seq": 12, "keystroke_count": 40, "paste_event_count": 0, "synthetic_flags": {}, "raw_ops_payload": "…"}},
  {"seq": 104, "t": "log",       "ts": 1760000001000, "data": {"msg": "camera restarted"}},
  {"seq": 105, "t": "cmd_ack",   "ts": 1760000001100, "data": {"id": "<command id>"}}
] }
```
* `seq`: strictly increasing **per attempt**, persisted by the client across reconnects. Send **at most one batch per `next_flush_ms`**; send a heartbeat every flush (it is also the presence signal — no heartbeat for 20 s ⇒ *offline*).
* `violation_type`: `BULK_PASTE SYNTHETIC_INPUT TAB_SWITCH WINDOW_LOST_FOCUS DEVTOOLS_OPENED MULTIPLE_KEYBOARDS FACE_MISMATCH MULTIPLE_PEOPLE NO_FACE_DETECTED PROHIBITED_DEVICE` · `severity`: `LOW MEDIUM HIGH CRITICAL`.
* Limits: 500 events/batch, 64 KB per event, 1 MB body; unknown/oversize events are rejected individually, the rest is accepted.

Response `200`:
```json
{ "ok": true, "ack_seq": 105, "accepted": 5, "duplicates": 0, "rejected": [],
  "server_ts": 1760000001200, "next_flush_ms": 1000, "status": "active",
  "end": false, "commands": [ {"id":"a1b2","type":"WARN","message":"Quay lại màn hình thi","at":1760000001000} ] }
```
* **Client algorithm**: keep a local queue; drop everything `<= ack_seq`; on network error / `503` keep the queue and retry the *same* events after `Retry-After`; on `429` wait `Retry-After`; on `401` call the session endpoint for a new token. Use `next_flush_ms` as the next interval (the server raises it under load).
* `commands` are delivered **until acknowledged** with a `cmd_ack` event. Types: `WARN` (show message), `PAUSE`, `RESUME`, `FORCE_END`.
* `end: true` (status `ended` / `force_ended`) ⇒ stop the exam UI and show the result screen; the server already closed the attempt.
* `GET /rt/ingest/v1/time` → `{"server_ts": ms}` for clock sync.

### 2.4 Evidence upload (screenshots / short clips) — straight to storage
1. `POST /rt/record/v1/evidence/presign` (`Bearer <ingest.token>`) `{"content_type":"image/jpeg"}` → `{evidence_id, upload_url, method:"PUT", headers:{...}, max_bytes, expires_in}`
2. `PUT <upload_url>` the file (send the returned headers).
3. `POST /rt/record/v1/evidence/{evidence_id}/commit` → `{recording:{status:"ready", size_bytes}}`
4. Put `evidence_id` into the `violation` event. Limits: 8 MB images, 60 MB video, 300 files per attempt.

### 2.5 Camera / screen recording
Connect `livekit-client` with the `livekit` block of the session and publish camera and screen tracks. The **record** service receives LiveKit's webhook and starts egress automatically (one recording per kind: `camera`, `screen`). Nothing else to call.

## 3. Proctor / admin API

* `GET /admin/exams/{id}/realtime` (web session, staff of the exam's organization) → `{token, expires_at, hub_ws_url, hub_http_url, record_url}`. The token is scoped to that exam, 1 h.
* **Hub WebSocket** `wss://<domain>/rt/hub/v1/rooms/{examId}/ws?token=<proctor token>`
  * first message `{"type":"snapshot","rows":[View...],"counts":{...}}`, then **at most one `delta` per second** `{"type":"delta","tick":n,"now":ms,"rows":[changed rows],"feed":[new violations],"counts":{...}}` (+ `ping` when idle). Reconnect → fresh snapshot.
  * `View`: `attempt_id, user_id, status (online|away|offline|paused|ended), focus, fullscreen, camera, screen, latency_ms, question, last_seen_ms, violations, last_violation{type,severity,ts}, pending_command`.
  * send `{"type":"cmd","attempt_id":5,"command":"WARN","message":"…"}` → reply `{"type":"cmd_result","ok":true,...}`. REST equivalent: `POST /rt/hub/v1/rooms/{id}/commands`. A token of exam A cannot act on exam B.
* **Recordings** (`Authorization: Bearer <proctor token>` against `/rt/record`): `GET /v1/exams/{eid}/recordings[?urls=1]`, `GET /v1/exams/{eid}/attempts/{aid}/recordings`, `GET /v1/recordings/{id}/url` (presigned, 15 min).
* `POST /admin/attempts/{id}/force-end` (Inertia/web) ends a session in the database and tells ingest, so the client receives `end:true`.

## 4. Internal endpoints (not public)

| Service | Endpoint | Caller |
|---|---|---|
| app | `POST /api/internal/v1/events/bulk` (signed) | worker — idempotent, tolerant: violations, op-logs, throttled heartbeats |
| ingest | `POST /internal/v1/lifecycle` (signed) `{attempt_id, exam_id, user_id, status: active|paused|ended|force_ended}` | app (login, finish, force-end, end exam) — best effort, never blocks the client |
| record | `POST /internal/v1/egress/start`, `POST /internal/v1/recordings/{id}/stop`, `DELETE /internal/v1/recordings/{id}`, `POST /internal/v1/exams/{eid}/purge` (signed) | app / ops |
| all | `GET /healthz`, `GET /metrics` (Prometheus text) | monitoring on the internal network only — the gateway answers `404` for `/rt/<svc>/metrics` and `/rt/<svc>/internal/*` (the app reaches `/internal` directly over the compose network) |

Metrics worth alerting on: `ingest_rate_limited_total`, `ingest_inflight`, `worker_failures_total`, `worker_dead_lettered_total`, `hub_slow_consumers_dropped_total`, `record_start_failures_total`; Redis `XLEN foxy:events` (backlog) and `foxy:events:dlq`.

## 5. Deploy on Coolify (Linux)

1. Coolify → *New resource* → **Docker Compose** → point at this repo, compose file `docker.compose.server.yml`.
2. Paste `.env.server.example` into the environment tab and fill: `APP_DOMAIN`, `APP_KEY`, `DB_PASSWORD`, `RT_JWT_SECRET`, `RT_INTERNAL_SECRET`, `LIVEKIT_API_SECRET`, `S3_SECRET_KEY` (`openssl rand -hex 32`).
3. Domains: `gateway` → `https://<APP_DOMAIN>` (port 80) · `livekit` → `https://lk.<APP_DOMAIN>` (7880) · `minio` → `https://s3.<APP_DOMAIN>` (9000).
4. Ports: the compose file only uses `expose`; Coolify routes HTTP through its proxy. LiveKit media is not HTTP: in the `livekit` service's *Ports mappings* publish `7881:7881` (TCP fallback) and `7882:7882/udp` (single multiplexed UDP port), and open both on the VPS firewall.
   Realtime path: client → `/rt/ingest` → Redis stream → worker → Laravel bulk API; proctor UI ← `/rt/hub` ← Redis pub/sub; client → LiveKit → egress → MinIO, metadata in `record` (Postgres `foxy_record`).
   Design notes kept out of the compose file: `AI_HOST`/`REVERB_HOST` point at the app only so nginx can resolve every upstream; `AI_ENFORCE=false` until an AI worker exists; Redis runs with AOF because the event stream lives there; `RECORD_DB_DSN` embeds `DB_PASSWORD`, so avoid `@ : / ? #` in it.
5. Deploy. The app container runs migrations on start; seed demo data once: `php artisan db:seed --force` (Coolify → app → terminal).
6. Smoke test: `https://<domain>/api/v1/health`, `https://<domain>/rt/ingest/healthz`, `https://<domain>/rt/hub/healthz`, `https://<domain>/rt/record/healthz`.

Scaling notes: ingest/hub/worker/record are stateless except Redis; run several `ingest` replicas freely (per-attempt rate limit is per replica), several `worker` replicas share the consumer group (set `WORKER_NAME` per replica). The hub keeps room state in memory — one replica per exam room set is enough for 10k candidates because it sends deltas, not events.

## 6. Plan (later)

* HTTP/2 / gRPC streaming ingest (`POST /v1/batch` stays as the compatible fallback); Redis Cluster / sharded streams when one Redis is not enough.
* AI services plug in as additional consumer groups on `foxy:events` and push findings back through ingest as `violation` events.
* Manual grading queue for essays; per-plan recording retention.
