"""SQLAlchemy ORM models.

These persist the durable record of every audit. The same models work on SQLite
(local default) and Postgres (docker), since only portable column types are used.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class AuditRun(Base):
    __tablename__ = "audit_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    target_url: Mapped[str] = mapped_column(String(512))
    target_model_name: Mapped[str] = mapped_column(String(256), default="unknown")
    status: Mapped[str] = mapped_column(String(32), default="started")
    current_phase: Mapped[str] = mapped_column(String(32), default="triage")

    bias_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    adversarial_score: Mapped[float] = mapped_column(Float, default=0.0)
    drift_score: Mapped[float] = mapped_column(Float, default=0.0)
    probe_effectiveness_score: Mapped[float] = mapped_column(Float, default=0.0)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    probe_results: Mapped[list["ProbeResultRow"]] = relationship(
        back_populates="audit", cascade="all, delete-orphan"
    )
    findings: Mapped[list["ComplianceFindingRow"]] = relationship(
        back_populates="audit", cascade="all, delete-orphan"
    )
    certificate: Mapped["CertificateRow | None"] = relationship(
        back_populates="audit", cascade="all, delete-orphan", uselist=False
    )


class ProbeResultRow(Base):
    __tablename__ = "probe_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_id: Mapped[str] = mapped_column(ForeignKey("audit_runs.id"))
    probe_id: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(32))
    subcategory: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16))
    passed: Mapped[bool] = mapped_column(Boolean, default=True)
    verdict: Mapped[str | None] = mapped_column(String(32), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    prompt: Mapped[str] = mapped_column(Text, default="")
    response: Mapped[str] = mapped_column(Text, default="")
    finding: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    audit: Mapped[AuditRun] = relationship(back_populates="probe_results")


class ComplianceFindingRow(Base):
    __tablename__ = "compliance_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    audit_id: Mapped[str] = mapped_column(ForeignKey("audit_runs.id"))
    clause_key: Mapped[str] = mapped_column(String(64))
    gb_t_clause: Mapped[str] = mapped_column(String(128))
    eu_ai_act_article: Mapped[str] = mapped_column(String(128))
    severity: Mapped[str] = mapped_column(String(16))
    probe_ids: Mapped[list] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")

    audit: Mapped[AuditRun] = relationship(back_populates="findings")


class CertificateRow(Base):
    __tablename__ = "certificates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    audit_id: Mapped[str] = mapped_column(ForeignKey("audit_runs.id"))
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    compliance_status: Mapped[str] = mapped_column(String(16), default="CONDITIONAL")
    signature: Mapped[str] = mapped_column(Text)
    public_key_fingerprint: Mapped[str] = mapped_column(String(128))
    certificate_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    audit: Mapped[AuditRun] = relationship(back_populates="certificate")
