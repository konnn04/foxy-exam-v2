import hashlib
import hmac
import json

import httpx
import numpy as np
import pytest

from agent.clients import AI, AttemptInfo, Core
from agent.config import Config
from agent.frames import Throttle, to_jpeg
from agent.pipeline import Pipeline
from agent.rules import IdentityRule, ObjectRule
from agent.signing import SIGNATURE, TIMESTAMP, sign
from agent.supervisor import classify, watched_room

CFG = Config(
    livekit_url="ws://lk", api_key="k", api_secret="s", core_url="http://core", internal_secret="internal",
    record_url="http://rec", face_url="http://face", object_url="http://obj", ai_token="tok",
)


def info(**o) -> AttemptInfo:
    base = dict(attempt_id=7, exam_id=2, user_id=3, org_id=4, running=True, ai_objects=True, ai_identity=True, extra_camera_objects=True, has_reference=True)
    return AttemptInfo(**{**base, **o})


# ---------------------------------------------------------------- pure rules

def test_an_object_must_appear_in_two_of_three_frames_and_then_is_quiet_for_a_minute():
    r = ObjectRule(cooldown=60)
    assert r.update({"cell phone"}, 0) == []
    assert r.update(set(), 1) == []
    assert r.update({"cell phone"}, 2) == ["cell phone"]
    assert r.update({"cell phone"}, 3) == [] and r.update({"cell phone"}, 4) == []
    assert r.update({"cell phone"}, 70) == ["cell phone"], "still there after the cooldown: reported again"


def test_two_different_objects_are_judged_separately():
    r = ObjectRule()
    r.update({"book"}, 0)
    assert r.update({"book", "cell phone"}, 1) == ["book"]
    assert r.update({"cell phone"}, 2) == ["cell phone"]


def test_a_different_face_must_persist_and_unknown_frames_are_ignored():
    r = IdentityRule(threshold=0.35, cooldown=120)
    assert [r.update(0.1, t) for t in (0, 1)] == [False, False]
    assert r.update(None, 2) is False  # no face / several faces: nothing to judge, nothing counted
    assert r.update(0.9, 3) is False  # the right person again
    assert r.update(0.1, 4) is True  # 3 of the last 5 single-face frames were someone else


def test_the_throttle_passes_one_frame_per_second_whatever_the_video_rate():
    t = Throttle(1.0)
    passed = [t.allow(i * 0.033) for i in range(100)]  # 30 fps video for 3.3 s
    assert sum(passed) == 4  # frames at 0, ~1, ~2, ~3 s


def test_frames_become_small_jpegs():
    rgb = np.zeros((1080, 1920, 3), dtype=np.uint8)
    jpeg = to_jpeg(rgb)
    assert jpeg[:2] == b"\xff\xd8" and len(jpeg) < 20_000


def test_only_candidate_cameras_and_the_phone_room_are_watched():
    assert classify("exam-2", "attempt-7") == ("a7", "camera", ("attempt", 7))
    assert classify("cam2-3-2", "phone") == ("p3-2", "phone", ("phone", 3, 2))
    assert classify("exam-2", "proctor-1") is None
    assert classify("cam2-3-2", "attempt-7") is None
    assert classify("lobby-3-2", "phone") is None
    assert watched_room("exam-2") and watched_room("cam2-3-2") and not watched_room("random")


# ---------------------------------------------------------------- signing + clients

def test_signing_matches_the_scheme_of_the_go_and_php_sides():
    h = sign("internal", b'{"a":1}', now=1_700_000_000)
    expect = hmac.new(b"internal", b'1700000000.{"a":1}', hashlib.sha256).hexdigest()
    assert h == {TIMESTAMP: "1700000000", SIGNATURE: expect}


