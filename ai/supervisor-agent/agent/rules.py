from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field


@dataclass
class Window:
    """The last `size` observations of one condition; fires when `need` of them are positive, then stays quiet for `cooldown` s."""

    size: int
    need: int
    cooldown: float
    seen: deque = field(default_factory=deque)
    last_fire: float = float("-inf")

    def push(self, positive: bool, now: float) -> bool:
        self.seen.append(positive)
        while len(self.seen) > self.size:
            self.seen.popleft()
        if sum(self.seen) >= self.need and now - self.last_fire >= self.cooldown:
            self.last_fire = now
            self.seen.clear()
            return True
        return False


class ObjectRule:
    """A prohibited object must show up in 2 of the last 3 one-second frames (a single glitchy frame is not evidence)."""

    def __init__(self, cooldown: float = 60.0):
        self.cooldown = cooldown
        self.windows: dict[str, Window] = {}

    def update(self, labels: set[str], now: float) -> list[str]:
        fired: list[str] = []
        for label in labels | set(self.windows):
            w = self.windows.setdefault(label, Window(size=3, need=2, cooldown=self.cooldown))
            if w.push(label in labels, now):
                fired.append(label)
        return sorted(fired)


class IdentityRule:
    """A different face must be seen in 3 of the last 5 frames that contain exactly one face."""

    def __init__(self, threshold: float = 0.35, cooldown: float = 120.0):
        self.threshold = threshold
        self.window = Window(size=5, need=3, cooldown=cooldown)

    def update(self, similarity: float | None, now: float) -> bool:
        if similarity is None:  # no face / several faces: the on-device checks report those, nothing to judge here
            return False
        return self.window.push(similarity < self.threshold, now)
