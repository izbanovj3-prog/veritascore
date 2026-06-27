#!/usr/bin/env bash
# WAIC demo launcher (full docker runtime: Postgres + Redis + Celery + frontend).
# For a no-Docker local run on Windows, use scripts/demo.ps1 instead.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[VeritasCore] Building and starting the stack via docker compose..."
docker compose up -d --build

echo "[VeritasCore] Waiting for the backend to become healthy..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ""
echo "  VeritasCore ready."
echo "  Dashboard:          http://localhost:5173"
echo "  Backend API:        http://localhost:8000  (docs at /docs)"
echo "  Demo target model:  http://localhost:8001"
echo ""
echo "  In the dashboard, launch an audit against:  http://demo_target:8001/v1/respond"
echo "  (or http://localhost:8001/v1/respond if running the backend on the host)"
