"""Re-record the GitHub Pages demo from a live audit run.

Runs an audit against the demo target, captures the WebSocket event stream with
relative-ms offsets into ``frontend/public/demo/recorded-audit.json``, and copies
the freshly signed certificate (JSON + PDF) alongside it. The demo target is
deterministic, so the score/signature are unchanged run-to-run; only the probe
finding text and ids differ.

Prereqs: demo target on :8001 and the backend on :8000 (see README section A).
Run from the repo root:  python scripts/record_demo.py
"""

from __future__ import annotations

import asyncio
import json
import shutil
import time
from pathlib import Path

import httpx
import websockets

ROOT = Path(__file__).resolve().parents[1]
DEMO_DIR = ROOT / "frontend" / "public" / "demo"
BACKEND = "http://127.0.0.1:8000"
TARGET = "http://127.0.0.1:8001/v1/respond"


async def main() -> None:
    async with httpx.AsyncClient(timeout=30.0) as http:
        started = (
            await http.post(
                f"{BACKEND}/audit/start",
                json={"target_url": TARGET, "model_name": "demo-target-v1"},
            )
        ).json()
        audit_id = started["audit_id"]
        print("audit started:", audit_id)

        ws_url = f"ws://127.0.0.1:8000/ws/audit/{audit_id}"
        recorded: list[dict] = []
        t0: float | None = None

        async with websockets.connect(ws_url, max_size=None) as ws:
            while True:
                raw = await ws.recv()
                event = json.loads(raw)
                now = time.monotonic()
                if t0 is None:
                    t0 = now
                recorded.append({"t": round((now - t0) * 1000), "event": event})
                if event.get("type") == "complete":
                    break

        print(f"recorded {len(recorded)} events over {recorded[-1]['t']} ms")

        # certificate JSON + PDF for the same run
        cert = (await http.get(f"{BACKEND}/certificate/{audit_id}")).json()["certificate"]
        pdf = (await http.get(f"{BACKEND}/certificate/{audit_id}/pdf")).content

    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    (DEMO_DIR / "recorded-audit.json").write_text(
        json.dumps(recorded, ensure_ascii=False, indent=0), encoding="utf-8"
    )
    (DEMO_DIR / "certificate.json").write_text(
        json.dumps(cert, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DEMO_DIR / "certificate.pdf").write_bytes(pdf)

    print("score:", cert["overall_score"], cert["compliance_status"])
    print("fingerprint:", cert["public_key_fingerprint"])
    print("wrote:", DEMO_DIR / "recorded-audit.json")


if __name__ == "__main__":
    asyncio.run(main())
