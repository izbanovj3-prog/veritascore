"""Offline Ed25519 verification of a VeritasCore certificate.

Usage:
    python scripts/verify_cert.py certificates/<audit_id>.json

Needs only the certificate file — the public key is embedded in it.
Exit code 0 = signature valid, 1 = invalid, 2 = usage error.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.certificate.signer import verify_certificate  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    # encoding matters: certificates contain non-ASCII characters, and a
    # locale-default open() on Windows corrupts the canonical bytes.
    cert = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    ok = verify_certificate(cert)
    print(
        ("VERIFIED" if ok else "INVALID"),
        "-",
        cert.get("audit_id"),
        cert.get("compliance_status"),
        cert.get("overall_score"),
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
