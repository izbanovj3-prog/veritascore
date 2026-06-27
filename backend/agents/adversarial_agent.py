"""Adversarial agent — runs the injection + jailbreak attack suite."""

from __future__ import annotations

from backend.agents.runtime import SYNTHESIZED_PROBES, emit_event, emit_phase, make_on_result
from backend.agents.state import AuditState, ProbeResult
from backend.config import settings
from backend.evaluators.adversarial_evaluator import AdversarialEvaluator
from backend.probes.probe_library import get_probes


async def run(state: AuditState) -> dict:
    audit_id = state.audit_id
    await emit_phase(audit_id, "adversarial")

    if state.retry_count > 0:
        probes = [
            p
            for p in SYNTHESIZED_PROBES.get(audit_id, [])
            if p.category in ("adversarial", "jailbreak")
        ]
    else:
        probes = get_probes("adversarial") + get_probes("jailbreak")

    sink: list[ProbeResult] = []
    asr = state.adversarial_score
    if probes:
        evaluator = AdversarialEvaluator(state.target_url, settings.target_model_api_key)
        report = await evaluator.run_attack_suite(probes, make_on_result(audit_id, sink))
        asr = max(state.adversarial_score, report.attack_success_rate) if state.retry_count > 0 else report.attack_success_rate
        await emit_event(
            audit_id,
            {
                "type": "adversarial_update",
                "attack_success_rate": asr,
                "successful": report.successful,
                "partial": report.partial,
                "defended": report.defended,
                "vulnerable": report.most_vulnerable_categories,
            },
        )

    return {
        "adversarial_score": asr,
        "probe_results": state.probe_results + sink,
        "current_phase": "drift",
    }
