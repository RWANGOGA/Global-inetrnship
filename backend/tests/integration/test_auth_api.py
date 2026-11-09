"""R1a auth API integration tests — real HTTP against the SQLite harness.

Register/login/me are exercised end-to-end, including that the password hash
never crosses the boundary and that /auth/me enforces the Bearer token.
"""
DEMO_EMAIL = "amina@makerere.ac.ug"
DEMO_PASSWORD = "password123"


def _register(client, **overrides):
    payload = {
        "email": "new@example.com",
        "name": "New User",
        "role": "student",
        "password": "secret123",
    }
    payload.update(overrides)
    return client.post("/auth/register", json=payload)


def test_register_returns_token_and_safe_user(client):
    res = _register(client)
    assert res.status_code == 201
    body = res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["role"] == "student"
    # The hash must never be exposed.
    assert "password_hash" not in body["user"]
    assert "password" not in body["user"]


def test_register_duplicate_email_conflicts(client):
    assert _register(client).status_code == 201
    dup = _register(client)
    assert dup.status_code == 409


def test_register_rejects_unknown_role(client):
    res = _register(client, role="wizard")
    assert res.status_code == 422


def test_register_cannot_create_an_admin_account(client):
    res = _register(client, role="admin")
    assert res.status_code == 422


def test_login_seeded_demo_account(client):
    res = client.post("/auth/login", json={"username": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["role"] == "student"
    assert body["access_token"]


def test_login_wrong_password_unauthorized(client):
    res = client.post("/auth/login", json={"username": DEMO_EMAIL, "password": "nope"})
    assert res.status_code == 401


def test_me_returns_current_user(client):
    token = client.post(
        "/auth/login", json={"username": DEMO_EMAIL, "password": DEMO_PASSWORD}
    ).json()["access_token"]
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == DEMO_EMAIL


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401


def test_me_rejects_invalid_token(client):
    res = client.get("/auth/me", headers={"Authorization": "Bearer garbage"})
    assert res.status_code == 401
