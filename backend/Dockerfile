# Backend image for the full docker-compose runtime.
# Uses Python 3.12 (where the full ML + distributed stack has wheels) and
# installs every optional extra so Celery / asyncpg / sentence-transformers
# are all available inside the container.
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY backend ./backend

# uvicorn[standard] is safe on 3.12-slim; install the project with all extras.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir "uvicorn[standard]>=0.29" \
    && pip install --no-cache-dir ".[all]"

EXPOSE 8000 8001

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
