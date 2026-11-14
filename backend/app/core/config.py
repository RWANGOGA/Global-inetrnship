"""Application settings.

Single source of truth for environment configuration. The Groq key, DeepL key and the
database URL are read from the environment (or a local ``.env``); they are
never committed. Swapping Postgres for Neon/Render is a URL change only.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "BrighterWorks API"
    environment: str = "development"
    # Postgres in Docker for dev/prod; the test harness overrides this to an
    # in-memory SQLite URL through the DATABASE_URL environment variable.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/intern"
    # Groq credentials + model come from the environment only (never committed,
    # never hardcoded). Empty by default so the API boots without an advisor.
    groq_api_key: str = ""
    groq_model: str = ""
    # DeepL credentials for voice (TTS/STT). Empty by default so the API boots without voice.
    deepl_api_key: str = ""
    # Auth. The signing secret comes from the environment only; tokens are short
    # lived. In production a real secret is required (guarded at startup).
    secret_key: str = ""
    access_token_ttl_minutes: int = 7 * 24 * 60  # one week
    # CORS origins (comma-separated). Default to localhost for dev.
    cors_origins: str = "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000,https://rwangoga.github.io"

    @property
    def is_test(self) -> bool:
        return self.environment == "test"

    @property
    def effective_secret_key(self) -> str:
        # A stable dev/test secret keeps local boot frictionless; production is
        # forced to supply SECRET_KEY (see the startup guard in the app factory).
        return self.secret_key or "dev-insecure-secret-change-me"


@lru_cache
def get_settings() -> Settings:
    return Settings()
