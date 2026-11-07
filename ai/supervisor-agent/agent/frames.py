from __future__ import annotations

import io
from typing import Any, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def to_jpeg(rgb: np.ndarray, max_width: int = 640, quality: int = 72) -> bytes:
    """A small JPEG of one video frame: the AI services work at a few hundred pixels anyway and evidence stays light."""
    img = Image.fromarray(rgb)
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return buf.getvalue()


def annotate_boxes(jpeg: bytes, detections: Sequence[dict[str, Any]], quality: int = 85) -> bytes:
    """Draw red bounding boxes and confidence labels directly onto a JPEG evidence frame."""
    if not detections:
        return jpeg
    try:
        img = Image.open(io.BytesIO(jpeg)).convert("RGB")
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None

        for obj in detections:
            bbox = obj.get("bbox")
            if not bbox or len(bbox) < 4:
                continue
            x1, y1, x2, y2 = [int(float(v)) for v in bbox[:4]]
            draw.rectangle([x1, y1, x2, y2], outline=(239, 68, 68), width=3)
            label = f"{obj.get('label', '?')} {float(obj.get('score', 0.0)) * 100:.0f}%"
            tag_top = max(0, y1 - 15)
            tag_w = max(48, 6 * len(label) + 6)
            draw.rectangle([x1, tag_top, x1 + tag_w, tag_top + 15], fill=(239, 68, 68))
            if font:
                draw.text((x1 + 3, tag_top + 2), label, fill=(255, 255, 255), font=font)
            else:
                draw.text((x1 + 3, tag_top + 2), label, fill=(255, 255, 255))

        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=quality)
        return buf.getvalue()
    except Exception:
        return jpeg


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
