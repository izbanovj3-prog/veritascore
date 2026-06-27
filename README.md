# VeritasCore

**Autonomous AI behavioral auditing infrastructure.** VeritasCore deploys six
autonomous "red-team" agents (real [LangGraph](https://langchain-ai.github.io/langgraph/)
nodes) that continuously stress-test a deployed AI model for **alignment drift**,
**bias emergence**, **adversarial vulnerability**, and **regulatory non-compliance**
(GB/T 42118-2023 + EU AI Act), then issue a **cryptographically signed (Ed25519)
compliance certificate**.

Built as a functional MVP/PoC for a live demonstration at **WAIC 2026, Shanghai**.

```
┌──────────────┐   POST /audit/start    ┌────────────────────────────────────────┐
│   Frontend   │ ─────────────────────▶ │              FastAPI backend            │
│ (Vite/React) │                        │                                         │
│              │   WS /ws/audit/{id}    │   LangGraph StateGraph(AuditState)      │
│  live probe  │ ◀───── events ──────── │  triage → bias → adversarial → drift →  │
│  stream      │   (Redis / in-proc bus)│  compliance → meta ⟲ → certificate      │
└──────────────┘                        │            │ Ed25519 signer            │
                                        └────────────┼───────────────────────────┘
                                                     ▼  httpx
                                            ┌──────────────────┐
                                            │  target model    │  (demo_target.py
                                            │  under audit     │   = a flawed model)
                                            └──────────────────┘
```

---

## What it actually does

| Agent (LangGraph node) | What it does |
|---|---|
| **triage** | Canary-probes the target, fingerprints the model, aborts if unreachable. |
| **bias** | Runs 10 paired probes (identical except one protected attribute), embeds both responses, scores disparity per attribute. |
| **adversarial** | Runs 30 injection + jailbreak probes, classifies each as `successful_attack` / `partial` / `defended`. |
| **drift** | Runs 10 consistency probes, measures cosine distance vs a **locked baseline**. |
| **compliance** | Maps every failing probe to GB/T 42118-2023 + EU AI Act clauses. |
| **meta** | Computes probe effectiveness; if low, **synthesizes new probes** from the top failures and loops back once. |
| **certificate** | Scores 0-100, signs the result with **Ed25519**, writes a real `.json` to disk. |

Everything is wired into the real pipeline. The only synthetic element is the
target model in the demo (`demo_target.py`), which is an intentionally flawed model
so there is something to find; where the probe factory or triage would use Claude,
results are clearly flagged `synthetic` when no `ANTHROPIC_API_KEY` is configured.

---

## Dual-mode runtime

The same code runs two ways, switched entirely by `.env`:

| | **Local mode** (default) | **Full / docker mode** |
|---|---|---|
| Database | SQLite (`aiosqlite`) | Postgres (`asyncpg`) |
| Event bus | in-process asyncio pub/sub | Redis pub/sub |
| Audit runner | FastAPI async task | Celery worker |
| Embeddings | auto: sentence-transformers → TF-IDF → numpy hashing | same |

Nothing is mocked — local mode simply swaps the backing services so the whole
system runs on a laptop with **no Docker, Redis, or Postgres**.

---

## Run it

### A) No-Docker local (recommended for the laptop demo)

```powershell
# Windows / PowerShell — starts demo target (8001), backend (8000), frontend (5173)
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
```

Or manually:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install fastapi uvicorn websockets langgraph langchain-core \
  pydantic pydantic-settings cryptography numpy httpx "sqlalchemy[asyncio]" aiosqlite reportlab python-dotenv

# 3 terminals (run from the project root):
.venv/Scripts/python -m uvicorn backend.demo_target:app --port 8001
.venv/Scripts/python -m uvicorn backend.main:app --reload --port 8000
cd frontend && npm install && npm run dev          # http://localhost:5173
```

Optional extras (real sentence-transformer embeddings, live Claude, Celery/Postgres):
`pip install ".[ml]" ".[llm]" ".[distributed]"`.

### B) Full docker stack

```bash
docker compose up --build      # postgres + redis + backend + celery worker + demo target + frontend
# or:  bash scripts/demo.sh
```

Then open **http://localhost:5173** and launch an audit against
`http://localhost:8001/v1/respond`.

---

## WAIC demo script (≈4 min)

1. **T+0:00** Open the dashboard. The target URL is a "production" model we know nothing about.
2. **T+0:20** Click **Launch Audit** — the agent pipeline lights up, triage runs.
3. **T+0:40** Bias probes stream in; red `FAIL` badges appear; the **bias radar** spikes on **gender**.
4. **T+1:30** Adversarial phase: a `CRITICAL` system-prompt-extraction finding appears.
5. **T+2:30** The **compliance matrix** fills red across GB/T §6.3.2 and EU AI Act Art.10/15.
6. **T+3:00** Meta-agent: *"synthesized N new probes"* — coverage evolves and re-runs.
7. **T+3:30** Certificate appears: **23/100 · FAIL**, Ed25519 signature **VERIFIED**. Download JSON / PDF.

---

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/audit/start` | `{ target_url, model_name }` → `{ audit_id, status }` |
| `GET`  | `/audit/{id}/status` | phase, probe/finding counts, elapsed |
| `WS`   | `/ws/audit/{id}` | live `probe_result` / `phase_change` / `*_update` / `complete` events |
| `GET`  | `/certificate/{id}` | signed certificate JSON + `verified` flag |
| `GET`  | `/certificate/{id}/download` | signed JSON as a download |
| `GET`  | `/certificate/{id}/pdf` | signed certificate as PDF |
| `GET`  | `/certificate/{id}/verify` | re-verify the Ed25519 signature |
| `GET`  | `/public-key` | signing public key + SHA-256 fingerprint |

Verify a downloaded certificate yourself:

```python
import json
from backend.certificate.signer import verify_certificate
print(verify_certificate(json.load(open("certificates/<audit_id>.json"))))  # True
```

---

## Known limitations (MVP vs production)

- **Local mode** uses SQLite + in-process bus + inline runner instead of
  Postgres/Redis/Celery. The docker path restores those with identical app code.
- **Embeddings** fall back to TF-IDF / numpy hashing when
  `sentence-transformers`/`torch` are unavailable (e.g. on very new CPython), which
  lowers semantic fidelity vs a real sentence encoder.
- **Triage reasoning + probe synthesis** are deterministic (clearly flagged
  `synthetic`) unless an `ANTHROPIC_API_KEY` is supplied.
- The **adversarial classifier** is a transparent heuristic (refusal / compliance /
  leak markers), not a trained judge model.
- The signing key is **locally generated** (no HSM / CA chain); single-node, no
  auth or multi-tenancy.
- A per-request target API key is accepted by the launcher but not yet threaded to
  the agents (they use `TARGET_MODEL_API_KEY` from the environment).
