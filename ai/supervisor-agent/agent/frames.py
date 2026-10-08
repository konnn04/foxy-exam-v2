from __future__ import annotations

import io

import numpy as np
from PIL import Image


def to_jpeg(rgb: np.ndarray, max_width: int = 640, quality: int = 72) -> bytes:
    """A small JPEG of one video frame: the AI services work at a few hundred pixels anyway and evidence stays light."""
    img = Image.fromarray(rgb)
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return buf.getvalue()


class Throttle:
    """Lets `fps` frames per second through, whatever the video's own frame rate is."""

    def __init__(self, fps: float):
        self.gap = 1.0 / fps
        self.last = float("-inf")

    def allow(self, now: float) -> bool:
        if now - self.last >= self.gap:
            self.last = now
            return True
        return False
