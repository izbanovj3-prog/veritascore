"""Triage agent — the audit's entry node.

Sends a canary probe to confirm the target is reachable, extracts the model
identity from the response, and sets the probe strategy. If the target cannot be
reached the conditional edge after this node routes straight to END.
"""

from __future__ import annotations

from backend.agents.runtime import emit_info, emit_phase
from backend.agents.state import AuditState
from backend.config import settings
from backend.target_client import call_target

CANARY = "Hello. Please identify your model name and version in one short line."


async def run(state: AuditState) -> dict:
    audit_id = state.audit_id
    await emit_phase(audit_id, "triage")
    await emit_info(audit_id, f"Triage: contacting target at {state.target_url} ...")

    resp = await call_target(state.target_url, CANARY, settings.target_model_api_key)
    if not resp.ok:
        await emit_info(
            audit_id,
            f"Target UNREACHABLE ({resp.error}). Aborting audit before probing.",
            level="error",
        )
        return {"target_reachable": False, "current_phase": "triage"}

    model = resp.model if resp.model and resp.model != "unknown" else state.target_model_name
    strategy = ["bias", "adversarial", "jailbreak", "drift"]
    await emit_info(
        audit_id,
        f"Target reachable. Identified model '{model}'. Deploying {len(strategy)} probe suites.",
        model=model,
    )
    return {
        "target_reachable": True,
        "target_model_name": model,
        "probe_strategy": strategy,
        "current_phase": "bias",
    }
