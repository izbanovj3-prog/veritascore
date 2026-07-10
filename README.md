# VeritasCore

### ▶ Live demo: **https://izbanovj3-prog.github.io/veritascore/**

> GitHub Pages is static-only (no Python backend), so the live site runs in
> **recorded-demo mode**: clicking *Launch audit* replays a **real** captured
> audit — the actual probe stream plus the real Ed25519-signed certificate.
> For the fully live backend, run locally (below) or deploy the backend to a
> Python host.

**Autonomous AI behavioral auditing infrastructure.** VeritasCore deploys six
autonomous "red-team" agents (real [LangGraph](https://langchain-ai.github.io/langgraph/)
nodes) that continuously stress-test a deployed AI model for **alignment drift**,
**bias emergence**, **adversarial vulnerability**, and **regulatory non-compliance**
(an **illustrative** EU AI Act theme mapping — see the disclaimer below), then
issue a **cryptographically signed (Ed25519) compliance certificate**.

> **Regulatory-mapping disclaimer.** The compliance labels VeritasCore attaches
> to findings map probe categories to the *thematic* area of the EU AI Act they
> relate to (Art.9 risk management, Art.10 data governance, Art.13 transparency,
> Art.15 robustness). They are **illustrative** and have **not** been verified
> against enacted legal text; this is a demonstration mapping, not a legal
> conformity assessment.

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
| **compliance** | Maps every failing probe to an illustrative EU AI Act theme (see disclaimer). |
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

### C) AMD GPU — audit a **real** model on ROCm (7.2 + vLLM 0.16.0 + PyTorch 2.9)

By default the target under audit is `demo_target.py` (a scripted, intentionally
flawed stand-in). On an AMD GPU you can instead audit a **real** open-source
model served through vLLM — `backend/vllm_target.py` is a drop-in replacement
that speaks the exact same `/v1/respond` contract.

**0. Verify the GPU stack first** (cheap; downloads a ~1 GB model, one inference):

```bash
python smoke_test.py
# or pick the model:  SMOKE_MODEL=facebook/opt-125m python smoke_test.py
```

Expect `torch.version.hip` to be a version string (proves a ROCm build) and
`torch.cuda.is_available()` → `True`. The summary must end with `overall: PASS`.

**1. Serve the real model under audit on the GPU:**

```bash
VERITAS_TARGET_MODEL=Qwen/Qwen2.5-0.5B-Instruct \
  uvicorn backend.vllm_target:app --host 0.0.0.0 --port 8001
```

Device provenance (torch/HIP version, GPU name) is written to
`logs/device_info.json`, and every inference is logged to `logs/vllm_target.log`.

**2. Start the auditor and run an audit against it:**

```bash
PYTHONPATH=. uvicorn backend.main:app --port 8000        # terminal 2

curl -X POST localhost:8000/audit/start \                # terminal 3
  -H 'Content-Type: application/json' \
  -d '{"target_url":"http://localhost:8001/v1/respond","model_name":"Qwen2.5-0.5B-Instruct"}'
```

Watch it live at **http://localhost:5173** (start the frontend as in A), or poll
`GET /audit/{id}/status`; the signed certificate lands in `certificates/<id>.json`.

**Containerized (ROCm):**

```bash
# Pin BASE to the rocm/vllm tag matching your ROCm 7.2 / vLLM 0.16.0 stack:
docker build -f Dockerfile.rocm --build-arg BASE=rocm/vllm:<your-tag> -t veritascore-rocm .

# GPU passthrough is required for ROCm containers:
docker run --rm -it \
  --device=/dev/kfd --device=/dev/dri --group-add video \
  --security-opt seccomp=unconfined --ipc=host --shm-size 8g \
  -p 8001:8001 -e VERITAS_TARGET_MODEL=Qwen/Qwen2.5-0.5B-Instruct \
  veritascore-rocm
```

> **Note.** vLLM does not run natively on Windows; the ROCm path is for the AMD
> Linux notebook. Sections A/B run anywhere (they never touch a GPU).

---

## WAIC demo script (≈4 min)

1. **T+0:00** Open the dashboard. The target URL is a "production" model we know nothing about.
2. **T+0:20** Click **Launch Audit** — the agent pipeline lights up, triage runs.
3. **T+0:40** Bias probes stream in; red `FAIL` badges appear; the **bias radar** spikes on **gender**.
4. **T+1:30** Adversarial phase: a `CRITICAL` system-prompt-extraction finding appears.
5. **T+2:30** The **compliance matrix** fills red across the EU AI Act Art.10/15 themes (illustrative).
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
- The **regulatory mapping is illustrative** (EU AI Act themes) and is not a
  verified legal conformity assessment — see the disclaimer at the top.
- The signing key is **locally generated** (no HSM / CA chain); single-node, no
  auth or multi-tenancy.
- A per-request target API key is accepted by the launcher but not yet threaded to
  the agents (they use `TARGET_MODEL_API_KEY` from the environment).
