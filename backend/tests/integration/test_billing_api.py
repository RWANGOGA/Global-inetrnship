"""Billing integration tests against the isolated seeded SQLite database.

Covers: upgrade, pay, cancel, resume, invoice/transaction listing (no 500),
student overage block, checkout preview, payment methods, idempotency.
"""
from fastapi.testclient import TestClient

STUDENT = "amina@makerere.ac.ug"
EMPLOYER = "hiring@lumenlabs.example"  # linked to org o4
ADMIN = "office@makerere.ac.ug"
PASSWORD = "password123"


def _login(client: TestClient, email: str) -> dict:
    resp = client.post("/auth/login", json={"username": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _org_id(client: TestClient, email: str) -> str:
    return client.get("/auth/me", headers=_login(client, email)).json()["org_id"]


def _sandbox_payment_method(client: TestClient, headers: dict) -> str:
    response = client.post(
        "/billing/payment-methods",
        json={"type": "card", "details": {"sandbox": True}},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


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

    # A paid plan cannot be activated without a saved payment method or consent.
    missing_method = client.post(
        "/billing/subscriptions",
        json={
            "plan": "Pro",
            "billing_cycle": "monthly",
            "payment_gateway": "stripe",
            "terms_accepted": True,
        },
        headers=h,
    )
    assert missing_method.status_code == 422
    payment_method_id = _sandbox_payment_method(client, h)

    created_response = client.post(
        "/billing/subscriptions",
        json={
            "plan": "Pro",
            "billing_cycle": "monthly",
            "payment_gateway": "stripe",
            "payment_method_id": payment_method_id,
            "terms_accepted": True,
        },
        headers=h,
    )
    assert created_response.status_code == 200, created_response.text
    created = created_response.json()
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

    # The paid invoice and transaction are visible in billing history.
    invs = client.get("/billing/invoices", headers=h).json()
    assert isinstance(invs, list) and len(invs) >= 1
    assert invs[0]["metadata"] == {"subscription_id": org_id, "plan": "Pro"}  # invoice_metadata -> metadata alias
    assert invs[0]["status"] == "paid"
    txns = client.get("/billing/transactions", headers=h).json()
    assert isinstance(txns, list) and txns[0]["status"] == "succeeded"

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
    payment_method_id = _sandbox_payment_method(client, h)
    key = "idem-test-checkout-1"
    payload = {
        "plan": "Pro",
        "billing_cycle": "monthly",
        "payment_gateway": "stripe",
        "payment_method_id": payment_method_id,
        "idempotency_key": key,
        "billing_details": {"email": "billing@example.com"},
        "terms_accepted": True,
    }
    first_response = client.post(
        "/billing/checkout",
        json=payload,
        headers=h,
    )
    assert first_response.status_code == 200, first_response.text
    first = first_response.json()
    assert first["transaction"]["status"] == "succeeded"
    assert first["replayed"] is False

    # Same key -> replayed, no double charge.
    second_response = client.post("/billing/checkout", json=payload, headers=h)
    assert second_response.status_code == 200, second_response.text
    second = second_response.json()
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


def test_student_overage_invoice_is_owned_payable_and_not_double_billed(client: TestClient, session):
    from app.presentation.deps import get_billing_service

    headers = _login(client, STUDENT)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    service = get_billing_service(session)
    for _ in range(service.STUDENT_FREE_APPS + 1):
        service.record_student_application(user_id)

    invoices = client.get("/billing/student/invoices", headers=headers)
    assert invoices.status_code == 200, invoices.text
    invoice = invoices.json()[0]
    assert invoice["user_id"] == user_id
    assert invoice["org_id"] is None
    assert invoice["amount_cents"] == service.STUDENT_OVERAGE_CENTS

    payment = client.post(
        f"/billing/student/invoices/{invoice['id']}/pay",
        json={"payment_method_id": "sandbox-student-card", "terms_accepted": True},
        headers=headers,
    )
    assert payment.status_code == 200, payment.text
    assert payment.json()["status"] == "succeeded"

    service.record_student_application(user_id)
    updated = client.get("/billing/student/invoices", headers=headers).json()
    assert len(updated) == 2
    assert all(item["amount_cents"] == service.STUDENT_OVERAGE_CENTS for item in updated)


def test_admin_billing_defaults_to_recent_period_and_lists_all_records(client: TestClient):
    employer_headers = _login(client, EMPLOYER)
    payment_method_id = _sandbox_payment_method(client, employer_headers)
    checkout = client.post(
        "/billing/checkout",
        json={
            "plan": "Pro",
            "payment_method_id": payment_method_id,
            "billing_details": {"email": "billing@example.com"},
            "terms_accepted": True,
        },
        headers=employer_headers,
    )
    assert checkout.status_code == 200, checkout.text

    admin_headers = _login(client, ADMIN)
    revenue = client.get("/billing/admin/revenue", headers=admin_headers)
    assert revenue.status_code == 200, revenue.text
    assert isinstance(revenue.json()["by_gateway"], list)
    invoices = client.get("/billing/admin/invoices", headers=admin_headers)
    assert invoices.status_code == 200, invoices.text
    assert any(item["org_id"] == _org_id(client, EMPLOYER) for item in invoices.json())
    transactions = client.get("/billing/admin/transactions", headers=admin_headers)
    assert transactions.status_code == 200, transactions.text
    assert transactions.json()
    assert client.get("/billing/admin/transactions", headers=employer_headers).status_code == 403
