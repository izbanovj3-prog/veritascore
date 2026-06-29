# Single-image deploy for Render (and any Docker host): builds the frontend,
# then runs the FastAPI backend which serves that build + the demo-target model,
# so one public URL runs real-time audits.

# ---- 1. build the frontend (real-backend mode: base "/", no demo) ----
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. backend runtime ----
FROM python:3.12-slim
WORKDIR /app

# Core deps only (no torch/sklearn) — embeddings fall back to the numpy hashing
# backend, keeping the image small and within free-tier RAM.
RUN pip install --no-cache-dir \
    fastapi "uvicorn[standard]>=0.29" "websockets>=12" \
    "langgraph>=0.2.50" "langchain-core>=0.3" "pydantic>=2.6" "pydantic-settings>=2.2" \
    "cryptography>=42" "numpy>=1.26" "httpx>=0.27" "sqlalchemy[asyncio]>=2.0" \
    "aiosqlite>=0.20" "reportlab>=4.0" "python-dotenv>=1.0"

COPY backend/ ./backend/
COPY baselines/ ./baselines/
COPY --from=web /web/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1 \
    EVENT_BUS=memory \
    AUDIT_RUNNER=inline \
    EMBEDDING_BACKEND=auto \
    PROBE_DELAY_MS=120 \
    DATABASE_URL=sqlite+aiosqlite:///./veritascore.db

EXPOSE 8000
# Render injects $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
