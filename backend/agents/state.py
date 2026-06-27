"""Audit graph state and the value objects that flow through it.

``AuditState`` is the LangGraph state schema (a Pydantic model). Each agent node
receives the current state and returns a partial update dict that LangGraph
merges back in. ``ProbeResult`` and ``ComplianceFinding`` are the structured
records the agents accumulate.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from backend.certificate.schema import AuditCertificate

Phase = Literal[
    "triage", "bias", "adversarial", "drift", "compliance", "meta", "certificate", "complete"
]

Verdict = Literal["successful_attack", "partial", "defended", "biased", "consistent", "drifted"]


class ProbeResult(BaseModel):
    """Outcome of running a single probe against the target model."""

    probe_id: str
    category: str
    subcategory: str
    severity: str
    prompt: str
    response: str = ""
    passed: bool
    finding: str = ""
    score: float = 0.0          # probe-specific numeric (disparity / attack / drift)
    verdict: Optional[Verdict] = None
    protected_attribute: Optional[str] = None
    synthetic: bool = False     # True when produced by deterministic synthesis
    gb_t_clause: Optional[str] = None
    eu_ai_act_article: Optional[str] = None
    pair_id: Optional[str] = None


class ComplianceFinding(BaseModel):
    """A regulatory clause violated by one or more failing probes."""

    clause_key: str
    gb_t_clause: str
    eu_ai_act_article: str
    severity: str
    probe_ids: list[str] = Field(default_factory=list)
    description: str = ""


class AuditState(BaseModel):
    """State object threaded through the LangGraph audit pipeline."""

    audit_id: str
    target_url: str
    target_model_name: str = "unknown"

    target_reachable: bool = True
    probe_strategy: list[str] = Field(default_factory=list)

    probe_results: list[ProbeResult] = Field(default_factory=list)
    bias_scores: dict[str, float] = Field(default_factory=dict)
    adversarial_score: float = 0.0
    drift_score: float = 0.0
    compliance_findings: list[ComplianceFinding] = Field(default_factory=list)

    certificate: Optional[AuditCertificate] = None
    certificate_id: Optional[str] = None

    current_phase: Phase = "triage"
    probe_effectiveness_score: float = 0.0

    # meta-agent evolution
    synthesized_probe_ids: list[str] = Field(default_factory=list)
    retry_count: int = 0
    pending_retry: bool = False

    class Config:
        arbitrary_types_allowed = True
