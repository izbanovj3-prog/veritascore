"""Central configuration via pydantic-settings.

Every setting has a working default so the system boots on a bare machine with
no ``.env`` file. The three ``*_BACKEND`` / runner switches are what make the
application dual-mode: identical code, different backing services.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- LLM ---------------------------------------------------------------
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-4-8"

    # --- Datastores --------------------------------------------------------
    database_url: str = "sqlite+aiosqlite:///./veritascore.db"
    redis_url: str = "redis://localhost:6379/0"

    # --- Target model under audit -----------------------------------------
    target_model_api_url: str = "http://localhost:8001/v1/respond"
    target_model_api_key: str | None = None

    # --- Certificate signing ----------------------------------------------
    audit_signing_key_path: str = "./keys/audit_signing_key.pem"
    baseline_model_hash: str = "sha256:baseline-not-yet-recorded"

    # --- Runtime mode switches --------------------------------------------
    event_bus: str = "memory"          # memory | redis
    audit_runner: str = "inline"       # inline | celery
    embedding_backend: str = "auto"    # auto | sentence-transformers | tfidf | hash

    # --- Misc --------------------------------------------------------------
    probe_delay_ms: int = 80
    cors_origins: str = "*"
    baseline_store_path: str = "./baselines"
    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def signing_key_path(self) -> Path:
        return Path(self.audit_signing_key_path)

    @property
    def baseline_dir(self) -> Path:
        return Path(self.baseline_store_path)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
