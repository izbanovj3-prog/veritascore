"""Celery application for the full distributed runtime (docker mode).

Used only when ``AUDIT_RUNNER=celery``. The worker runs the *same* LangGraph
audit coroutine as the inline runner, publishing live events over the Redis event
bus so the FastAPI WebSocket handler (a different process) can stream them.

Locally (``AUDIT_RUNNER=inline``) this module is never imported, so a missing
``celery`` install never breaks the default path.
"""

from __future__ import annotations

import asyncio

from celery import Celery

from backend.config import settings

celery_app = Celery(
    "veritascore",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_prefetch_multiplier=1,
)


@celery_app.task(name="veritascore.run_audit")
def run_audit_task(audit_id: str, target_url: str, model_name: str) -> dict:
    """Synchronous Celery entrypoint that drives the async audit graph."""
    from backend.agents.graph import run_audit

    result = asyncio.run(run_audit(audit_id, target_url, model_name))
    return {"audit_id": audit_id, "status": "complete", "certificate_id": result}
