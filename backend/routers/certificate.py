"""Certificate access: signed JSON, downloadable JSON, signed PDF, verification."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response

from backend.agents.graph import CERT_DIR
from backend.certificate.pdf import build_certificate_pdf
from backend.certificate.signer import verify_certificate
from backend.db.models import CertificateRow
from backend.db.session import session_scope

router = APIRouter(prefix="/certificate", tags=["certificate"])


async def _load_cert(audit_id: str) -> dict | None:
    path = CERT_DIR / f"{audit_id}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    async with session_scope() as session:
        row = await session.get(CertificateRow, audit_id)
        if row is not None:
            return row.certificate_json
    return None


@router.get("/{audit_id}")
async def get_certificate(audit_id: str) -> JSONResponse:
    cert = await _load_cert(audit_id)
    if cert is None:
        raise HTTPException(status_code=404, detail="certificate not found")
    return JSONResponse({"certificate": cert, "verified": verify_certificate(cert)})


@router.get("/{audit_id}/download")
async def download_certificate(audit_id: str) -> Response:
    cert = await _load_cert(audit_id)
    if cert is None:
        raise HTTPException(status_code=404, detail="certificate not found")
    body = json.dumps(cert, indent=2, sort_keys=True).encode("utf-8")
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="veritascore-{audit_id}.json"'},
    )


@router.get("/{audit_id}/verify")
async def verify(audit_id: str) -> dict:
    cert = await _load_cert(audit_id)
    if cert is None:
        raise HTTPException(status_code=404, detail="certificate not found")
    return {"audit_id": audit_id, "verified": verify_certificate(cert)}


@router.get("/{audit_id}/pdf")
async def certificate_pdf(audit_id: str) -> Response:
    cert = await _load_cert(audit_id)
    if cert is None:
        raise HTTPException(status_code=404, detail="certificate not found")
    pdf_bytes = build_certificate_pdf(cert, verify_certificate(cert))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="veritascore-{audit_id}.pdf"'},
    )
