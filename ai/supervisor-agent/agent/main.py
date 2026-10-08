from __future__ import annotations

import asyncio
import contextlib
import logging

from fastapi import FastAPI, Header, HTTPException, Request
from livekit import api

from .clients import AI, Core
from .config import Config
from .pipeline import Pipeline
from .supervisor import Supervisor

log = logging.getLogger("agent")
RECONCILE_EVERY = 30.0


def create_app(cfg: Config | None = None) -> FastAPI:
    cfg = cfg or Config.from_env()
    core, ai = Core(cfg), AI(cfg)
    sup = Supervisor(cfg, core, Pipeline(core, ai))
    receiver = api.WebhookReceiver(api.TokenVerifier(cfg.api_key, cfg.api_secret))

    async def reconcile_loop():
        while True:
            try:
                await sup.reconcile()
            except Exception:  # noqa: BLE001
                log.exception("reconcile failed")
            await asyncio.sleep(RECONCILE_EVERY)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI):
        task = asyncio.create_task(reconcile_loop())
        yield
        task.cancel()
        for name in list(sup.rooms):
            await sup.drop(name)

    app = FastAPI(title="FoxyExam supervisor agent", version="1.0.0", lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"ok": True, "service": "agent", "rooms": sorted(sup.rooms), "fps": cfg.fps}

    @app.post("/webhook")
    async def webhook(request: Request, authorization: str = Header(default="")):
        body = (await request.body()).decode()
        try:
            event = receiver.receive(body, authorization)
        except Exception as e:  # noqa: BLE001 - bad signature or body
            raise HTTPException(401, "bad webhook") from e
        asyncio.create_task(sup.on_event(event.event, event.room.name))
        return {"ok": True}

    return app

