from __future__ import annotations

import hashlib
import hmac
import time

TIMESTAMP = "X-Foxy-Timestamp"
SIGNATURE = "X-Foxy-Signature"


def sign(secret: str, body: bytes = b"", now: float | None = None) -> dict[str, str]:
    """Headers for a service-to-service call: HMAC-SHA256 over "<unix seconds>.<body>" (same scheme as the Go and PHP sides)."""
    ts = str(int(now if now is not None else time.time()))
    digest = hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    return {TIMESTAMP: ts, SIGNATURE: digest}
