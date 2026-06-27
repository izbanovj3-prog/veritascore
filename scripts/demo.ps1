# VeritasCore — no-Docker local demo launcher (Windows / PowerShell).
#
# Brings up the whole stack with zero external services:
#   * demo target model  -> http://localhost:8001
#   * backend API + WS    -> http://localhost:8000   (SQLite + in-process bus + inline runner)
#   * frontend dashboard  -> http://localhost:5173
#
#   powershell -ExecutionPolicy Bypass -File scripts\demo.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Portable Node toolchain (no system Node on this machine). Adjust if relocated.
$NodeDir = "C:\Users\User\Desktop\Obsidian\.tools\node-v22.14.0-win-x64"

# --- Python venv + core deps (install cleanly on 3.11-3.14) ------------------
if (-not (Test-Path ".venv")) {
    Write-Host "[VeritasCore] Creating Python venv..."
    python -m venv .venv
}
$py = ".\.venv\Scripts\python.exe"
Write-Host "[VeritasCore] Installing core backend dependencies..."
& $py -m pip install -q --upgrade pip
& $py -m pip install -q fastapi uvicorn websockets langgraph langchain-core pydantic `
    pydantic-settings cryptography numpy httpx "sqlalchemy[asyncio]" aiosqlite reportlab python-dotenv

# --- Start demo target (8001) + backend (8000) -------------------------------
Write-Host "[VeritasCore] Starting demo target on :8001 ..."
Start-Process -WindowStyle Minimized -FilePath $py `
    -ArgumentList "-m", "uvicorn", "backend.demo_target:app", "--host", "127.0.0.1", "--port", "8001"

Write-Host "[VeritasCore] Starting backend on :8000 ..."
$env:PYTHONPATH = $root
Start-Process -WindowStyle Minimized -FilePath $py `
    -ArgumentList "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"

# --- Start frontend (5173) via portable Node ---------------------------------
Push-Location frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "[VeritasCore] Installing frontend dependencies..."
    & "$NodeDir\npm.cmd" install --no-fund --no-audit
}
Write-Host "[VeritasCore] Starting frontend on :5173 ..."
Start-Process -WindowStyle Minimized -FilePath "cmd.exe" `
    -ArgumentList "/c", "set PATH=$NodeDir;%PATH% && npm run dev -- --host 127.0.0.1 --port 5173"
Pop-Location

Start-Sleep -Seconds 4
Write-Host ""
Write-Host "  VeritasCore ready."
Write-Host "  Dashboard:          http://localhost:5173"
Write-Host "  Backend API:        http://localhost:8000  (docs at /docs)"
Write-Host "  Demo target model:  http://localhost:8001"
Write-Host ""
Write-Host "  Launch an audit against:  http://localhost:8001/v1/respond"
