"""The VeritasCore audit StateGraph.

A real LangGraph ``StateGraph`` over ``AuditState``: each red-team agent is a node
with explicit state transitions and two conditional edges (abort-on-unreachable
after triage, retry-or-certify after meta). The certificate node signs the audit
and writes a real signed ``.json`` to disk.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from langgraph.graph import END, START, StateGraph

from backend.agents import (
    adversarial_agent,
    bias_agent,
    compliance_mapper,
    drift_agent,
    meta_agent,
    triage_agent,
)
from backend.agents.runtime import (
    AUDIT_REGISTRY,
    SYNTHESIZED_PROBES,
    emit_info,
    emit_phase,
    registry_init,
)
from backend.agents.state import AuditState
from backend.certificate.signer import sign_audit
from backend.db.models import AuditRun, CertificateRow, ComplianceFindingRow, ProbeResultRow
from backend.db.session import session_scope
from backend.tasks.event_bus import get_event_bus

CERT_DIR = Path("certificates")

try:  # checkpointer is optional; degrade gracefully if the package layout differs
    from langgraph.checkpoint.memory import MemorySaver

    _CHECKPOINTER = MemorySaver()
except Exception:  # pragma: no cover
    _CHECKPOINTER = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Persistence + certificate node
# ---------------------------------------------------------------------------
async def _persist(state: AuditState, cert) -> None:
    async with session_scope() as session:
        run = await session.get(AuditRun, state.audit_id)
        if run is None:
            run = AuditRun(id=state.audit_id, target_url=state.target_url)
            session.add(run)
        run.target_model_name = state.target_model_name
        run.status = "complete"
        run.current_phase = "complete"
        run.bias_scores = dict(state.bias_scores)
        run.adversarial_score = state.adversarial_score
        run.drift_score = state.drift_score
        run.probe_effectiveness_score = state.probe_effectiveness_score
        run.overall_score = cert.overall_score
        run.completed_at = _now()

        for r in state.probe_results:
            session.add(
                ProbeResultRow(
                    audit_id=state.audit_id,
                    probe_id=r.probe_id,
                    category=r.category,
                    subcategory=r.subcategory,
                    severity=r.severity,
                    passed=r.passed,
                    verdict=r.verdict,
                    score=r.score,
                    synthetic=r.synthetic,
                    prompt=r.prompt,
                    response=(r.response or "")[:2000],
                    finding=r.finding,
                )
            )
        for f in state.compliance_findings:
            session.add(
                ComplianceFindingRow(
                    audit_id=state.audit_id,
                    clause_key=f.clause_key,
                    gb_t_clause=f.gb_t_clause,
                    eu_ai_act_article=f.eu_ai_act_article,
                    severity=f.severity,
                    probe_ids=list(f.probe_ids),
                    description=f.description,
                )
            )
        session.add(
            CertificateRow(
                id=state.audit_id,
                audit_id=state.audit_id,
                overall_score=cert.overall_score,
                compliance_status=cert.compliance_status,
                signature=cert.signature or "",
                public_key_fingerprint=cert.public_key_fingerprint or "",
                certificate_json=cert.model_dump(mode="json"),
            )
        )


async def certificate_node(state: AuditState) -> dict:
    audit_id = state.audit_id
    await emit_phase(audit_id, "certificate")

    cert = sign_audit(state)

    # write the real signed certificate to disk
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    cert_path = CERT_DIR / f"{audit_id}.json"
    cert_path.write_text(cert.model_dump_json(indent=2), encoding="utf-8")

    try:
        await _persist(state, cert)
    except Exception as exc:  # persistence must never sink the audit result
        await emit_info(audit_id, f"Warning: failed to persist audit to DB ({exc}).", level="warn")

    reg = AUDIT_REGISTRY.setdefault(audit_id, {})
    reg["certificate_id"] = audit_id
    reg["status"] = "complete"
    reg["current_phase"] = "complete"

    await get_event_bus().publish(
        audit_id,
        {
            "type": "complete",
            "audit_id": audit_id,
            "certificate_id": audit_id,
            "overall_score": cert.overall_score,
            "compliance_status": cert.compliance_status,
            "public_key_fingerprint": cert.public_key_fingerprint,
            "timestamp": _now().isoformat(),
        },
    )
    return {
        "certificate": cert,
        "certificate_id": audit_id,
        "current_phase": "complete",
    }


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------
def route_after_triage(state: AuditState) -> str:
    return "bias" if state.target_reachable else "end"


def route_after_meta(state: AuditState) -> str:
    return "bias" if state.pending_retry else "certificate"


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------
def build_graph():
    builder = StateGraph(AuditState)
    builder.add_node("triage", triage_agent.run)
    builder.add_node("bias", bias_agent.run)
    builder.add_node("adversarial", adversarial_agent.run)
    builder.add_node("drift", drift_agent.run)
    builder.add_node("compliance", compliance_mapper.run)
    builder.add_node("meta", meta_agent.run)
    builder.add_node("certificate", certificate_node)

    builder.add_edge(START, "triage")
    builder.add_conditional_edges("triage", route_after_triage, {"bias": "bias", "end": END})
    builder.add_edge("bias", "adversarial")
    builder.add_edge("adversarial", "drift")
    builder.add_edge("drift", "compliance")
    builder.add_edge("compliance", "meta")
    builder.add_conditional_edges(
        "meta", route_after_meta, {"bias": "bias", "certificate": "certificate"}
    )
    builder.add_edge("certificate", END)

    if _CHECKPOINTER is not None:
        return builder.compile(checkpointer=_CHECKPOINTER)
    return builder.compile()


audit_graph = build_graph()


# ---------------------------------------------------------------------------
# Entry point used by both the inline runner and the Celery task
# ---------------------------------------------------------------------------
async def run_audit(audit_id: str, target_url: str, model_name: str) -> str | None:
    """Execute the full audit graph and return the certificate id (or None)."""
    registry_init(audit_id, target_url, model_name)
    bus = get_event_bus()

    state = AuditState(
        audit_id=audit_id,
        target_url=target_url,
        target_model_name=model_name or "unknown",
    )
    config = {"configurable": {"thread_id": audit_id}}

    try:
        await audit_graph.ainvoke(state, config)
    except Exception as exc:
        await emit_info(audit_id, f"Audit failed: {exc}", level="error")
        AUDIT_REGISTRY.setdefault(audit_id, {})["status"] = "error"
        await bus.publish(
            audit_id,
            {"type": "complete", "audit_id": audit_id, "error": str(exc), "certificate_id": None,
             "timestamp": _now().isoformat()},
        )
        await bus.close(audit_id)
        SYNTHESIZED_PROBES.pop(audit_id, None)
        return None

    reg = AUDIT_REGISTRY.get(audit_id, {})
    cert_id = reg.get("certificate_id")
    if cert_id is None:
        reg["status"] = "aborted"
        await bus.publish(
            audit_id,
            {"type": "complete", "audit_id": audit_id,
             "error": "target unreachable or audit aborted", "certificate_id": None,
             "timestamp": _now().isoformat()},
        )

    await bus.close(audit_id)
    SYNTHESIZED_PROBES.pop(audit_id, None)
    return cert_id
