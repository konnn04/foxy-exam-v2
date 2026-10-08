from __future__ import annotations

import asyncio
import logging
import re
import time

import numpy as np
from livekit import api, rtc

from .clients import Core
from .config import Config
from .frames import Throttle, to_jpeg
from .pipeline import Pipeline

log = logging.getLogger("agent")

EXAM_ROOM = re.compile(r"^exam-(\d+)$")
PHONE_ROOM = re.compile(r"^cam2-(\d+)-(\d+)$")
CANDIDATE = re.compile(r"^attempt-(\d+)$")


def classify(room: str, identity: str):
    """(key, source, resolver args) for a participant worth watching, else None.

    exam-<E> / attempt-<A>      the candidate's own camera
    cam2-<U>-<E> / phone        the phone camera of student U in exam E
    """
    if EXAM_ROOM.match(room) and (m := CANDIDATE.match(identity)):
        return f"a{m.group(1)}", "camera", ("attempt", int(m.group(1)))
    if (m := PHONE_ROOM.match(room)) and identity == "phone":
        return f"p{m.group(1)}-{m.group(2)}", "phone", ("phone", int(m.group(1)), int(m.group(2)))
    return None


def watched_room(name: str) -> bool:
    return bool(EXAM_ROOM.match(name) or PHONE_ROOM.match(name))


class RoomSession:
    """The agent inside one room: hidden, subscribed only to camera video, one 1 fps worker per watched track."""

    def __init__(self, sup: "Supervisor", name: str):
        self.sup, self.name = sup, name
        self.room = rtc.Room()
        self.workers: dict[str, asyncio.Task] = {}
        self.gone = asyncio.Event()

    def _token(self) -> str:
        c = self.sup.cfg
        grants = api.VideoGrants(room_join=True, room=self.name, can_subscribe=True, can_publish=False, can_publish_data=False, hidden=True)
        return api.AccessToken(c.api_key, c.api_secret).with_identity(f"agent-{int(time.time())}").with_name("Supervisor agent").with_grants(grants).to_jwt()

    async def join(self) -> None:
        r = self.room
        r.on("track_published", self._published)
        r.on("track_subscribed", self._subscribed)
        r.on("track_unsubscribed", self._unsubscribed)
        r.on("participant_disconnected", lambda p: self._stop(p.identity))
        r.on("disconnected", lambda *_: self.gone.set())
        await r.connect(self.sup.cfg.livekit_url, self._token(), rtc.RoomOptions(auto_subscribe=False))
        for p in r.remote_participants.values():
            for pub in p.track_publications.values():
                self._published(pub, p)

    def _published(self, pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        # camera only: screen shares are not analysed here and would waste bandwidth
        if pub.kind == rtc.TrackKind.KIND_VIDEO and pub.source == rtc.TrackSource.SOURCE_CAMERA and classify(self.name, participant.identity):
            pub.set_subscribed(True)

    def _subscribed(self, track: rtc.Track, pub: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant) -> None:
        target = classify(self.name, participant.identity)
        if not target or track.kind != rtc.TrackKind.KIND_VIDEO:
            return
        self._stop(participant.identity)
        self.workers[participant.identity] = asyncio.create_task(self._watch(track, target))
        log.info("watching %s in %s", participant.identity, self.name)

    def _unsubscribed(self, track, pub, participant) -> None:
        self._stop(participant.identity)

    def _stop(self, identity: str) -> None:
        t = self.workers.pop(identity, None)
        if t:
            t.cancel()

    async def _watch(self, track: rtc.Track, target) -> None:
        key, source, args = target
        core: Core = self.sup.core
        resolve = (lambda: core.attempt(args[1])) if args[0] == "attempt" else (lambda: core.lookup(args[1], args[2]))
        throttle = Throttle(self.sup.cfg.fps)
        stream = rtc.VideoStream(track, capacity=1, format=rtc.VideoBufferType.RGB24)
        try:
            async for ev in stream:
                if not throttle.allow(time.monotonic()):
                    continue
                f = ev.frame
                rgb = np.frombuffer(f.data, dtype=np.uint8).reshape(f.height, f.width, 3)
                try:
                    await self.sup.pipeline.process(key, source, to_jpeg(rgb), resolve)
                except Exception:  # noqa: BLE001 - one bad frame or a flaky service must not end the watch
                    log.exception("frame analysis failed for %s", key)
        finally:
            await stream.aclose()

    async def leave(self) -> None:
        for t in list(self.workers.values()):
            t.cancel()
        self.workers.clear()
        await self.room.disconnect()


class Supervisor:
    """Joins the rooms worth watching. Webhooks tell it about new ones; a slow reconcile against the LiveKit API is the net."""

    def __init__(self, cfg: Config, core: Core, pipeline: Pipeline):
        self.cfg, self.core, self.pipeline = cfg, core, pipeline
        self.rooms: dict[str, RoomSession] = {}
        self._lock = asyncio.Lock()

    async def ensure(self, name: str) -> None:
        if not watched_room(name):
            return
        async with self._lock:
            cur = self.rooms.get(name)
            if cur and not cur.gone.is_set():
                return
            session = RoomSession(self, name)
            try:
                await session.join()
            except Exception:  # noqa: BLE001
                log.exception("could not join %s", name)
                return
            self.rooms[name] = session

    async def drop(self, name: str) -> None:
        async with self._lock:
            s = self.rooms.pop(name, None)
        if s:
            await s.leave()

    async def reconcile(self) -> None:
        """Join every watched room that exists, leave the ones that no longer do."""
        lk = api.LiveKitAPI(self.cfg.livekit_http, self.cfg.api_key, self.cfg.api_secret)
        try:
            live = {r.name for r in (await lk.room.list_rooms(api.ListRoomsRequest())).rooms if watched_room(r.name)}
        finally:
            await lk.aclose()
        for name in live:
            await self.ensure(name)
        for name in list(self.rooms):
            if name not in live or self.rooms[name].gone.is_set():
                await self.drop(name)

    async def on_event(self, event: str, room: str) -> None:
        if event in ("room_started", "participant_joined", "track_published"):
            await self.ensure(room)
        elif event == "room_finished":
            await self.drop(room)
