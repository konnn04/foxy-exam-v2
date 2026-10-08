# FoxyExam AI services

Three small services, **not part of `docker.compose.server.yml`**: run them on any machine that can reach the
core (a laptop or GPU box behind a tunnel works). The core calls them only through `App\Services\AiService`
(`AI_FACE_URL`, `AI_OBJECT_URL`, `AI_TOKEN`); when they are absent exams still run, the on-device MediaPipe
checks keep working and `AI_ENFORCE=false` lets exams that ask for face monitoring start.

| Service | Port | Model | Endpoints |
|---|---|---|---|
| `face-service` | 8090 | insightface `buffalo_s` (ArcFace embeddings, CPU) | `GET /health`, `POST /v1/faces`, `POST /v1/verify` |
| `object-service` | 8091 | torchvision SSDLite320 MobileNetV3 (COCO, CPU) | `GET /health`, `POST /v1/detect?min_score=0.5` |
| `supervisor-agent` | 8099 | LiveKit Python SDK, runs the two above on live video | `GET /health`, `POST /webhook` |

Measured on CPU after warm-up: face ≈ 35 ms, objects ≈ 80 ms per frame. The first request downloads the weights
(`~/.insightface`, `~/.cache/torch`; the Dockerfiles point them at `/models`, mount a volume to keep them).

All writes need the header `X-AI-Token` equal to `AI_TOKEN` when that variable is set.

## Contract

```
POST /v1/faces    multipart: frame            -> {count, faces:[{bbox, score}]}
POST /v1/embed    multipart: frame            -> {count, score, embedding}   (largest face)
POST /v1/verify   multipart: reference, frame -> {match, similarity, threshold, reference_faces, frame_faces, reason}
                  reason (when match is null): no_face_in_reference | no_face_in_frame | multiple_faces_in_frame
POST /v1/detect   multipart: frame            -> {objects:[{label, score, bbox}], prohibited:[label]}
```

Environment: `AI_TOKEN`, `FACE_MODEL` (default `buffalo_s`), `FACE_MATCH_THRESHOLD` (cosine, default `0.35`),
`PROHIBITED_LABELS` (default `cell phone,laptop,book,remote,tv`).

## How the exam uses them: the supervisor agent

`supervisor-agent` (port 8099) is the piece that runs the two services **in real time**. It joins LiveKit as a hidden
participant, subscribes to the candidates' **camera** tracks (never screens) and to each phone's private room, and takes
**one frame per second per track** (`AGENT_FPS`). Frames never leave the server side: nothing is sent by the client.

```
LiveKit  --webhook (room_started / participant_joined / track_published)-->  agent  (+ reconcile with ListRooms every 30 s)
agent    --1 fps frame-->  object-service  (/v1/detect)      face-service (/v1/embed)
agent    --signed-->  core  GET /api/internal/v1/agent/attempts/{id}  (running? which checks? has a reference face?)
agent    --signed-->  record  POST /internal/v1/evidence     (the frame as evidence)
agent    --signed-->  core  POST /api/internal/v1/events/bulk (the violation, with evidence_id)
```

Rules (`agent/rules.py`):

| Check | Source | Fires when | Quiet afterwards |
|---|---|---|---|
| `PROHIBITED_DEVICE` | candidate camera (`ai_objects`) and phone camera (`extra_camera_objects`) | the same prohibited label is seen in 2 of the last 3 frames | 60 s per label |
| `FACE_MISMATCH` | candidate camera (`ai_identity`) | the face differs from the enrolled photo (cosine < 0.35) in 3 of the last 5 single-face frames | 120 s |

The enrolled photo comes from the core (`has_reference`); students without one are not judged, and the lobby makes them
enrol first. Findings are estimates, so they wait for a proctor like every AI violation.

Environment: `LIVEKIT_URL` (as the agent reaches it, `ws://livekit:7880`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`CORE_URL`, `RT_INTERNAL_SECRET`, `RECORD_URL` (internal), `AI_FACE_URL`, `AI_OBJECT_URL`, `AI_TOKEN`, `AGENT_FPS`.
Add the agent to LiveKit's webhook list next to the record service (`webhook.urls: [..., "https://<agent>/webhook"]`)
and set `AI_AGENT_URL` in the core so exams that need AI wait for the agent's `/health`.

Capacity: at 1 fps every watched camera costs about one object call (~80 ms CPU) and, with identity on, one embedding
(~35 ms). One CPU core therefore follows roughly 8 to 10 candidates; a GPU box or more cores scale it linearly.

Limits worth knowing: COCO has no "headphones / earpiece" class, so those need a custom-trained model
(`PROHIBITED_LABELS` and `object-service/app/engine.py` are the places to extend).

## Run

```bash
cd ai/face-service   && pip install -r requirements-dev.txt && pytest && uvicorn app.main:app --port 8090
cd ai/object-service && pip install -r requirements-dev.txt && pytest && uvicorn app.main:app --port 8091
cd ai/supervisor-agent && pip install -r requirements-dev.txt && pytest && uvicorn agent.main:create_app --factory --port 8099
# or: docker build -t foxy-face ai/face-service && docker run -p 8090:8090 -e AI_TOKEN=secret -v foxy-models:/models foxy-face
```

The tests use fake engines (no model download). The real engines were exercised on a sample photo: the same person
scores 0.99, a different person -0.01 against the 0.35 threshold.
