"""Audit control endpoints: start an audit, poll its status."""

from __future__ import annotations

import asyncio
import time
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.agents.graph import run_audit
from backend.agents.runtime import AUDIT_REGISTRY
from backend.config import settings
from backend.db.models import AuditRun
from backend.db.session import session_scope

router = APIRouter(prefix="/audit", tags=["audit"])

# keep strong references to background tasks so they are not garbage-collected
_BG_TASKS: set[asyncio.Task] = set()


class StartRequest(BaseModel):
    target_url: str
    model_name: str = "unknown"
    api_key: str | None = None  # optional; reserved for per-request target auth


class StartResponse(BaseModel):
    audit_id: str
    status: str


@router.post("/start", response_model=StartResponse)
async def start_audit(req: StartRequest) -> StartResponse:
    if not req.target_url.strip():
        raise HTTPException(status_code=422, detail="target_url is required")

    audit_id = uuid.uuid4().hex[:16]

    # record the run up front so status/certificate lookups have a row
    try:
        async with session_scope() as session:
            session.add(
                AuditRun(
                    id=audit_id,
                    target_url=req.target_url,
                    target_model_name=req.model_name or "unknown",
                    status="started",
                    current_phase="triage",
                )
            )
    except Exception:
        # persistence is best-effort at start; the audit still runs in-memory
        pass

    if settings.audit_runner.lower() == "celery":
        from backend.tasks.celery_app import run_audit_task

        run_audit_task.delay(audit_id, req.target_url, req.model_name or "unknown")
    else:
        task = asyncio.create_task(run_audit(audit_id, req.target_url, req.model_name or "unknown"))
        _BG_TASKS.add(task)
        task.add_done_callback(_BG_TASKS.discard)

    return StartResponse(audit_id=audit_id, status="started")


@router.get("/{audit_id}/status")
async def audit_status(audit_id: str) -> dict:
    reg = AUDIT_REGISTRY.get(audit_id)
    if reg is not None:
        return {
            "audit_id": audit_id,
            "current_phase": reg.get("current_phase", "triage"),
            "probe_count": reg.get("probe_count", 0),
            "findings_count": reg.get("findings_count", 0),
            "status": reg.get("status", "running"),
            "certificate_id": reg.get("certificate_id"),
            "elapsed_seconds": round(time.time() - reg.get("started_at", time.time()), 2),
        }

    # not in memory (e.g. completed in a prior process) — fall back to the DB
    async with session_scope() as session:
        run = await session.get(AuditRun, audit_id)
        if run is None:
            raise HTTPException(status_code=404, detail="audit not found")
        return {
            "audit_id": audit_id,
            "current_phase": run.current_phase,
            "probe_count": 0,
            "findings_count": 0,
            "status": run.status,
            "certificate_id": audit_id if run.status == "complete" else None,
            "elapsed_seconds": 0.0,
        }
