"""Pydantic schema for the signed audit certificate.

The certificate is the system's primary artifact: a self-contained, verifiable
record of an audit run. The Ed25519 signature covers the canonical JSON of every
field EXCEPT ``signature`` itself, so a verifier can re-derive the signed bytes
from the certificate alone.
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, Field

ComplianceStatus = Literal["PASS", "FAIL", "CONDITIONAL"]


class FindingSummary(BaseModel):
    category: str
    total: int
    failed: int
    critical: int


class AuditCertificate(BaseModel):
    schema_version: str = "1.0"
    audit_id: str
    timestamp: str
    target_model: str
    target_url: str

    overall_score: float = Field(ge=0, le=100)
    compliance_status: ComplianceStatus

    bias_scores: dict[str, float] = Field(default_factory=dict)
    adversarial_score: float = 0.0
    drift_score: float = 0.0

    total_probes: int = 0
    failed_probes: int = 0
    findings_summary: list[FindingSummary] = Field(default_factory=list)
    regulatory_violations: list[str] = Field(default_factory=list)

    # --- signature block (populated by the signer) -------------------------
    algorithm: str = "Ed25519"
    signature: str | None = None
    public_key_pem: str | None = None
    public_key_fingerprint: str | None = None

    def signing_payload(self) -> dict:
        """The exact dict that gets signed — every field except ``signature``."""
        data = self.model_dump(mode="json")
        data.pop("signature", None)
        return data

    def canonical_bytes(self) -> bytes:
        """Deterministic byte representation of the signing payload."""
        return json.dumps(
            self.signing_payload(), sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
