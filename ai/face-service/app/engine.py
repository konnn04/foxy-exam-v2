from __future__ import annotations

import io
import os
import threading
from dataclasses import dataclass

import numpy as np
from PIL import Image


@dataclass
class Face:
    bbox: tuple[float, float, float, float]
    score: float
    embedding: np.ndarray


def _providers() -> list[str]:
    """ONNX Runtime providers: CUDA when AI_DEVICE allows it and onnxruntime-gpu sees a GPU, else CPU."""
    want = os.environ.get("AI_DEVICE", "auto").lower()
    if want == "cpu":
        return ["CPUExecutionProvider"]
    try:
        import onnxruntime as ort

        if "CUDAExecutionProvider" in ort.get_available_providers():
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    except Exception:  # noqa: BLE001 - no runtime at all: let insightface report it on load
        pass
    if want == "cuda":
        raise RuntimeError("AI_DEVICE=cuda but onnxruntime has no CUDAExecutionProvider (install onnxruntime-gpu, expose the GPU)")
    return ["CPUExecutionProvider"]


class FaceEngine:
    """Detects faces and computes ArcFace embeddings (insightface). GPU (CUDA) when available, else CPU. Loads on first use."""

    def __init__(self, model: str = "buffalo_s", det_size: int = 320):
        self.model = model
        self.det_size = det_size
        self._app = None
        self._lock = threading.Lock()
        self.device = "cpu"

    @property
    def ready(self) -> bool:
        return self._app is not None

    def _load(self):
        with self._lock:
            if self._app is None:
                from insightface.app import FaceAnalysis

                providers = _providers()
                gpu = providers[0] == "CUDAExecutionProvider"
                app = FaceAnalysis(name=self.model, providers=providers, allowed_modules=["detection", "recognition"])
                app.prepare(ctx_id=0 if gpu else -1, det_size=(self.det_size, self.det_size))
                self.device = "cuda" if gpu else "cpu"
                self._app = app
        return self._app

    def analyze(self, image: np.ndarray) -> list[Face]:
        app = self._load()
        out: list[Face] = []
        for f in app.get(image[:, :, ::-1]):  # insightface expects BGR
            out.append(Face(tuple(float(v) for v in f.bbox), float(f.det_score), np.asarray(f.normed_embedding, dtype=np.float32)))
        return out


def decode(data: bytes, max_side: int = 1280) -> np.ndarray:
    """RGB array from an uploaded image; very large pictures are shrunk first (detection runs at 320 px anyway)."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side))
    return np.asarray(img)


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity of two embeddings."""
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def largest(faces: list[Face]) -> Face | None:
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), default=None)
