from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass(frozen=True)
class Config:
    livekit_url: str  # ws(s):// of LiveKit as the agent reaches it
    api_key: str
    api_secret: str
    core_url: str  # base URL of the Laravel core as the agent reaches it, e.g. http://app:8000
    internal_secret: str  # RT_INTERNAL_SECRET: signs every call into the core / record service
    record_url: str  # record service internal URL, e.g. http://record:8083
    face_url: str
    object_url: str
    ai_token: str
    fps: float = 1.0
    port: int = 8099

    @staticmethod
    def from_env() -> "Config":
        return Config(
            livekit_url=_env("LIVEKIT_URL", "ws://localhost:7880"),
            api_key=_env("LIVEKIT_API_KEY"),
            api_secret=_env("LIVEKIT_API_SECRET"),
            core_url=_env("CORE_URL", "http://localhost:8000").rstrip("/"),
            internal_secret=_env("RT_INTERNAL_SECRET"),
            record_url=_env("RECORD_URL", "http://localhost:8083").rstrip("/"),
            face_url=_env("AI_FACE_URL", "http://localhost:8090").rstrip("/"),
            object_url=_env("AI_OBJECT_URL", "http://localhost:8091").rstrip("/"),
            ai_token=_env("AI_TOKEN"),
            fps=max(0.2, float(_env("AGENT_FPS", "1"))),
            port=int(_env("PORT", "8099")),
        )

    @property
    def livekit_http(self) -> str:
        return self.livekit_url.replace("wss://", "https://").replace("ws://", "http://")
