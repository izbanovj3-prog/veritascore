"""Shared runtime helpers for the agent nodes.

Centralizes the things every node needs: emitting live events onto the bus,
pacing the probe stream so it is visibly real-time, an in-process registry that
backs the ``GET /audit/{id}/status`` endpoint, and the per-audit stash of
meta-agent-synthesized probes used on the retry pass.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

from backend.agents.state import ProbeResult
from backend.config import settings
from backend.probes.probe_library import Probe
from backend.tasks.event_bus import get_event_bus

# audit_id -> live status snapshot (single-process inline mode)
AUDIT_REGISTRY: dict[str, dict] = {}
# audit_id -> probes the meta-agent synthesized for the retry pass
SYNTHESIZED_PROBES: dict[str, list[Probe]] = {}

SEV_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def registry_init(audit_id: str, target_url: str, model_name: str) -> None:
    AUDIT_REGISTRY[audit_id] = {
        "current_phase": "triage",
        "probe_count": 0,
        "findings_count": 0,
        "status": "running",
        "started_at": time.time(),
        "target_url": target_url,
        "model_name": model_name,
        "certificate_id": None,
    }


async def emit_phase(audit_id: str, to_phase: str) -> None:
    reg = AUDIT_REGISTRY.setdefault(audit_id, {"current_phase": "init"})
    frm = reg.get("current_phase", "init")
    reg["current_phase"] = to_phase
    await get_event_bus().publish(
        audit_id,
        {"type": "phase_change", "audit_id": audit_id, "from": frm, "to": to_phase, "timestamp": _now()},
    )


async def emit_info(audit_id: str, message: str, **extra) -> None:
    await get_event_bus().publish(
        audit_id,
        {"type": "info", "audit_id": audit_id, "message": message, "timestamp": _now(), **extra},
    )


async def emit_event(audit_id: str, event: dict) -> None:
    event.setdefault("audit_id", audit_id)
    event.setdefault("timestamp", _now())
    await get_event_bus().publish(audit_id, event)


def _probe_event(r: ProbeResult) -> dict:
    return {
        "probe_id": r.probe_id,
        "category": r.category,
        "subcategory": r.subcategory,
        "severity": r.severity,
        "passed": r.passed,
        "verdict": r.verdict,
        "score": r.score,
        "finding": r.finding,
        "synthetic": r.synthetic,
        "protected_attribute": r.protected_attribute,
        "gb_t_clause": r.gb_t_clause,
        "eu_ai_act_article": r.eu_ai_act_article,
        "prompt": r.prompt,
        "response": (r.response or "")[:400],
    }


def make_on_result(audit_id: str, sink: list[ProbeResult]):
    """Build the per-probe callback the evaluators invoke as results arrive."""

    async def on_result(result: ProbeResult) -> None:
        if "-syn" in result.probe_id:
            result.synthetic = True
        sink.append(result)
        reg = AUDIT_REGISTRY.get(audit_id)
        if reg is not None:
            reg["probe_count"] = reg.get("probe_count", 0) + 1
            if not result.passed:
                reg["findings_count"] = reg.get("findings_count", 0) + 1
        await get_event_bus().publish(
            audit_id,
            {"type": "probe_result", "audit_id": audit_id, "timestamp": _now(), **_probe_event(result)},
        )
        # pacing so the WebSocket stream is perceptibly live
        await asyncio.sleep(max(0, settings.probe_delay_ms) / 1000.0)

    return on_result
