"""FastAPI application entrypoint for VeritasCore.

    uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.certificate.signer import ensure_keys, public_key_fingerprint, public_key_pem
from backend.config import settings
from backend.db.session import init_db
from backend.demo_target import app as demo_target_app
from backend.routers import audit, certificate, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    ensure_keys()
    print(f"[VeritasCore] event_bus={settings.event_bus} runner={settings.audit_runner} "
          f"embeddings={settings.embedding_backend}")
    print(f"[VeritasCore] Ed25519 signing key fingerprint: {public_key_fingerprint()}")
    yield


app = FastAPI(title="VeritasCore", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audit.router)
app.include_router(certificate.router)
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "veritascore"}


@app.get("/public-key")
async def public_key() -> dict:
    return {
        "algorithm": "Ed25519",
        "fingerprint": public_key_fingerprint(),
        "pem": public_key_pem(),
    }


# Single-service deploy (e.g. Render): also expose the demo target model and serve
# the built frontend from this same app, so one public URL runs real audits.
app.mount("/demo-target", demo_target_app)

_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(_DIST):
    # Mounted LAST so the API routes above take precedence. The SPA uses hash
    # routing, so no server-side fallback is needed.
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
