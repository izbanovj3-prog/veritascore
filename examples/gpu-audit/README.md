# Real GPU audit example (AMD Instinct / ROCm)

This directory is the destination for the **real vLLM-on-ROCm audit evidence** —
a certificate produced by auditing an actual open-source model served on the AMD
GPU, not the scripted `demo_target.py`. It is the strongest single artifact for
the Unicorn Track's "product potential" criterion.

## How to produce it

On the AMD notebook (ROCm 7.2 + vLLM 0.16 + torch 2.9, deps installed), from the
repo root:

```bash
bash scripts/run_gpu_audit.sh
# or pick the model:  SMOKE_MODEL=facebook/opt-125m bash scripts/run_gpu_audit.sh
```

The runner refuses to proceed unless `smoke_test.py` ends in `overall: PASS`, so a
certificate here always corresponds to a verified GPU stack.

## What lands here

| File | What it proves |
|---|---|
| `smoke_test.out` | full smoke-test output ending in `overall: PASS` |
| `device_info.json` | `torch.version.hip` is a real ROCm build + the GPU name (not a silent CPU fallback) |
| `target_health.json` | the served model + device at audit time |
| `certificate.json` | Ed25519-signed audit of the **real** model; verify offline with `python scripts/verify_cert.py examples/gpu-audit/certificate.json` |
| `certificate.pdf` | the same certificate, rendered |

## Status

**Pending real AMD hardware.** Everything the run needs is in the repo
(`smoke_test.py`, `backend/vllm_target.py`, `Dockerfile.rocm`, this runner); the
CPU/HTTP audit path is verified end-to-end. The only unverified step is loading
the model under vLLM on ROCm, which requires the GPU. Run the command above and
commit the files it drops here.
