#!/usr/bin/env bash
# Full vLLM-on-ROCm audit, end to end, on the AMD notebook.
#
# Produces the single strongest piece of evidence for the Unicorn Track:
# a real Ed25519-signed certificate for a REAL model (not demo_target.py),
# plus logs/device_info.json proving torch.version.hip is a real ROCm build.
#
# Prereqs (AMD notebook, ROCm 7.2 + vLLM 0.16 + torch 2.9, deps installed):
#   run from the repo root:  bash scripts/run_gpu_audit.sh
#
# Everything it captures lands in examples/gpu-audit/ — commit that directory.
set -euo pipefail

MODEL="${SMOKE_MODEL:-Qwen/Qwen2.5-0.5B-Instruct}"
OUT="examples/gpu-audit"
mkdir -p "$OUT"

echo "== 0. Smoke test (must end in PASS) =========================="
SMOKE_MODEL="$MODEL" python smoke_test.py | tee "$OUT/smoke_test.out"
if ! grep -q "^overall: PASS" "$OUT/smoke_test.out"; then
  echo "!! smoke_test did not PASS — fix the GPU stack before auditing." >&2
  exit 1
fi

echo "== 1. Serve the real model on the GPU (vllm_target :8001) ===="
VERITAS_TARGET_MODEL="$MODEL" \
  python -m uvicorn backend.vllm_target:app --host 0.0.0.0 --port 8001 &
TARGET_PID=$!
trap 'kill $TARGET_PID $BACKEND_PID 2>/dev/null || true' EXIT

echo "   waiting for the model to load ..."
for _ in $(seq 1 120); do
  if curl -sf localhost:8001/health | grep -q '"status": *"ok"'; then break; fi
  sleep 5
done
curl -s localhost:8001/health | tee "$OUT/target_health.json"; echo

echo "== 2. Start the auditor (backend :8000) ====================="
PYTHONPATH=. python -m uvicorn backend.main:app --port 8000 &
BACKEND_PID=$!
for _ in $(seq 1 30); do
  if curl -sf localhost:8000/public-key >/dev/null; then break; fi
  sleep 1
done

echo "== 3. Audit the REAL model ================================="
AID=$(curl -s -X POST localhost:8000/audit/start \
  -H 'Content-Type: application/json' \
  -d "{\"target_url\":\"http://localhost:8001/v1/respond\",\"model_name\":\"$MODEL\"}" \
  | python -c "import sys,json; print(json.load(sys.stdin)['audit_id'])")
echo "   audit_id = $AID"

echo "   waiting for completion ..."
for _ in $(seq 1 240); do
  STATUS=$(curl -s "localhost:8000/audit/$AID/status" \
    | python -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "?")
  [ "$STATUS" = "complete" ] && break
  sleep 2
done

echo "== 4. Capture evidence ====================================="
cp "logs/device_info.json"       "$OUT/device_info.json"
cp "certificates/$AID.json"      "$OUT/certificate.json"
curl -s "localhost:8000/certificate/$AID/pdf" -o "$OUT/certificate.pdf"
python scripts/verify_cert.py "$OUT/certificate.json"

echo
echo "Done. Real GPU-audit evidence in $OUT/:"
ls -1 "$OUT"
echo "Commit that directory as the real-model audit example."
