from __future__ import annotations

import os
import secrets

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile

from .engine import DEFAULT_PROHIBITED, ObjectEngine

MAX_BYTES = 6 * 1024 * 1024
TOKEN = os.getenv("AI_TOKEN", "")
PROHIBITED = tuple(s.strip() for s in os.getenv("PROHIBITED_LABELS", ",".join(DEFAULT_PROHIBITED)).split(",") if s.strip())


def create_app(engine: ObjectEngine | None = None, prohibited: tuple[str, ...] = PROHIBITED) -> FastAPI:
    engine = engine or ObjectEngine()
    app = FastAPI(title="FoxyExam prohibited-object service", version="1.0.0")

    def guard(x_ai_token: str = Header(default="")):
        if TOKEN and not secrets.compare_digest(x_ai_token, TOKEN):
            raise HTTPException(401, "invalid token")

    @app.get("/health")
    def health():
        return {"ok": True, "service": "objects", "ready": engine.ready, "prohibited": list(prohibited)}

    @app.post("/v1/detect", dependencies=[Depends(guard)])
    async def detect(frame: UploadFile = File(...), min_score: float = Query(0.5, ge=0.1, le=0.99)):
        data = await frame.read(MAX_BYTES + 1)
        if not data or len(data) > MAX_BYTES:
            raise HTTPException(413 if data else 400, "image missing or too large")
        try:
            found = engine.detect(data, min_score)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(400, f"cannot analyse image: {e}") from e
        objects = [{"label": d.label, "score": round(d.score, 3), "bbox": [round(v, 1) for v in d.bbox]} for d in found]
        flagged = sorted({d.label for d in found if d.label in prohibited})
        return {"objects": objects, "prohibited": flagged}

    return app


app = create_app()
