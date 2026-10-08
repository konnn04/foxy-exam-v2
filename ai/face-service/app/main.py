from __future__ import annotations

import os
import secrets

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

from .engine import FaceEngine, decode, largest, similarity

MAX_BYTES = 6 * 1024 * 1024
THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.35"))
TOKEN = os.getenv("AI_TOKEN", "")


def create_app(engine: FaceEngine | None = None) -> FastAPI:
    engine = engine or FaceEngine(os.getenv("FACE_MODEL", "buffalo_s"))
    app = FastAPI(title="FoxyExam face service", version="1.0.0")

    def guard(x_ai_token: str = Header(default="")):
        if TOKEN and not secrets.compare_digest(x_ai_token, TOKEN):
            raise HTTPException(401, "invalid token")

    async def read(upload: UploadFile):
        data = await upload.read(MAX_BYTES + 1)
        if not data or len(data) > MAX_BYTES:
            raise HTTPException(413 if data else 400, "image missing or too large")
        try:
            return decode(data)
        except Exception as e:  # noqa: BLE001 - any decoder failure is a bad upload
            raise HTTPException(400, f"not an image: {e}") from e

    @app.get("/health")
    def health():
        return {"ok": True, "service": "face", "model": engine.model, "ready": engine.ready}

    @app.post("/v1/faces", dependencies=[Depends(guard)])
    async def faces(frame: UploadFile = File(...)):
        found = engine.analyze(await read(frame))
        return {
            "count": len(found),
            "faces": [{"bbox": [round(v, 1) for v in f.bbox], "score": round(f.score, 3)} for f in found],
        }

    @app.post("/v1/verify", dependencies=[Depends(guard)])
    async def verify(reference: UploadFile = File(...), frame: UploadFile = File(...)):
        ref_faces = engine.analyze(await read(reference))
        cam_faces = engine.analyze(await read(frame))
        out = {"threshold": THRESHOLD, "reference_faces": len(ref_faces), "frame_faces": len(cam_faces), "match": None, "similarity": None, "reason": None}
        if len(ref_faces) == 0:
            out["reason"] = "no_face_in_reference"
        elif len(cam_faces) == 0:
            out["reason"] = "no_face_in_frame"
        elif len(cam_faces) > 1:
            out["reason"] = "multiple_faces_in_frame"
        else:
            score = similarity(largest(ref_faces).embedding, cam_faces[0].embedding)
            out.update(similarity=round(score, 4), match=score >= THRESHOLD)
        return out

    return app


app = create_app()
