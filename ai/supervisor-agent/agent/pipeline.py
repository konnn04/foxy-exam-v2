from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

import numpy as np

from .clients import AI, AttemptInfo, Core, cosine
from .frames import annotate_boxes
from .rules import IdentityRule, MultiPersonRule, ObjectRule, PhoneDriftRule

INFO_TTL = 30.0  # how long the attempt's config is trusted before the core is asked again
FRAME_STALE_SEC = 15.0  # maximum age for bundling companion stream frames (camera / phone / screen)
SCREEN_LABELS = {"laptop", "tv", "monitor"}

Resolve = Callable[[], Awaitable["AttemptInfo | None"]]


@dataclass
class State:
    info: AttemptInfo | None = None
    info_at: float = float("-inf")
    objects: ObjectRule = field(default_factory=ObjectRule)
    identity: IdentityRule = field(default_factory=IdentityRule)
    multi_person: MultiPersonRule = field(default_factory=MultiPersonRule)
    phone_drift: PhoneDriftRule = field(default_factory=PhoneDriftRule)
    reference: np.ndarray | None = None
    reference_tried: bool = False


class Pipeline:
    """One frame in, violations out. The same code serves the candidate's camera and the phone camera (`source`)."""

    def __init__(self, core: Core, ai: AI, clock: Callable[[], float] = time.time):
        self.core, self.ai, self.clock = core, ai, clock
        self.states: dict[str, State] = {}
        # latest frames per attempt_id -> {"camera": (jpeg, ts), "phone": (jpeg, ts), "screen": (jpeg, ts)}
        self.latest_frames: dict[int, dict[str, tuple[bytes, float]]] = {}

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

    def record_frame(self, attempt_id: int, stream_key: str, jpeg: bytes, now: float | None = None) -> None:
        """Caches the latest frame for a stream (`camera`, `phone`, `screen`) to bundle multi-angle evidence."""
        t = self.clock() if now is None else now
        self.latest_frames.setdefault(attempt_id, {})[stream_key] = (jpeg, t)

    async def _detect_objects(self, jpeg: bytes, labels: tuple[str, ...]) -> tuple[dict[str, float], list[dict]]:
        if hasattr(self.ai, "detect"):
            return await self.ai.detect(jpeg, labels)
        found = await self.ai.prohibited(jpeg, labels)
        return found, []

    async def process(self, key: str, source: str, jpeg: bytes, resolve: Resolve) -> list[str]:
        """`source` is "camera" (the candidate's computer) or "phone". Returns the violation types raised for this frame."""
        now = self.clock()
        st = self.states.setdefault(key, State())
        info = await self._info(key, st, resolve, now)
        if info is None or not info.running:
            if st.info is not None:
                self.latest_frames.pop(st.info.attempt_id, None)
            self.states.pop(key, None)  # the attempt is over (or unknown): forget it
            return []

        evidence_key = "phone" if source == "phone" else "camera"
        self.record_frame(info.attempt_id, evidence_key, jpeg, now)

        raised: list[str] = []

        if (info.extra_camera_objects if source == "phone" else info.ai_objects):
            found, raw_objects = await self._detect_objects(jpeg, info.prohibited_labels)
            for label in st.objects.update(set(found), now):
                matching_boxes = [o for o in raw_objects if o.get("label") == label]
                annotated = annotate_boxes(jpeg, matching_boxes)
                await self._raise(info, "PROHIBITED_DEVICE", "HIGH", annotated, evidence_key, now, {
                    "message": ("Camera phụ phát hiện vật cấm: " if source == "phone" else "Phát hiện vật cấm: ") + label,
                    "labels": [label],
                    "score": round(found.get(label, 0.0), 3),
                    "bboxes": [o.get("bbox") for o in matching_boxes if o.get("bbox")],
                    "source": "agent:objects:phone" if source == "phone" else "agent:objects",
                })
                raised.append("PROHIBITED_DEVICE")

            if source == "phone" and raw_objects:
                persons = [o for o in raw_objects if o.get("label") == "person"]
                screens = [o for o in raw_objects if o.get("label") in SCREEN_LABELS]
                if st.multi_person.update(len(persons), now):
                    annotated = annotate_boxes(jpeg, persons)
                    await self._raise(info, "MULTIPLE_PEOPLE", "HIGH", annotated, evidence_key, now, {
                        "message": f"Camera phụ phát hiện nhiều người trong khu vực thi ({len(persons)} người)",
                        "person_count": len(persons),
                        "source": "agent:objects:phone",
                    })
                    raised.append("MULTIPLE_PEOPLE")

                if st.phone_drift.update(len(persons) >= 1, len(screens) >= 1, now):
                    await self._raise(info, "PHONE_ORIENTATION_INVALID", "MEDIUM", jpeg, evidence_key, now, {
                        "message": "Camera phụ bị lệch góc (không thấy đồng thời thí sinh và màn hình laptop)",
                        "has_person": len(persons) >= 1,
                        "has_screen": len(screens) >= 1,
                        "source": "agent:objects:phone",
                    })
                    raised.append("PHONE_ORIENTATION_INVALID")

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
        evidence_map: dict[str, str] = {}
        if evidence_id:
            evidence_map[evidence_key] = evidence_id

        # Bundle companion angles (e.g. screen + phone when camera triggers, or camera + screen when phone triggers)
        companions = self.latest_frames.get(info.attempt_id, {})
        for other_key, (other_jpeg, ts) in list(companions.items()):
            if other_key != evidence_key and (now - ts) <= FRAME_STALE_SEC:
                other_id = await self.core.upload_evidence(info, other_jpeg)
                if other_id:
                    evidence_map[other_key] = other_id

        if evidence_map:
            details = {**details, "evidence": evidence_map}
        await self.core.violation(info, vtype, severity, details, evidence_id, now)
