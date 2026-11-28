"""Startup configuration validation fails fast on unusable production settings."""
import pytest

from app.core.config import ConfigurationError, Settings, validate_runtime_config


def test_test_environment_needs_no_production_secrets():
    validate_runtime_config(Settings(environment="test", secret_key=""))


def test_development_uses_dev_secret_fallback():
    validate_runtime_config(Settings(environment="development", secret_key=""))


def test_production_requires_a_signing_secret():
    with pytest.raises(ConfigurationError, match="SECRET_KEY"):
        validate_runtime_config(Settings(environment="production", secret_key=""))


def test_production_with_secret_passes():
    validate_runtime_config(
        Settings(environment="production", secret_key="a-long-production-secret")
    )


def test_live_payments_require_provider_credentials_in_production():
    with pytest.raises(ConfigurationError, match="Flutterwave"):
        validate_runtime_config(
            Settings(
                environment="production",
                secret_key="a-long-production-secret",
                flutterwave_mode="live",
                flutterwave_secret_key="",
                flutterwave_webhook_hash="",
            )
        )


def test_invalid_flutterwave_mode_is_rejected():
    with pytest.raises(ConfigurationError, match="FLUTTERWAVE_MODE"):
        validate_runtime_config(Settings(environment="test", flutterwave_mode="sandbox"))
