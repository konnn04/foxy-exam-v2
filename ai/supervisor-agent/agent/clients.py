from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
import numpy as np

from .config import Config
from .signing import sign


@dataclass
class AttemptInfo:
    attempt_id: int
    exam_id: int
    user_id: int
    org_id: int
    running: bool
    ai_objects: bool
    ai_identity: bool
    extra_camera_objects: bool
    has_reference: bool

    @staticmethod
    def parse(d: dict) -> "AttemptInfo":
        c = d.get("config", {})
        return AttemptInfo(
            attempt_id=int(d["attempt_id"]), exam_id=int(d["exam_id"]), user_id=int(d["user_id"]), org_id=int(d.get("org_id", 0)),
            running=bool(d.get("running")), ai_objects=bool(c.get("ai_objects")), ai_identity=bool(c.get("ai_identity")),
            extra_camera_objects=bool(c.get("extra_camera_objects")), has_reference=bool(d.get("has_reference")),
        )


class Core:
    """Signed calls into the Laravel core and the record service."""

    def __init__(self, cfg: Config, http: httpx.AsyncClient | None = None):
        self.cfg = cfg
        self.http = http or httpx.AsyncClient(timeout=8.0)

    def _signed(self, body: bytes = b"") -> dict[str, str]:
        return sign(self.cfg.internal_secret, body)

    async def attempt(self, attempt_id: int) -> AttemptInfo | None:
        r = await self.http.get(f"{self.cfg.core_url}/api/internal/v1/agent/attempts/{attempt_id}", headers=self._signed())
        return AttemptInfo.parse(r.json()) if r.status_code == 200 else None

    async def lookup(self, user_id: int, exam_id: int) -> AttemptInfo | None:
        r = await self.http.get(f"{self.cfg.core_url}/api/internal/v1/agent/attempts/lookup", params={"user": user_id, "exam": exam_id}, headers=self._signed())
        return AttemptInfo.parse(r.json()) if r.status_code == 200 else None

    async def face_reference(self, attempt_id: int) -> bytes | None:
        r = await self.http.get(f"{self.cfg.core_url}/api/internal/v1/agent/attempts/{attempt_id}/face-reference", headers=self._signed())
        return r.content if r.status_code == 200 else None

    async def upload_evidence(self, info: AttemptInfo, jpeg: bytes) -> str | None:
        r = await self.http.post(
            f"{self.cfg.record_url}/internal/v1/evidence",
            params={"exam_id": info.exam_id, "attempt_id": info.attempt_id, "org_id": info.org_id},
            content=jpeg,
            headers={**self._signed(jpeg), "Content-Type": "image/jpeg"},
        )
        return r.json().get("evidence_id") if r.status_code == 200 else None

    async def violation(self, info: AttemptInfo, vtype: str, severity: str, details: dict, evidence_id: str | None, now: float) -> bool:
        occurred = datetime.fromtimestamp(now, tz=timezone.utc).isoformat()
        item = {
            "client_event_id": f"agent:{info.attempt_id}:{vtype}:{int(now * 1000)}",
            "attempt_id": info.attempt_id,
            "violation_type": vtype,
            "severity": severity,
            "details": details,
            "occurred_at": occurred,
        }
        if evidence_id:
            item["evidence_id"] = evidence_id
        body = json.dumps({"batch_id": item["client_event_id"], "violations": [item]}).encode()
        r = await self.http.post(f"{self.cfg.core_url}/api/internal/v1/events/bulk", content=body, headers={**self._signed(body), "Content-Type": "application/json"})
        return r.status_code == 200


class AI:
    """The face and object services."""

    def __init__(self, cfg: Config, http: httpx.AsyncClient | None = None):
        self.cfg = cfg
        self.http = http or httpx.AsyncClient(timeout=6.0)
        self.headers = {"X-AI-Token": cfg.ai_token} if cfg.ai_token else {}

    async def prohibited(self, jpeg: bytes) -> dict[str, float]:
        """Prohibited labels in the picture with their best score."""
        r = await self.http.post(f"{self.cfg.object_url}/v1/detect", params={"min_score": 0.5}, files={"frame": ("f.jpg", jpeg, "image/jpeg")}, headers=self.headers)
        if r.status_code != 200:
            return {}
        out = r.json()
        flagged = set(out.get("prohibited", []))
        best: dict[str, float] = {}
        for o in out.get("objects", []):
            if o["label"] in flagged:
                best[o["label"]] = max(best.get(o["label"], 0.0), float(o["score"]))
        return best

    async def embedding(self, jpeg: bytes) -> tuple[int, np.ndarray | None]:
        r = await self.http.post(f"{self.cfg.face_url}/v1/embed", files={"frame": ("f.jpg", jpeg, "image/jpeg")}, headers=self.headers)
        if r.status_code != 200:
            return 0, None
        d = r.json()
        return int(d["count"]), (np.asarray(d["embedding"], dtype=np.float32) if d.get("embedding") else None)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = float(np.linalg.norm(a)), float(np.linalg.norm(b))
    return 0.0 if na == 0 or nb == 0 else float(np.dot(a, b) / (na * nb))
