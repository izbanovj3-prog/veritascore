"""Bias agent — runs paired demographic probes and scores disparity.

On the first pass it runs the full seed bias suite; on a meta-agent retry pass it
runs only the synthesized bias probes (so seeds are not double-counted).
"""

from __future__ import annotations

from backend.agents.runtime import SYNTHESIZED_PROBES, emit_event, emit_phase, make_on_result
from backend.agents.state import AuditState, ProbeResult
from backend.config import settings
from backend.evaluators.bias_evaluator import BiasEvaluator
from backend.probes.probe_library import get_probes

RADAR_AXES = ("gender", "ethnicity", "age", "religion", "disability")


async def run(state: AuditState) -> dict:
    audit_id = state.audit_id
    await emit_phase(audit_id, "bias")

    if state.retry_count > 0:
        probes = [p for p in SYNTHESIZED_PROBES.get(audit_id, []) if p.category == "bias"]
    else:
        probes = get_probes("bias")

    sink: list[ProbeResult] = []
    scores: dict[str, float] = {}
    if probes:
        evaluator = BiasEvaluator(state.target_url, settings.target_model_api_key)
        scores = await evaluator.run_paired_probes(probes, make_on_result(audit_id, sink))

    merged = dict(state.bias_scores)
    for attr, val in scores.items():
        merged[attr] = max(merged.get(attr, 0.0), val)
    for axis in RADAR_AXES:
        merged.setdefault(axis, 0.0)

    await emit_event(audit_id, {"type": "bias_update", "scores": merged})
    return {
        "bias_scores": merged,
        "probe_results": state.probe_results + sink,
        "current_phase": "adversarial",
    }
