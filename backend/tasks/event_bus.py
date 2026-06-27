"""Pub/sub event bus that decouples the running audit from WebSocket clients.

Two interchangeable implementations behind one interface:

* ``MemoryEventBus`` — in-process asyncio queues (local default). Keeps a replay
  history per audit so a client that connects slightly late still sees every
  probe event.
* ``RedisEventBus`` — Redis pub/sub + a replay list (full / docker mode), so a
  Celery worker in one process can stream to a WebSocket handler in another.

The selected backend is a module-level singleton chosen by ``settings.event_bus``.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from backend.config import settings

_HISTORY_LIMIT = 5000


class EventBus:
    async def publish(self, audit_id: str, event: dict) -> None:  # pragma: no cover
        raise NotImplementedError

    def subscribe(self, audit_id: str) -> AsyncIterator[dict]:  # pragma: no cover
        raise NotImplementedError

    async def close(self, audit_id: str) -> None:  # pragma: no cover
        raise NotImplementedError


class MemoryEventBus(EventBus):
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = {}
        self._history: dict[str, list[dict]] = {}
        self._lock = asyncio.Lock()

    async def publish(self, audit_id: str, event: dict) -> None:
        async with self._lock:
            hist = self._history.setdefault(audit_id, [])
            hist.append(event)
            if len(hist) > _HISTORY_LIMIT:
                del hist[: len(hist) - _HISTORY_LIMIT]
            for q in list(self._subs.get(audit_id, ())):
                q.put_nowait(event)

    async def subscribe(self, audit_id: str) -> AsyncIterator[dict]:
        q: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._subs.setdefault(audit_id, set()).add(q)
            backlog = list(self._history.get(audit_id, []))
        try:
            for ev in backlog:
                yield ev
            while True:
                ev = await q.get()
                if ev is None:  # close sentinel
                    break
                yield ev
        finally:
            subs = self._subs.get(audit_id)
            if subs is not None:
                subs.discard(q)

    async def close(self, audit_id: str) -> None:
        async with self._lock:
            for q in list(self._subs.get(audit_id, ())):
                q.put_nowait(None)


class RedisEventBus(EventBus):
    def __init__(self) -> None:
        import redis.asyncio as aioredis  # lazy: only needed in full mode

        self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)

    @staticmethod
    def _channel(audit_id: str) -> str:
        return f"audit:{audit_id}:events"

    @staticmethod
    def _list_key(audit_id: str) -> str:
        return f"audit:{audit_id}:history"

    async def publish(self, audit_id: str, event: dict) -> None:
        payload = json.dumps(event)
        await self._redis.rpush(self._list_key(audit_id), payload)
        await self._redis.expire(self._list_key(audit_id), 3600)
        await self._redis.publish(self._channel(audit_id), payload)

    async def subscribe(self, audit_id: str) -> AsyncIterator[dict]:
        backlog = await self._redis.lrange(self._list_key(audit_id), 0, -1)
        for raw in backlog:
            yield json.loads(raw)
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(self._channel(audit_id))
        try:
            async for message in pubsub.listen():
                if message is None or message.get("type") != "message":
                    continue
                event = json.loads(message["data"])
                yield event
                if event.get("type") == "complete":
                    break
        finally:
            await pubsub.unsubscribe(self._channel(audit_id))
            await pubsub.close()

    async def close(self, audit_id: str) -> None:
        # Redis subscribers self-terminate on the "complete" event.
        return None


_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _bus
    if _bus is None:
        _bus = RedisEventBus() if settings.event_bus.lower() == "redis" else MemoryEventBus()
    return _bus
