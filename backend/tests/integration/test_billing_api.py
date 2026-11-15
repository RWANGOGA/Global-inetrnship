"""Billing integration tests against the isolated seeded SQLite database.

Covers: upgrade, pay, cancel, resume, invoice/transaction listing (no 500),
student overage block, checkout preview, payment methods, idempotency.
"""
from fastapi.testclient import TestClient

STUDENT = "amina@makerere.ac.ug"
EMPLOYER = "hiring@lumenlabs.example"  # linked to org o4
PASSWORD = "password123"


def _login(client: TestClient, email: str) -> dict:
    resp = client.post("/auth/login", json={"username": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _org_id(client: TestClient, email: str) -> str:
    return client.get("/auth/me", headers=_login(client, email)).json()["org_id"]


# ---- Gateways -----------------------------------------------------------


def test_gateways_returns_a_list(client: TestClient):
    h = _login(client, EMPLOYER)
    resp = client.get("/billing/gateways", headers=h)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body["gateways"], list) and len(body["gateways"]) > 0
    assert body["gateways"][0]["id"] == "stripe"


# ---- Subscription lifecycle ---------------------------------------------


def test_subscription_lifecycle(client: TestClient):
    h = _login(client, EMPLOYER)
    org_id = _org_id(client, EMPLOYER)

    # Free default.
    sub = client.get("/billing/subscriptions/current", headers=h).json()
    assert sub["org_id"] == org_id
    assert sub["plan"] == "Free"
    assert sub["is_premium"] is False

    # Upgrade to Pro (no payment method -> active with an open invoice).
    created = client.post(
        "/billing/subscriptions",
        json={"plan": "Pro", "billing_cycle": "monthly", "payment_gateway": "stripe"},
        headers=h,
    ).json()
    assert created["plan"] == "Pro"
    assert created["is_premium"] is True
    assert created["status"] == "active"
    assert created["payment_gateway"] == "stripe"
    assert created["current_period_start"]
    assert created["current_period_end"]

    # Persists across reads with the new fields.
    sub = client.get("/billing/subscriptions/current", headers=h).json()
    assert sub["plan"] == "Pro"
    assert sub["cancel_at_period_end"] is False

    # Invoices exist and listing them does not 500 (was crashing on metadata).
    invs = client.get("/billing/invoices", headers=h).json()
    assert isinstance(invs, list) and len(invs) >= 1
    assert invs[0]["metadata"] == {"subscription_id": org_id, "plan": "Pro"}  # invoice_metadata -> metadata alias
    txns = client.get("/billing/transactions", headers=h).json()
    assert isinstance(txns, list)

    # Pay the open invoice.
    open_inv = next(i for i in invs if i["status"] == "open")
    txn = client.post(
        f"/billing/invoices/{open_inv['id']}/pay",
        json={"payment_method_id": "pm_test"},
        headers=h,
    ).json()
    assert txn["status"] == "succeeded"
    assert invs and invs[0]["id"] == open_inv["id"]

    # Invoice is now paid.
    paid = client.get(f"/billing/invoices/{open_inv['id']}", headers=h).json()
    assert paid["status"] == "paid"

    # Cancel at period end -> keeps Pro, sets cancel_at_period_end.
    cancelled = client.post("/billing/subscriptions/current/cancel", json={}, headers=h).json()
    assert cancelled["plan"] == "Pro"
    assert cancelled["cancel_at_period_end"] is True

    # Resume -> active again, cancel_at_period_end cleared.
    resumed = client.post("/billing/subscriptions/current/resume", json={}, headers=h).json()
    assert resumed["plan"] == "Pro"
    assert resumed["cancel_at_period_end"] is False


# ---- Checkout preview + checkout ---------------------------------------


def test_checkout_preview(client: TestClient):
    h = _login(client, EMPLOYER)
    resp = client.post(
        "/billing/checkout/preview",
        json={"plan": "Pro", "billing_cycle": "annual", "payment_gateway": "stripe"},
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["plan"] == "Pro"
    assert body["billing_cycle"] == "annual"
    assert body["total_cents"] == body["subtotal_cents"] + body["tax_cents"]
    assert body["line_items"][0]["amount_cents"] == 30000


def test_checkout_is_idempotent(client: TestClient):
    h = _login(client, EMPLOYER)
    key = "idem-test-checkout-1"
    first = client.post(
        "/billing/checkout",
        json={
            "plan": "Pro",
            "billing_cycle": "monthly",
            "payment_gateway": "stripe",
            "payment_method_id": "pm_1",
            "idempotency_key": key,
        },
        headers=h,
    ).json()
    assert first["transaction"]["status"] == "succeeded"
    assert first["replayed"] is False

    # Same key -> replayed, no double charge.
    second = client.post(
        "/billing/checkout",
        json={
            "plan": "Pro",
            "billing_cycle": "monthly",
            "payment_gateway": "stripe",
            "payment_method_id": "pm_1",
            "idempotency_key": key,
        },
        headers=h,
    ).json()
    assert second["replayed"] is True
    assert second["transaction"]["id"] == first["transaction"]["id"]


# ---- Payment methods -----------------------------------------------------


def test_payment_methods_crud(client: TestClient):
    h = _login(client, EMPLOYER)
    org_id = _org_id(client, EMPLOYER)

    # Empty at start.
    assert client.get("/billing/payment-methods", headers=h).json() == []

    created = client.post(
        "/billing/payment-methods",
        json={"type": "card", "details": {"last4": "4242", "brand": "Visa"}},
        headers=h,
    ).json()
    assert created["org_id"] == org_id
    assert created["type"] == "card"
    assert created["is_default"] is True
    pm_id = created["id"]

    listed = client.get("/billing/payment-methods", headers=h).json()
    assert len(listed) == 1
    assert listed[0]["id"] == pm_id

    # Set default (idempotent-ish).
    resp = client.post(f"/billing/payment-methods/{pm_id}/default", headers=h)
    assert resp.status_code == 200, resp.text

    removed = client.delete(f"/billing/payment-methods/{pm_id}", headers=h)
    assert removed.status_code == 200, removed.text
    assert client.get("/billing/payment-methods", headers=h).json() == []


# ---- Student overage -----------------------------------------------------


def test_student_usage_has_unpaid_invoice_id(client: TestClient):
    h = _login(client, STUDENT)
    resp = client.get("/billing/student/usage", headers=h)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "application_count" in body
    assert "free_limit" in body
    assert "unpaid_invoice_id" in body

    # Student invoices list does not 500.
    invs = client.get("/billing/student/invoices", headers=h).json()
    assert isinstance(invs, list)
