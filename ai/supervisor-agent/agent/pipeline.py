from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

import numpy as np

from .clients import AI, AttemptInfo, Core, cosine
from .rules import IdentityRule, ObjectRule

INFO_TTL = 30.0  # how long the attempt's config is trusted before the core is asked again

Resolve = Callable[[], Awaitable["AttemptInfo | None"]]


@dataclass
class State:
    info: AttemptInfo | None = None
    info_at: float = float("-inf")
    objects: ObjectRule = field(default_factory=ObjectRule)
    identity: IdentityRule = field(default_factory=IdentityRule)
    reference: np.ndarray | None = None
    reference_tried: bool = False


class Pipeline:
    """One frame in, violations out. The same code serves the candidate's camera and the phone camera (`source`)."""

    def __init__(self, core: Core, ai: AI, clock: Callable[[], float] = time.time):
        self.core, self.ai, self.clock = core, ai, clock
        self.states: dict[str, State] = {}

    async def _info(self, key: str, st: State, resolve: Resolve, now: float) -> AttemptInfo | None:
        if now - st.info_at > INFO_TTL:
            st.info, st.info_at = await resolve(), now
        return st.info

    async def _reference(self, st: State, info: AttemptInfo) -> np.ndarray | None:
        if st.reference is None and not st.reference_tried and info.has_reference:
            st.reference_tried = True
            photo = await self.core.face_reference(info.attempt_id)
            if photo:
                count, emb = await self.ai.embedding(photo)
                if count >= 1 and emb is not None:
                    st.reference = emb
        return st.reference

    async def process(self, key: str, source: str, jpeg: bytes, resolve: Resolve) -> list[str]:
        """`source` is "camera" (the candidate's computer) or "phone". Returns the violation types raised for this frame."""
        now = self.clock()
        st = self.states.setdefault(key, State())
        info = await self._info(key, st, resolve, now)
        if info is None or not info.running:
            self.states.pop(key, None)  # the attempt is over (or unknown): forget it
            return []

        raised: list[str] = []
        evidence_key = "phone" if source == "phone" else "camera"

        if (info.extra_camera_objects if source == "phone" else info.ai_objects):
            found = await self.ai.prohibited(jpeg)
            for label in st.objects.update(set(found), now):
                await self._raise(info, "PROHIBITED_DEVICE", "HIGH", jpeg, evidence_key, now, {
                    "message": ("Camera phụ phát hiện vật cấm: " if source == "phone" else "Phát hiện vật cấm: ") + label,
                    "labels": [label],
                    "score": round(found.get(label, 0.0), 3),
                    "source": "agent:objects:phone" if source == "phone" else "agent:objects",
                })
                raised.append("PROHIBITED_DEVICE")

        if info.ai_identity and source == "camera":
            ref = await self._reference(st, info)
            similarity: float | None = None
            if ref is not None:
                count, emb = await self.ai.embedding(jpeg)
                if count == 1 and emb is not None:
                    similarity = cosine(ref, emb)
            if st.identity.update(similarity, now):
                await self._raise(info, "FACE_MISMATCH", "HIGH", jpeg, evidence_key, now, {
                    "message": "Khuôn mặt khác với khuôn mặt đã đăng ký của sinh viên",
                    "similarity": round(similarity if similarity is not None else 0.0, 4),
                    "threshold": st.identity.threshold,
                    "source": "agent:face",
                })
                raised.append("FACE_MISMATCH")
        return raised

    async def _raise(self, info: AttemptInfo, vtype: str, severity: str, jpeg: bytes, evidence_key: str, now: float, details: dict) -> None:
        evidence_id = await self.core.upload_evidence(info, jpeg)
        if evidence_id:
            details = {**details, "evidence": {evidence_key: evidence_id}}
        await self.core.violation(info, vtype, severity, details, evidence_id, now)
