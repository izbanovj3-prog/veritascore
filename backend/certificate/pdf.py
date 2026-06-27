"""Render a signed certificate dict to a one-page PDF via reportlab."""

from __future__ import annotations

from io import BytesIO


def build_certificate_pdf(cert: dict, verified: bool) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    left = 22 * mm
    y = height - 28 * mm

    status = str(cert.get("compliance_status", "UNKNOWN"))
    status_color = {
        "PASS": colors.HexColor("#1f9d55"),
        "FAIL": colors.HexColor("#d3455b"),
        "CONDITIONAL": colors.HexColor("#d08700"),
    }.get(status, colors.grey)

    c.setFillColor(colors.HexColor("#0a0e14"))
    c.rect(0, height - 16 * mm, width, 16 * mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#00e5ff"))
    c.setFont("Helvetica-Bold", 15)
    c.drawString(left, height - 11 * mm, "VeritasCore — Signed Audit Certificate")

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)

    def line(label: str, value: str) -> None:
        nonlocal y
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left, y, label)
        c.setFont("Helvetica", 10)
        c.drawString(left + 48 * mm, y, value)
        y -= 7 * mm

    line("Audit ID", str(cert.get("audit_id", "")))
    line("Target model", str(cert.get("target_model", "")))
    line("Target URL", str(cert.get("target_url", "")))
    line("Timestamp", str(cert.get("timestamp", "")))

    y -= 4 * mm
    c.setFont("Helvetica-Bold", 30)
    c.setFillColor(status_color)
    c.drawString(left, y, f"{cert.get('overall_score', 0)} / 100")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(left + 60 * mm, y + 2 * mm, status)
    c.setFillColor(colors.black)
    y -= 14 * mm

    line("Adversarial ASR", f"{cert.get('adversarial_score', 0)}")
    line("Drift score", f"{cert.get('drift_score', 0)}")
    line("Probes / failed", f"{cert.get('total_probes', 0)} / {cert.get('failed_probes', 0)}")

    bias_scores = cert.get("bias_scores", {}) or {}
    if bias_scores:
        line("Bias disparity", ", ".join(f"{k}={v}" for k, v in bias_scores.items()))

    violations = cert.get("regulatory_violations", []) or []
    y -= 2 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left, y, "Regulatory violations:")
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    if violations:
        for v in violations:
            c.drawString(left + 4 * mm, y, f"- {v}")
            y -= 5 * mm
    else:
        c.drawString(left + 4 * mm, y, "None")
        y -= 5 * mm

    y -= 4 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left, y, "Cryptographic attestation (Ed25519)")
    y -= 6 * mm
    c.setFont("Courier", 7)
    sig = str(cert.get("signature", ""))
    for i in range(0, min(len(sig), 176), 88):
        c.drawString(left, y, sig[i : i + 88])
        y -= 4 * mm
    c.setFont("Courier", 8)
    y -= 2 * mm
    c.drawString(left, y, f"key: {cert.get('public_key_fingerprint', '')}")
    y -= 6 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#1f9d55") if verified else colors.HexColor("#d3455b"))
    c.drawString(left, y, "Signature VERIFIED" if verified else "Signature INVALID")

    c.showPage()
    c.save()
    return buf.getvalue()
