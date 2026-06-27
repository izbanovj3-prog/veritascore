"""HTTP client for the model under audit.

Every evaluator and the triage agent reach the target through this single
function so the request/response contract lives in one place. The contract is
deliberately liberal: we POST ``{"prompt": ...}`` and accept any of the common
response shapes (a bare string, ``{"response": ...}``, OpenAI-style
``choices[].message.content``, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class TargetResponse:
    ok: bool
    text: str
    model: str = "unknown"
    error: Optional[str] = None
    latency_ms: float = 0.0


def _extract_text(data: object) -> str:
    """Pull the assistant text out of whatever shape the target returned."""
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        for key in ("response", "output", "text", "content", "answer", "completion"):
            val = data.get(key)
            if isinstance(val, str):
                return val
        # OpenAI-style
        choices = data.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                msg = first.get("message")
                if isinstance(msg, dict) and isinstance(msg.get("content"), str):
                    return msg["content"]
                if isinstance(first.get("text"), str):
                    return first["text"]
        # Anthropic-style
        content = data.get("content")
        if isinstance(content, list) and content and isinstance(content[0], dict):
            if isinstance(content[0].get("text"), str):
                return content[0]["text"]
    return str(data)


def _extract_model(data: object, default: str = "unknown") -> str:
    if isinstance(data, dict):
        for key in ("model", "model_name", "name", "version"):
            val = data.get(key)
            if isinstance(val, str) and val:
                return val
    return default


async def call_target(
    target_url: str,
    prompt: str,
    api_key: Optional[str] = None,
    timeout: float = 20.0,
    client: Optional[httpx.AsyncClient] = None,
) -> TargetResponse:
    """Send one prompt to the target model and normalize the response."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {"prompt": prompt, "messages": [{"role": "user", "content": prompt}]}

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=timeout)
    try:
        resp = await client.post(target_url, json=payload, headers=headers)
        latency = resp.elapsed.total_seconds() * 1000 if resp.elapsed else 0.0
        if resp.status_code >= 400:
            return TargetResponse(
                ok=False, text="", error=f"HTTP {resp.status_code}", latency_ms=latency
            )
        try:
            data = resp.json()
        except Exception:
            data = resp.text
        return TargetResponse(
            ok=True,
            text=_extract_text(data),
            model=_extract_model(data),
            latency_ms=latency,
        )
    except Exception as exc:  # network error, timeout, refused connection
        return TargetResponse(ok=False, text="", error=str(exc))
    finally:
        if own_client and client is not None:
            await client.aclose()
