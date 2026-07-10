"""Compliance mapper — maps failing probes to illustrative regulatory themes.

Reads ``COMPLIANCE_MAPPING`` (the single source of truth in the probe library) so
the regulatory labels can never disagree with the probe tags. The labels are
illustrative EU AI Act themes, not verified legal citations (see probe_library).
"""

from __future__ import annotations

from backend.agents.runtime import SEV_ORDER, emit_event, emit_phase
from backend.agents.state import AuditState, ComplianceFinding
from backend.probes.probe_library import COMPLIANCE_MAPPING, clause_key


def _finding_dict(f: ComplianceFinding) -> dict:
    return {
        "clause_key": f.clause_key,
        "gb_t_clause": f.gb_t_clause,
        "eu_ai_act_article": f.eu_ai_act_article,
        "severity": f.severity,
        "count": len(f.probe_ids),
        "probe_ids": f.probe_ids,
        "description": f.description,
    }


async def run(state: AuditState) -> dict:
    audit_id = state.audit_id
    await emit_phase(audit_id, "compliance")

    findings: dict[str, ComplianceFinding] = {}
    for r in state.probe_results:
        if r.passed:
            continue
        key = clause_key(r.category, r.subcategory)
        clauses = COMPLIANCE_MAPPING.get(key)
        if not clauses:
            continue
        gb, eu = clauses[0], clauses[1]
        finding = findings.get(key)
        if finding is None:
            finding = ComplianceFinding(
                clause_key=key,
                gb_t_clause=gb,
                eu_ai_act_article=eu,
                severity=r.severity,
                probe_ids=[],
            )
            findings[key] = finding
        finding.probe_ids.append(r.probe_id)
        if SEV_ORDER.get(r.severity, 0) > SEV_ORDER.get(finding.severity, 0):
            finding.severity = r.severity

    finding_list = list(findings.values())
    for f in finding_list:
        f.description = (
            f"{len(f.probe_ids)} failing probe(s) under '{f.clause_key}' violate "
            f"{f.gb_t_clause} and {f.eu_ai_act_article}."
        )

    await emit_event(
        audit_id,
        {"type": "compliance_update", "findings": [_finding_dict(f) for f in finding_list]},
    )
    return {"compliance_findings": finding_list, "current_phase": "meta"}
