#!/usr/bin/env python3
"""VeritasCore ROCm / vLLM smoke test.

Run this FIRST on the AMD notebook (ROCm 7.2 + vLLM 0.16.0 + PyTorch 2.9) to
confirm the GPU stack is alive before wiring it into the audit pipeline. It is
deliberately defensive: every stage is isolated in try/except so a failure in
one stage still prints the diagnostics gathered so far, and every error is
printed *as is* (full traceback) rather than swallowed.

Stages:
  0. Interpreter + platform
  1. import torch, versions (incl. torch.version.hip → proves a ROCm build)
  2. GPU visibility (torch.cuda.* — under ROCm the CUDA API is the HIP API)
  3. rocm-smi / nvidia-smi shell probe
  4. import vllm, version
  5. load the smallest relevant open-source model via vLLM, one inference call
  6. print the generated text + device info

Model is configurable so the smoke test stays cheap:
    SMOKE_MODEL=Qwen/Qwen2.5-0.5B-Instruct   (default, a real chat model ~1GB)
    SMOKE_MODEL=facebook/opt-125m            (even smaller, non-chat fallback)

Exit code is 0 only if stages 1, 2, 4 and 5 all succeed.
"""

from __future__ import annotations

import os
import platform
import subprocess
import sys
import traceback

MODEL = os.environ.get("SMOKE_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
PROMPT = "In one sentence, what is an AI model audit?"


def hr(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}", flush=True)


def main() -> int:
    ok = {"torch": False, "gpu": False, "vllm": False, "inference": False}

    # -- 0. interpreter + platform ----------------------------------------
    hr("0. INTERPRETER / PLATFORM")
    print(f"python      : {sys.version.splitlines()[0]}", flush=True)
    print(f"executable  : {sys.executable}", flush=True)
    print(f"platform    : {platform.platform()}", flush=True)
    print(f"machine     : {platform.machine()}", flush=True)
    print(f"SMOKE_MODEL : {MODEL}", flush=True)

    # -- 1. torch ----------------------------------------------------------
    hr("1. TORCH")
    torch = None
    try:
        import torch  # noqa: PLC0415

        print(f"torch.__version__     : {torch.__version__}", flush=True)
        # On a ROCm build torch.version.hip is a version string and
        # torch.version.cuda is typically None. This is the definitive
        # "am I actually on ROCm?" check.
        print(f"torch.version.hip     : {getattr(torch.version, 'hip', None)}", flush=True)
        print(f"torch.version.cuda    : {getattr(torch.version, 'cuda', None)}", flush=True)
        is_rocm = bool(getattr(torch.version, "hip", None))
        print(f"build flavour         : {'ROCm/HIP' if is_rocm else 'CUDA or CPU'}", flush=True)
        ok["torch"] = True
    except Exception:  # noqa: BLE001
        print("FAILED to import torch:", flush=True)
        traceback.print_exc()

    # -- 2. GPU visibility -------------------------------------------------
    hr("2. GPU VISIBILITY (torch.cuda == HIP under ROCm)")
    if torch is not None:
        try:
            available = torch.cuda.is_available()
            print(f"torch.cuda.is_available() : {available}", flush=True)
            if available:
                count = torch.cuda.device_count()
                print(f"device_count              : {count}", flush=True)
                for i in range(count):
                    name = torch.cuda.get_device_name(i)
                    cap = torch.cuda.get_device_capability(i)
                    print(f"  [{i}] {name}  (capability {cap})", flush=True)
                ok["gpu"] = True
            else:
                print("No GPU visible to torch - check ROCm install / HIP_VISIBLE_DEVICES.", flush=True)
        except Exception:  # noqa: BLE001
            print("FAILED probing GPU:", flush=True)
            traceback.print_exc()
    else:
        print("skipped (torch not importable)", flush=True)

    # -- 3. rocm-smi / nvidia-smi -----------------------------------------
    hr("3. SHELL GPU PROBE")
    for tool, args in (("rocm-smi", ["rocm-smi", "--showproductname"]), ("nvidia-smi", ["nvidia-smi"])):
        try:
            out = subprocess.run(args, capture_output=True, text=True, timeout=30)
            if out.returncode == 0:
                print(f"$ {' '.join(args)}\n{out.stdout.strip()}", flush=True)
                break
            print(f"$ {' '.join(args)} → exit {out.returncode}: {out.stderr.strip()}", flush=True)
        except FileNotFoundError:
            print(f"{tool}: not found on PATH", flush=True)
        except Exception:  # noqa: BLE001
            print(f"{tool}: error", flush=True)
            traceback.print_exc()

    # -- 4. vllm -----------------------------------------------------------
    hr("4. VLLM")
    LLM = SamplingParams = None
    try:
        import vllm  # noqa: PLC0415
        from vllm import LLM, SamplingParams  # noqa: PLC0415

        print(f"vllm.__version__ : {vllm.__version__}", flush=True)
        ok["vllm"] = True
    except Exception:  # noqa: BLE001
        print("FAILED to import vllm:", flush=True)
        traceback.print_exc()

    # -- 5 + 6. load smallest model, one inference ------------------------
    hr(f"5. LOAD MODEL VIA VLLM + INFERENCE  ({MODEL})")
    if LLM is not None and ok["gpu"]:
        try:
            # Conservative settings for a smoke test on a laptop GPU: small
            # context, single GPU, leave headroom.
            llm = LLM(
                model=MODEL,
                dtype="auto",
                max_model_len=2048,
                gpu_memory_utilization=0.80,
                enforce_eager=True,  # skip CUDA-graph capture — faster cold start, fewer ROCm surprises
            )
            params = SamplingParams(temperature=0.0, max_tokens=64)
            outputs = llm.generate([PROMPT], params)

            hr("6. RESULT")
            for o in outputs:
                print(f"prompt   : {o.prompt}", flush=True)
                print(f"response : {o.outputs[0].text.strip()}", flush=True)
            ok["inference"] = True
        except Exception:  # noqa: BLE001
            print("FAILED during model load / inference:", flush=True)
            traceback.print_exc()
    else:
        reason = "vllm not importable" if LLM is None else "no GPU visible"
        print(f"skipped ({reason})", flush=True)

    # -- summary -----------------------------------------------------------
    hr("SUMMARY")
    for k, v in ok.items():
        print(f"  {k:10s}: {'PASS' if v else 'FAIL'}", flush=True)
    critical = all((ok["torch"], ok["gpu"], ok["vllm"], ok["inference"]))
    print(f"\noverall: {'PASS - stack is alive' if critical else 'FAIL - see stages above'}", flush=True)
    return 0 if critical else 1


if __name__ == "__main__":
    raise SystemExit(main())
