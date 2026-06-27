"""Drift agent — measures behavioral delta vs the locked baseline.

Drift is only evaluated on the first pass; a meta-agent retry does not re-run it
(the synthesized probes target bias/adversarial weaknesses, and drift is a
baseline comparison that would not change).
"""

from __future__ import annotations

from backend.agents.runtime import emit_event, emit_phase, make_on_result
from backend.agents.state import AuditState, ProbeResult
from backend.config import settings
from backend.evaluators.drift_evaluator import DriftEvaluator
from backend.probes.probe_library import get_probes


async def run(state: AuditState) -> dict:
    audit_id = state.audit_id
    await emit_phase(audit_id, "drift")

    if state.retry_count > 0:
        return {"current_phase": "compliance"}

    probes = get_probes("drift")
    sink: list[ProbeResult] = []
    evaluator = DriftEvaluator(
        state.target_url, state.target_model_name, settings.target_model_api_key
    )
    drift = await evaluator.compute_drift(probes, on_result=make_on_result(audit_id, sink))

    await emit_event(audit_id, {"type": "drift_update", "drift_score": drift})
    return {
        "drift_score": drift,
        "probe_results": state.probe_results + sink,
        "current_phase": "compliance",
    }