@pytest.mark.asyncio
async def test_core_calls_are_signed_and_violations_carry_their_evidence():
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        if req.url.path.endswith("/events/bulk"):
            return httpx.Response(200, json={"ok": True})
        return httpx.Response(404)

    core = Core(CFG, httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    assert await core.violation(info(), "PROHIBITED_DEVICE", "HIGH", {"message": "x"}, "ev1", 1_700_000_000.0) is True
    req = seen[0]
    assert req.headers[TIMESTAMP] and req.headers[SIGNATURE]
    body = json.loads(req.content)
    item = body["violations"][0]
    assert item["attempt_id"] == 7 and item["violation_type"] == "PROHIBITED_DEVICE" and item["evidence_id"] == "ev1"
    assert item["client_event_id"].startswith("agent:7:PROHIBITED_DEVICE:")
    # the signature covers the exact body that was sent
    assert req.headers[SIGNATURE] == hmac.new(b"internal", req.headers[TIMESTAMP].encode() + b"." + req.content, hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- the pipeline

class FakeCore:
    def __init__(self):
        self.violations: list[tuple] = []
        self.uploads = 0

    async def face_reference(self, attempt_id):
        return b"reference-photo"

    async def upload_evidence(self, inf, jpeg):
        self.uploads += 1
        return f"ev{self.uploads}"

    async def violation(self, inf, vtype, severity, details, evidence_id, now):
        self.violations.append((vtype, severity, details, evidence_id))
        return True


class FakeAI:
    def __init__(self):
        self.labels: dict[str, float] = {}
        self.embeddings: list[tuple[int, np.ndarray | None]] = []
        self.calls = {"prohibited": 0, "embedding": 0}

    async def prohibited(self, jpeg):
        self.calls["prohibited"] += 1
        return self.labels

    async def embedding(self, jpeg):
        self.calls["embedding"] += 1
        return self.embeddings.pop(0) if self.embeddings else (1, np.asarray([1.0, 0.0]))


def pipeline(**o):
    core, ai = FakeCore(), FakeAI()
    clock = [0.0]
    p = Pipeline(core, ai, clock=lambda: clock[0])  # type: ignore[arg-type]
    inf = info(**o)

    async def resolve():
        return inf

    async def run(source="camera", n=1, key="a7", step=1.0):
        out = []
        for _ in range(n):
            out += await p.process(key, source, b"jpeg", resolve)
            clock[0] += step
        return out

    return p, core, ai, run, inf


@pytest.mark.asyncio
async def test_a_phone_in_view_for_two_seconds_becomes_a_violation_with_a_picture():
    p, core, ai, run, _ = pipeline()
    ai.labels = {"cell phone": 0.8}
    assert await run(n=1) == []
    assert await run(n=1) == ["PROHIBITED_DEVICE"]
    vtype, severity, details, evidence = core.violations[0]
    assert (vtype, severity, evidence) == ("PROHIBITED_DEVICE", "HIGH", "ev1")
    assert details["evidence"] == {"camera": "ev1"} and details["labels"] == ["cell phone"] and details["source"] == "agent:objects"


@pytest.mark.asyncio
async def test_the_phone_camera_is_checked_for_objects_only_when_the_exam_asks_for_it():
    p, core, ai, run, _ = pipeline(extra_camera_objects=False)
    ai.labels = {"book": 0.9}
    await run(source="phone", n=4, key="p3-2")
    assert core.violations == [] and ai.calls["prohibited"] == 0

    p2, core2, ai2, run2, _ = pipeline(extra_camera_objects=True)
    ai2.labels = {"book": 0.9}
    await run2(source="phone", n=2, key="p3-2")
    assert core2.violations[0][2]["evidence"] == {"phone": "ev1"} and core2.violations[0][2]["source"] == "agent:objects:phone"
    assert ai2.calls["embedding"] == 0, "identity is only judged on the candidate's own camera"


@pytest.mark.asyncio
async def test_another_person_in_front_of_the_camera_raises_face_mismatch():
    p, core, ai, run, _ = pipeline(ai_objects=False)
    # the reference embedding first, then frames showing someone else
    ai.embeddings = [(1, np.asarray([1.0, 0.0]))] + [(1, np.asarray([0.0, 1.0]))] * 5
    out = await run(n=3)
    assert out == ["FACE_MISMATCH"]
    assert core.violations[0][2]["similarity"] == 0.0


@pytest.mark.asyncio
async def test_the_same_person_and_frames_without_a_single_face_raise_nothing():
    p, core, ai, run, _ = pipeline(ai_objects=False)
    ai.embeddings = [(1, np.asarray([1.0, 0.0])), (1, np.asarray([0.99, 0.05])), (0, None), (2, np.asarray([0.0, 1.0])), (1, np.asarray([1.0, 0.0]))]
    assert await run(n=4) == []


@pytest.mark.asyncio
async def test_a_finished_attempt_is_forgotten_and_nothing_is_analysed():
    p, core, ai, run, inf = pipeline()
    ai.labels = {"cell phone": 0.8}
    await run(n=1)
    inf.running = False
    p.states["a7"].info_at = float("-inf")  # force the core to be asked again
    assert await run(n=3) == []
    assert "a7" not in p.states


@pytest.mark.asyncio
async def test_without_an_enrolled_reference_identity_is_not_judged():
    p, core, ai, run, _ = pipeline(ai_objects=False, has_reference=False)
    await run(n=5)
    assert ai.calls["embedding"] == 0 and core.violations == []


# ---------------------------------------------------------------- the HTTP shell

def _signed_webhook(body: str) -> dict[str, str]:
    from livekit import api

    sha = __import__("base64").b64encode(hashlib.sha256(body.encode()).digest()).decode()
    token = api.AccessToken(CFG.api_key, CFG.api_secret).with_grants(api.VideoGrants()).with_sha256(sha).to_jwt()
    return {"Authorization": token}


def test_health_and_webhook_authentication():
    from fastapi.testclient import TestClient

    from agent.main import create_app

    c = TestClient(create_app(CFG))  # no lifespan: nothing connects to LiveKit in a test
    assert c.get("/health").json()["ok"] is True

    body = json.dumps({"event": "room_started", "room": {"name": "exam-2"}})
    assert c.post("/webhook", content=body, headers={"Authorization": "nope"}).status_code == 401
    assert c.post("/webhook", content=body, headers=_signed_webhook(body)).status_code == 200
    tampered = body.replace("exam-2", "exam-3")
    assert c.post("/webhook", content=tampered, headers=_signed_webhook(body)).status_code == 401
