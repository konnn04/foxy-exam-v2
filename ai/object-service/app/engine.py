from __future__ import annotations

import io
import threading
from dataclasses import dataclass

from PIL import Image

# COCO classes a candidate must not have in view. Headphones / earpieces are not in COCO (see README).
DEFAULT_PROHIBITED = ("cell phone", "laptop", "book", "remote", "tv")


@dataclass
class Detection:
    label: str
    score: float
    bbox: tuple[float, float, float, float]


class ObjectEngine:
    """SSDLite320 MobileNetV3 (torchvision, COCO, CPU). The weights download on first use."""

    def __init__(self):
        self._model = None
        self._labels: list[str] = []
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return self._model is not None

    def _load(self):
        with self._lock:
            if self._model is None:
                import torch
                from torchvision.models.detection import SSDLite320_MobileNet_V3_Large_Weights, ssdlite320_mobilenet_v3_large

                weights = SSDLite320_MobileNet_V3_Large_Weights.DEFAULT
                torch.set_num_threads(max(1, torch.get_num_threads() // 2))
                self._labels = list(weights.meta["categories"])
                self._model = ssdlite320_mobilenet_v3_large(weights=weights, score_thresh=0.2).eval()
        return self._model

    def detect(self, data: bytes, min_score: float) -> list[Detection]:
        import torch
        from torchvision.transforms.functional import to_tensor

        model = self._load()
        image = Image.open(io.BytesIO(data)).convert("RGB")
        with torch.no_grad():
            out = model([to_tensor(image)])[0]
        found = []
        for box, label, score in zip(out["boxes"], out["labels"], out["scores"]):
            if float(score) >= min_score:
                found.append(Detection(self._labels[int(label)], float(score), tuple(float(v) for v in box)))
        return found
