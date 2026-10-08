import io

from fastapi.testclient import TestClient
from PIL import Image

from app.engine import Detection
from app.main import create_app


class FakeEngine:
    ready = True

    def __init__(self, found):
        self.found = found

    def detect(self, data, min_score):
        return [d for d in self.found if d.score >= min_score]


def png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buf, "PNG")
    return buf.getvalue()


def client(found, prohibited=("cell phone", "book")):
    return TestClient(create_app(FakeEngine(found), prohibited))


def det(label, score):
    return Detection(label, score, (0, 0, 5, 5))


def test_prohibited_labels_are_reported_separately_from_everything_seen():
    c = client([det("person", 0.99), det("cell phone", 0.8), det("cup", 0.9)])
    r = c.post("/v1/detect", files={"frame": ("f.png", png(), "image/png")}).json()
    assert {o["label"] for o in r["objects"]} == {"person", "cell phone", "cup"}
    assert r["prohibited"] == ["cell phone"]


def test_min_score_filters_weak_detections():
    c = client([det("cell phone", 0.4), det("book", 0.9)])
    r = c.post("/v1/detect?min_score=0.6", files={"frame": ("f.png", png(), "image/png")}).json()
    assert r["prohibited"] == ["book"]


def test_a_clean_frame_has_nothing_prohibited():
    r = client([det("person", 0.99)]).post("/v1/detect", files={"frame": ("f.png", png(), "image/png")}).json()
    assert r["prohibited"] == []


def test_health_lists_the_policy():
    assert client([]).get("/health").json()["prohibited"] == ["cell phone", "book"]


def test_empty_upload_is_rejected():
    r = client([]).post("/v1/detect", files={"frame": ("f.png", b"", "image/png")})
    assert r.status_code == 400
