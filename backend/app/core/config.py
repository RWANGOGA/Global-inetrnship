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

    # Flutterwave payments. All credentials come from the environment and are
    # never committed. With no keys the gateway stays in mock mode, so local
    # development and the test suite never need a live provider. `webhook_hash`
    # is the hash value configured under Settings -> Webhooks in Flutterwave
    # (the dashboard shows the hash we must compare the verif-hash header to).
    flutterwave_secret_key: str = ""
    flutterwave_public_key: str = ""
    flutterwave_webhook_hash: str = ""
    flutterwave_encryption_key: str = ""
    flutterwave_mode: str = "test"  # "test" | "live"
    payment_provider: str = "flutterwave"  # primary provider for new payments

    @property
    def is_flutterwave_configured(self) -> bool:
        return bool(self.flutterwave_secret_key and self.flutterwave_webhook_hash)

    @property
    def is_live_payments_enabled(self) -> bool:
        return self.is_flutterwave_configured and self.flutterwave_mode.lower() == "live"

    @property
    def is_test(self) -> bool:
        return self.environment == "test"

    @property
    def effective_secret_key(self) -> str:
        # A stable dev/test secret keeps local boot frictionless; production is
        # forced to supply SECRET_KEY (see the startup guard in the app factory).
        return self.secret_key or "dev-insecure-secret-change-me"


class ConfigurationError(RuntimeError):
    """Raised at startup when required settings are missing or invalid."""


def validate_runtime_config(settings: Settings | None = None) -> None:
    """Fail fast on unusable configuration.

    Development and tests stay frictionless (a dev signing secret and the mock
    gateway are fine); production must supply its own secret and, if live
    payments are requested, real Flutterwave credentials.
    """
    settings = settings or get_settings()
    problems: list[str] = []

    if not settings.database_url.strip():
        problems.append("DATABASE_URL must be set")
    if settings.flutterwave_mode.lower() not in ("test", "live"):
        problems.append("FLUTTERWAVE_MODE must be 'test' or 'live'")

    if settings.environment.lower() == "production":
        if not settings.secret_key.strip():
            problems.append("SECRET_KEY must be set in production")
        if settings.flutterwave_mode.lower() == "live" and not settings.is_flutterwave_configured:
            problems.append(
                "Live Flutterwave payments require FLUTTERWAVE_SECRET_KEY and "
                "FLUTTERWAVE_WEBHOOK_HASH"
            )

    if problems:
        raise ConfigurationError("Invalid configuration: " + "; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
