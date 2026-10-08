import io

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from app.engine import Face, similarity
from app.main import create_app


class FakeEngine:
    model = "fake"
    ready = True

    def __init__(self, by_pixel: dict[int, list[Face]]):
        self.by_pixel = by_pixel

    def analyze(self, image):
        return self.by_pixel.get(int(image[0, 0, 0]), [])


def png(value: int) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(np.full((8, 8, 3), value, dtype=np.uint8)).save(buf, "PNG")
    return buf.getvalue()


def face(vec):
    return Face((0, 0, 10, 10), 0.99, np.asarray(vec, dtype=np.float32))


def client(by_pixel):
    return TestClient(create_app(FakeEngine(by_pixel)))


def files(ref=None, frame=None):
    out = {}
    if ref is not None:
        out["reference"] = ("a.png", png(ref), "image/png")
    if frame is not None:
        out["frame"] = ("b.png", png(frame), "image/png")
    return out


def test_similarity_is_cosine():
    assert similarity(np.array([1, 0]), np.array([1, 0])) == 1.0
    assert abs(similarity(np.array([1, 0]), np.array([0, 1]))) < 1e-9
    assert similarity(np.zeros(2), np.array([1, 0])) == 0.0


def test_health_reports_the_model():
    r = client({}).get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_faces_counts_what_the_engine_sees():
    c = client({10: [face([1, 0]), face([0, 1])]})
    r = c.post("/v1/faces", files=files(frame=10))
    assert r.json()["count"] == 2


def test_verify_matches_the_same_person_and_rejects_another():
    c = client({1: [face([1, 0, 0])], 2: [face([0.99, 0.05, 0])], 3: [face([0, 1, 0])]})
    same = c.post("/v1/verify", files=files(1, 2)).json()
    other = c.post("/v1/verify", files=files(1, 3)).json()
    assert same["match"] is True and same["similarity"] > 0.9
    assert other["match"] is False


def test_verify_explains_why_it_cannot_decide():
    c = client({1: [face([1, 0])], 4: [face([1, 0]), face([0, 1])]})
    none = c.post("/v1/verify", files=files(1, 9)).json()
    many = c.post("/v1/verify", files=files(1, 4)).json()
    noref = c.post("/v1/verify", files=files(9, 1)).json()
    assert (none["match"], none["reason"]) == (None, "no_face_in_frame")
    assert (many["match"], many["reason"]) == (None, "multiple_faces_in_frame")
    assert (noref["match"], noref["reason"]) == (None, "no_face_in_reference")


def test_garbage_upload_is_a_400():
    r = client({}).post("/v1/faces", files={"frame": ("f.png", b"not an image", "image/png")})
    assert r.status_code == 400
