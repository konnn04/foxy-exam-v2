# FoxyExam AI services

Two small HTTP services, **not part of `docker.compose.server.yml`**: run them on any machine that can reach the
core (a laptop or GPU box behind a tunnel works). The core calls them only through `App\Services\AiService`
(`AI_FACE_URL`, `AI_OBJECT_URL`, `AI_TOKEN`); when they are absent exams still run, the on-device MediaPipe
checks keep working and `AI_ENFORCE=false` lets exams that ask for face monitoring start.

| Service | Port | Model | Endpoints |
|---|---|---|---|
| `face-service` | 8090 | insightface `buffalo_s` (ArcFace embeddings, CPU) | `GET /health`, `POST /v1/faces`, `POST /v1/verify` |
| `object-service` | 8091 | torchvision SSDLite320 MobileNetV3 (COCO, CPU) | `GET /health`, `POST /v1/detect?min_score=0.5` |

Measured on CPU after warm-up: face ≈ 35 ms, objects ≈ 80 ms per frame. The first request downloads the weights
(`~/.insightface`, `~/.cache/torch`; the Dockerfiles point them at `/models`, mount a volume to keep them).

All writes need the header `X-AI-Token` equal to `AI_TOKEN` when that variable is set.

## Contract

```
POST /v1/faces    multipart: frame            -> {count, faces:[{bbox, score}]}
POST /v1/verify   multipart: reference, frame -> {match, similarity, threshold, reference_faces, frame_faces, reason}
                  reason (when match is null): no_face_in_reference | no_face_in_frame | multiple_faces_in_frame
POST /v1/detect   multipart: frame            -> {objects:[{label, score, bbox}], prohibited:[label]}
```

Environment: `AI_TOKEN`, `FACE_MODEL` (default `buffalo_s`), `FACE_MATCH_THRESHOLD` (cosine, default `0.35`),
`PROHIBITED_LABELS` (default `cell phone,laptop,book,remote,tv`).

## How the exam uses them

1. FoxyClient sends one camera frame every ~40 s (`POST /api/v1/student/ai/frame`, rate limited, only for exams with
   `ai_face_check`).
2. The first frame with exactly one face is stored privately as the **reference of that attempt** and deleted when
   the attempt ends. Later frames are verified against it: a different person raises `FACE_MISMATCH`.
3. Every frame goes to the object service: a prohibited object raises `PROHIBITED_DEVICE` (at most once a minute).
4. Both are estimates, so they wait for a proctor. When a frame is flagged the client uploads it through the record
   service and attaches it to the violation as evidence.

Limits worth knowing: COCO has no "headphones / earpiece" class, so those need a custom-trained model
(`PROHIBITED_LABELS` and `object-service/app/engine.py` are the places to extend). A student photo on the profile
is not used (profile avatars are generated images); enrol one later by storing it as the reference.

## Run

```bash
cd ai/face-service   && pip install -r requirements-dev.txt && pytest && uvicorn app.main:app --port 8090
cd ai/object-service && pip install -r requirements-dev.txt && pytest && uvicorn app.main:app --port 8091
# or: docker build -t foxy-face ai/face-service && docker run -p 8090:8090 -e AI_TOKEN=secret -v foxy-models:/models foxy-face
```

The tests use fake engines (no model download). The real engines were exercised on a sample photo: the same person
scores 0.99, a different person -0.01 against the 0.35 threshold.
