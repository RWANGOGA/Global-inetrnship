"""R1a auth unit tests — offline, no HTTP, no database.

Covers the pure security primitives (hashing round-trips, JWT round-trips and
expiry) and the AuthService business rules via the in-memory user repo.
"""
import time

import jwt
import pytest

from app.application.auth import AuthService
from app.core.errors import EmailAlreadyExists, InvalidCredentials, UserNotFound
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from tests.fakes import InMemoryUserRepository


# ---- password hashing ------------------------------------------------------


def test_hash_is_salted_and_verifiable():
    stored = hash_password("hunter2")
    assert stored != "hunter2"
    assert stored.startswith("pbkdf2_sha256$")
    assert verify_password("hunter2", stored) is True
    assert verify_password("wrong", stored) is False


def test_same_password_hashes_differently_each_time():
    # A per-user random salt means identical passwords produce distinct hashes.
    assert hash_password("same") != hash_password("same")


def test_verify_rejects_malformed_stored_value():
    assert verify_password("x", "not-a-valid-hash") is False


# ---- tokens ----------------------------------------------------------------


def test_token_roundtrip_carries_subject_and_role():
    token = create_access_token("user-123", "student")
    payload = decode_access_token(token)
    assert payload["sub"] == "user-123"
    assert payload["role"] == "student"


def test_decode_rejects_tampered_token():
    token = create_access_token("user-123", "student")
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token + "corrupt")


def test_decode_rejects_expired_token(monkeypatch):
    # Force a token that is already expired.
    monkeypatch.setattr(
        "app.core.security.get_settings",
        lambda: type("S", (), {"access_token_ttl_minutes": -1, "effective_secret_key": "x"})(),
    )
    token = create_access_token("user-123", "student")
    time.sleep(0)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token)


# ---- AuthService -----------------------------------------------------------


def _service() -> AuthService:
    return AuthService(InMemoryUserRepository())


def test_register_normalizes_email_and_returns_user():
    user = _service().register(
        email="  Amina@Mak.ac.ug ", name="Amina", role="student", password="pw12345"
    )
    assert user.email == "amina@mak.ac.ug"
    assert user.role == "student"
    assert user.id  # generated
    assert user.password_hash != "pw12345"  # stored hashed


def test_register_defaults_name_from_email():
    user = _service().register(email="bob@mak.ac.ug", name="", role="student", password="pw")
    assert user.name == "bob"


def test_register_rejects_unknown_role():
    with pytest.raises(ValueError):
        _service().register(email="a@mak.ac.ug", name="A", role="wizard", password="pw")


def test_register_rejects_invalid_email():
    with pytest.raises(ValueError):
        _service().register(email="not-an-email", name="A", role="student", password="pw")


def test_register_rejects_empty_password():
    with pytest.raises(ValueError):
        _service().register(email="a@mak.ac.ug", name="A", role="student", password="")


def test_register_rejects_duplicate_email():
    service = _service()
    service.register(email="a@mak.ac.ug", name="A", role="student", password="pw")
    with pytest.raises(EmailAlreadyExists):
        service.register(email="a@mak.ac.ug", name="A2", role="student", password="pw2")


def test_login_success_and_wrong_password():
    service = _service()
    service.register(email="a@mak.ac.ug", name="A", role="student", password="right")
    assert service.login(email="a@mak.ac.ug", password="right").email == "a@mak.ac.ug"
    with pytest.raises(InvalidCredentials):
        service.login(email="a@mak.ac.ug", password="wrong")


def test_login_unknown_email_does_not_leak_existence():
    with pytest.raises(InvalidCredentials):
        _service().login(email="ghost@b.com", password="pw")


def test_get_unknown_user_raises():
    with pytest.raises(UserNotFound):
        _service().get("nope")
