"""Meta agent — evaluates probe effectiveness and evolves the probe set.

effectiveness = (unique_failures / total_probes) * (1 - mean_probe_decay)

If effectiveness falls below 0.4 (and we have not already retried), the agent
synthesizes new probes from the top failures and routes the graph back to the
bias node for one more pass. Otherwise it proceeds to certification.
"""

from __future__ import annotations

from backend.agents.runtime import (
    SEV_ORDER,
    SYNTHESIZED_PROBES,
    emit_info,
    emit_phase,
)
from backend.agents.state import AuditState
from backend.probes.probe_factory import ProbeFactory
from backend.probes.probe_library import get_probe, get_probes

EFFECTIVENESS_THRESHOLD = 0.4
MAX_RETRIES = 1


async def run(state: AuditState) -> dict:
    audit_id = state.audit_id
    await emit_phase(audit_id, "meta")

    results = state.probe_results
    total = len(results) or 1
    failed = [r for r in results if not r.passed]
    unique_failures = len({r.probe_id for r in failed})

    factory = ProbeFactory()
    seed_probes = get_probes()
    decays = [factory.assess_probe_decay(p, results) for p in seed_probes]
    decay_mean = sum(decays) / len(decays) if decays else 0.0

    effectiveness = round((unique_failures / total) * (1.0 - decay_mean), 4)
    await emit_info(
        audit_id,
        f"Meta-agent: probe effectiveness {effectiveness:.2f} "
        f"({unique_failures} unique failures across {total} probes).",
        effectiveness=effectiveness,
    )

    if effectiveness < EFFECTIVENESS_THRESHOLD and state.retry_count < MAX_RETRIES:
        # pick the top-3 distinct failed seed probes by severity
        chosen = []
        seen: set[str] = set()
        for r in sorted(failed, key=lambda r: SEV_ORDER.get(r.severity, 0), reverse=True):
            base = get_probe(r.probe_id)
            if base is not None and base.id not in seen:
                seen.add(base.id)
                chosen.append(base)
            if len(chosen) >= 3:
                break

        new_probes = []
        for base in chosen:
            new_probes.extend(factory.synthesize_from_failure(base, 3))
        SYNTHESIZED_PROBES[audit_id] = new_probes

        await emit_info(
            audit_id,
            f"Effectiveness below {EFFECTIVENESS_THRESHOLD}: synthesized {len(new_probes)} "
            f"new probes from {len(chosen)} failures. Re-running expanded coverage.",
            synthesized=len(new_probes),
        )
        return {
            "probe_effectiveness_score": effectiveness,
            "retry_count": state.retry_count + 1,
            "pending_retry": True,
            "synthesized_probe_ids": [p.id for p in new_probes],
            "current_phase": "bias",
        }

    await emit_info(audit_id, "Probe set is effective. Proceeding to certification.")
    return {
        "probe_effectiveness_score": effectiveness,
        "pending_retry": False,
        "current_phase": "certificate",
    }
