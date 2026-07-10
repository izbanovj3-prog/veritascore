"""Real vLLM-backed target model — the drop-in replacement for ``demo_target``.

``demo_target`` returns hardcoded responses; this app serves the SAME
``/v1/respond`` contract but backed by a real open-source LLM running through
vLLM on the AMD GPU (ROCm). Point ``TARGET_MODEL_API_URL`` at it and VeritasCore
audits a real model with zero changes to the auditor itself.

    # on the AMD notebook (ROCm 7.2 + vLLM 0.16.0 + torch 2.9):
    VERITAS_TARGET_MODEL=Qwen/Qwen2.5-0.5B-Instruct \
        uvicorn backend.vllm_target:app --host 0.0.0.0 --port 8001

Design notes:
* The heavy imports (torch, vllm) live inside the lifespan / handlers so this
  module imports fine on a machine without them (e.g. for a syntax check).
* Generation is serialized with an ``asyncio.Lock`` and run in a worker thread:
  the vLLM offline engine is not meant to be re-entered concurrently, and the
  VeritasCore evaluators call the target strictly sequentially, so this costs
  nothing and keeps the engine safe.
* Sampling is greedy (temperature 0) so an audit is reproducible and the drift
  baseline stays stable across runs.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

# --- logging ----------------------------------------------------------------
# ROCm / GPU device info is written to logs/ so an audit run leaves a durable,
# reviewable record of exactly which device served the inferences.
LOG_DIR = Path(os.environ.get("VERITAS_LOG_DIR", "logs"))
LOG_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("vllm_target")
if not logger.handlers:
    logger.setLevel(logging.INFO)
    _fh = logging.FileHandler(LOG_DIR / "vllm_target.log", encoding="utf-8")
    _fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(_fh)
    _sh = logging.StreamHandler()
    _sh.setFormatter(logging.Formatter("[vllm_target] %(message)s"))
    logger.addHandler(_sh)

# --- configuration (all overridable via env) --------------------------------
MODEL_NAME = os.environ.get("VERITAS_TARGET_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
MAX_MODEL_LEN = int(os.environ.get("VLLM_MAX_MODEL_LEN", "4096"))
GPU_MEM_UTIL = float(os.environ.get("VLLM_GPU_MEM_UTIL", "0.80"))
DTYPE = os.environ.get("VLLM_DTYPE", "auto")
MAX_TOKENS = int(os.environ.get("VLLM_MAX_TOKENS", "256"))
ENFORCE_EAGER = os.environ.get("VLLM_ENFORCE_EAGER", "1") not in ("0", "false", "False")

# populated at startup
_ENGINE = None
_SAMPLING = None
_DEVICE_INFO: dict = {"backend": "uninitialized"}
_GEN_LOCK = asyncio.Lock()


def _collect_device_info() -> dict:
    """Best-effort GPU/ROCm device info for logging + /health."""
    info: dict = {"model": MODEL_NAME}
    try:
        import torch

        info["torch_version"] = torch.__version__
        info["hip_version"] = getattr(torch.version, "hip", None)
        info["cuda_version"] = getattr(torch.version, "cuda", None)
        info["is_rocm"] = bool(getattr(torch.version, "hip", None))
        info["gpu_available"] = torch.cuda.is_available()
        if torch.cuda.is_available():
            info["device_count"] = torch.cuda.device_count()
            info["device_name"] = torch.cuda.get_device_name(0)
    except Exception as exc:  # noqa: BLE001
        info["torch_error"] = repr(exc)
    return info


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ENGINE, _SAMPLING, _DEVICE_INFO

    # Collect + persist device info BEFORE importing vLLM, so the logs capture
    # the GPU/ROCm state even if the vLLM engine itself fails to initialize.
    _DEVICE_INFO = _collect_device_info()
    (LOG_DIR / "device_info.json").write_text(
        json.dumps(_DEVICE_INFO, indent=2), encoding="utf-8"
    )
    logger.info("device info: %s", json.dumps(_DEVICE_INFO))

    from vllm import LLM, SamplingParams

    logger.info("loading '%s' via vLLM ...", MODEL_NAME)
    _ENGINE = LLM(
        model=MODEL_NAME,
        dtype=DTYPE,
        max_model_len=MAX_MODEL_LEN,
        gpu_memory_utilization=GPU_MEM_UTIL,
        enforce_eager=ENFORCE_EAGER,
    )
    _SAMPLING = SamplingParams(temperature=0.0, max_tokens=MAX_TOKENS)
    logger.info("ready — serving %s on /v1/respond", MODEL_NAME)
    yield


app = FastAPI(title="VeritasCore vLLM Target", version="1.0.0", lifespan=lifespan)


class RespondRequest(BaseModel):
    prompt: str | None = None
    messages: list[dict] | None = None


def _to_chat_messages(req: RespondRequest) -> list[dict]:
    """Normalize the incoming request into chat messages for the model.

    VeritasCore always sends both ``prompt`` and an equivalent ``messages`` list;
    we prefer explicit messages and fall back to wrapping the bare prompt.
    """
    if req.messages:
        norm = [
            {"role": str(m.get("role", "user")), "content": str(m.get("content", ""))}
            for m in req.messages
            if isinstance(m, dict) and m.get("content")
        ]
        if norm:
            return norm
    return [{"role": "user", "content": req.prompt or ""}]


def _generate_sync(messages: list[dict]) -> str:
    """Run one blocking generation. Prefer the chat template; fall back to raw."""
    try:
        outputs = _ENGINE.chat(messages, sampling_params=_SAMPLING, use_tqdm=False)
    except (AttributeError, TypeError):
        # older/newer vLLM without LLM.chat: apply the chat template manually
        tok = _ENGINE.get_tokenizer()
        prompt = tok.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        outputs = _ENGINE.generate([prompt], _SAMPLING, use_tqdm=False)
    return outputs[0].outputs[0].text.strip()


@app.post("/v1/respond")
async def respond(req: RespondRequest) -> dict:
    if _ENGINE is None:
        return {"response": "", "model": MODEL_NAME, "error": "engine not ready"}
    messages = _to_chat_messages(req)
    start = time.perf_counter()
    async with _GEN_LOCK:
        text = await asyncio.to_thread(_generate_sync, messages)
    latency_ms = round((time.perf_counter() - start) * 1000, 1)
    # log device + timing at the moment of inference (audit provenance)
    logger.info(
        "inference model=%s device=%s prompt_chars=%d latency_ms=%s",
        MODEL_NAME,
        _DEVICE_INFO.get("device_name", "unknown"),
        sum(len(m["content"]) for m in messages),
        latency_ms,
    )
    return {"response": text, "model": MODEL_NAME, "latency_ms": latency_ms}


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok" if _ENGINE is not None else "loading",
        "model": MODEL_NAME,
        "device": _DEVICE_INFO,
    }


@app.get("/")
async def root() -> dict:
    return {
        "model": MODEL_NAME,
        "endpoint": "/v1/respond",
        "note": "real vLLM-served target model (ROCm)",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
