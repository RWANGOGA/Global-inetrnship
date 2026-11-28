"""Billing integration tests against the isolated seeded SQLite database.

Covers: upgrade, pay, cancel, resume, invoice/transaction listing (no 500),
student overage block, checkout preview, payment methods, idempotency.
"""
from datetime import datetime, timedelta

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
    assert body["gateways"][0]["id"] == "flutterwave"
    assert body["gateways"][0]["recommended"] is True


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
    assert body["plan"] == "Free"
    assert body["application_limit"] == body["free_limit"] == 30
    assert "unpaid_invoice_id" in body

    # Student invoices list does not 500.
    invs = client.get("/billing/student/invoices", headers=h).json()
    assert isinstance(invs, list)


def test_student_plus_checkout_is_idempotent_and_updates_allowance(client: TestClient):
    headers = _login(client, STUDENT)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    payload = {
        "billing_email": STUDENT,
        "idempotency_key": f"student-plus-checkout-{user_id}",
        "terms_accepted": True,
    }

    missing_consent = client.post(
        "/billing/student/checkout",
        json={**payload, "terms_accepted": False},
        headers=headers,
    )
    assert missing_consent.status_code == 422

    checkout = client.post("/billing/student/checkout", json=payload, headers=headers)
    assert checkout.status_code == 200, checkout.text
    result = checkout.json()
    assert result["transaction"]["status"] == "succeeded"
    assert result["invoice"]["amount_cents"] == 1000
    assert result["plan"]["plan"] == "Student Plus"
    assert result["plan"]["application_limit"] == 60

    replay = client.post("/billing/student/checkout", json=payload, headers=headers)
    assert replay.status_code == 200, replay.text
    assert replay.json()["invoice"]["id"] == result["invoice"]["id"]
    assert replay.json()["transaction"]["id"] == result["transaction"]["id"]

    usage = client.get("/billing/student/usage", headers=headers).json()
    assert usage["plan"] == "Student Plus"
    assert usage["application_limit"] == 60
    assert usage["checkout_enabled"] is True


def test_student_checkout_records_flutterwave_for_admin_audit(client: TestClient):
    headers = _login(client, STUDENT)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    checkout = client.post(
        "/billing/student/checkout",
        json={
            "billing_email": STUDENT,
            "idempotency_key": f"student-flutterwave-{user_id}",
            "terms_accepted": True,
            "payment_gateway": "flutterwave",
        },
        headers=headers,
    )
    assert checkout.status_code == 200, checkout.text
    result = checkout.json()
    assert result["invoice"]["payment_gateway"] == "flutterwave"
    assert result["transaction"]["payment_gateway"] == "flutterwave"
    assert result["transaction"]["user_id"] == user_id

    admin_headers = _login(client, ADMIN)
    transactions = client.get("/billing/admin/transactions", headers=admin_headers)
    assert transactions.status_code == 200
    tracked = next(
        item for item in transactions.json()
        if item["id"] == result["transaction"]["id"]
    )
    assert tracked["user_id"] == user_id
    assert tracked["payment_gateway"] == "flutterwave"
    assert tracked["gateway_transaction_id"]

    invoices = client.get("/billing/admin/invoices", headers=admin_headers)
    assert any(item["id"] == result["invoice"]["id"] for item in invoices.json())


def test_student_plus_limit_cancellation_and_resume(client: TestClient, session):
    from app.presentation.deps import get_billing_service

    headers = _login(client, STUDENT)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    service = get_billing_service(session)
    checkout = client.post(
        "/billing/student/checkout",
        json={
            "billing_email": STUDENT,
            "idempotency_key": f"student-plus-limit-{user_id}",
            "terms_accepted": True,
        },
        headers=headers,
    )
    assert checkout.status_code == 200, checkout.text

    for _ in range(service.STUDENT_PLUS_APPS):
        service.record_student_application(user_id)
    allowed_at_limit = service.check_student_application_limit(user_id)
    assert allowed_at_limit["allowed"] is True
    assert allowed_at_limit["limit"] == 60

    service.record_student_application(user_id)
    blocked_after_overage = service.check_student_application_limit(user_id)
    assert blocked_after_overage["allowed"] is False
    assert blocked_after_overage["limit"] == 60

    cancelled = client.post("/billing/student/subscription/cancel", headers=headers)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["cancel_at_period_end"] is True

    # Cancelling again (retry or second tab) is idempotent, not a 409.
    cancelled_again = client.post("/billing/student/subscription/cancel", headers=headers)
    assert cancelled_again.status_code == 200, cancelled_again.text
    assert cancelled_again.json()["cancel_at_period_end"] is True

    resumed = client.post("/billing/student/subscription/resume", headers=headers)
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["cancel_at_period_end"] is False


def test_student_plus_expiry_does_not_backbill_plus_applications(client: TestClient, session):
    from app.infrastructure.orm import StudentSubscriptionORM
    from app.presentation.deps import get_billing_service

    headers = _login(client, STUDENT)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    service = get_billing_service(session)
    checkout = client.post(
        "/billing/student/checkout",
        json={
            "billing_email": STUDENT,
            "idempotency_key": f"student-plus-expiry-{user_id}",
            "terms_accepted": True,
        },
        headers=headers,
    )
    assert checkout.status_code == 200, checkout.text

    for _ in range(40):
        service.record_student_application(user_id)

    subscription = session.get(StudentSubscriptionORM, user_id)
    subscription.current_period_end = datetime.utcnow() - timedelta(seconds=1)
    session.commit()
    service.record_student_application(user_id)

    invoices = client.get("/billing/student/invoices", headers=headers).json()
    overage_invoice = next(
        invoice for invoice in invoices
        if invoice["metadata"].get("type") == "student_overage"
    )
    assert overage_invoice["amount_cents"] == service.STUDENT_OVERAGE_CENTS


def test_employer_cannot_use_student_checkout(client: TestClient):
    headers = _login(client, EMPLOYER)
    response = client.post(
        "/billing/student/checkout",
        json={
            "billing_email": "billing@example.com",
            "idempotency_key": "employer-student-checkout",
            "terms_accepted": True,
        },
        headers=headers,
    )
    assert response.status_code == 403


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


def test_student_can_pay_overage_invoice_with_flutterwave_and_admin_sees_it(client: TestClient, session):
    from app.presentation.deps import get_billing_service

    headers = _login(client, STUDENT)
    user_id = client.get("/auth/me", headers=headers).json()["id"]
    service = get_billing_service(session)
    for _ in range(service.STUDENT_FREE_APPS + 1):
        service.record_student_application(user_id)

    invoice = client.get("/billing/student/invoices", headers=headers).json()[0]
    payment = client.post(
        f"/billing/student/invoices/{invoice['id']}/pay",
        json={
            "payment_method_id": "sandbox-student-card",
            "payment_gateway": "flutterwave",
            "terms_accepted": True,
        },
        headers=headers,
    )
    assert payment.status_code == 200, payment.text
    assert payment.json()["status"] == "succeeded"
    assert payment.json()["payment_gateway"] == "flutterwave"
    assert payment.json()["user_id"] == user_id

    admin_headers = _login(client, ADMIN)
    transactions = client.get("/billing/admin/transactions", headers=admin_headers).json()
    tracked = next(item for item in transactions if item["id"] == payment.json()["id"])
    assert tracked["user_id"] == user_id
    assert tracked["payment_gateway"] == "flutterwave"
    assert tracked["gateway_transaction_id"]

    updated_invoice = next(
        item for item in client.get("/billing/student/invoices", headers=headers).json()
        if item["id"] == invoice["id"]
    )
    assert updated_invoice["payment_gateway"] == "flutterwave"


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


def test_employer_hosted_session_activates_only_after_webhook(client: TestClient, monkeypatch):
    """A hosted subscription must stay unpaid until a provider webhook settles it."""
    from types import SimpleNamespace

    import app.core.config as config_module

    fake_settings = SimpleNamespace(
        is_flutterwave_configured=True,
        is_live_payments_enabled=False,
        payment_provider="flutterwave",
    )
    monkeypatch.setattr(config_module, "get_settings", lambda: fake_settings)

    headers = _login(client, EMPLOYER)
    session_response = client.post(
        "/billing/employer/subscription/session",
        json={
            "plan": "Pro",
            "billing_cycle": "monthly",
            "billing_email": "billing@lumenlabs.example",
            "idempotency_key": "employer-hosted-checkout-1",
            "terms_accepted": True,
            "payment_gateway": "flutterwave",
        },
        headers=headers,
    )
    assert session_response.status_code == 200, session_response.text
    body = session_response.json()
    assert body["session"]["hosted_url"]
    assert body["session"]["amount_cents"] == 3000

    # The session must not grant the paid plan by itself.
    assert client.get("/billing/subscriptions/current", headers=headers).json()["plan"] == "Free"

    invoice_id = body["invoice"]["id"]
    settled = client.post(
        "/webhooks/flutterwave",
        json={
            "type": "invoice.payment_succeeded",
            "invoice": invoice_id,
            "id": "flw-pay-test",
            "amount_cents": 3000,
        },
        headers={"verif-hash": "sandbox"},
    )
    assert settled.status_code == 200, settled.text

    current = client.get("/billing/subscriptions/current", headers=headers).json()
    assert current["plan"] == "Pro"
    assert current["is_premium"] is True


def test_admin_payer_profile_returns_student_and_employer_details(client: TestClient):
    admin = _login(client, ADMIN)
    student = _login(client, STUDENT)
    student_id = client.get("/auth/me", headers=student).json()["id"]

    profile = client.get(f"/billing/admin/payers/student/{student_id}", headers=admin)
    assert profile.status_code == 200, profile.text
    body = profile.json()
    assert body["payer"]["id"] == student_id
    assert body["plan"]["plan"] in ("Free", "Student Plus")
    assert isinstance(body["invoices"], list)

    org_id = _org_id(client, EMPLOYER)
    employer_profile = client.get(f"/billing/admin/payers/employer/{org_id}", headers=admin)
    assert employer_profile.status_code == 200, employer_profile.text
    assert employer_profile.json()["payer"]["kind"] == "employer"

    missing = client.get("/billing/admin/payers/student/does-not-exist", headers=admin)
    assert missing.status_code == 200
    assert missing.json()["payer"]["name"] == ""


def test_webhook_signature_and_idempotency_with_real_adapter(client: TestClient, monkeypatch):
    """A forged webhook must be rejected; a valid one settles the invoice once."""
    from types import SimpleNamespace

    import app.core.config as config_module
    import app.infrastructure.payment_gateways.factory as factory_module

    fake_settings = SimpleNamespace(
        is_flutterwave_configured=True,
        is_live_payments_enabled=False,
        payment_provider="flutterwave",
        flutterwave_secret_key="secret",
        flutterwave_public_key="pub",
        flutterwave_webhook_hash="whash-secret",
        flutterwave_mode="test",
        environment="test",
    )
    monkeypatch.setattr(config_module, "get_settings", lambda: fake_settings)
    from app.infrastructure.payment_gateways.flutterwave_gateway import FlutterwaveGateway
    from app.infrastructure.payment_gateways.factory import PaymentGatewayFactory

    gw = FlutterwaveGateway(
        {
            "secret_key": "",
            "public_key": "",
            "webhook_hash": "whash-secret",
            "mode": "test",
        }
    )
    factory = PaymentGatewayFactory()
    factory._gateways["flutterwave"] = gw
    factory._configs["flutterwave"] = {"webhook_hash": "whash-secret", "mode": "test"}
    factory_module._gateway_factory = factory

    headers = _login(client, STUDENT)
    session_response = client.post(
        "/billing/student/plus/session",
        json={
            "billing_email": "amina@makerere.ac.ug",
            "idempotency_key": "wh-idempotency-1",
            "terms_accepted": True,
            "payment_gateway": "flutterwave",
        },
        headers=headers,
    )
    assert session_response.status_code == 200, session_response.text
    invoice_id = session_response.json()["invoice"]["id"]

    # Realistic Flutterwave charge.completed payload (amount in major units).
    def _charge_payload() -> dict:
        return {
            "event": "charge.completed",
            "data": {
                "id": 123456,
                "tx_ref": invoice_id,
                "status": "successful",
                "amount": 10.00,
                "currency": "USD",
                "meta": {"invoice_id": invoice_id},
            },
        }

    # Forged signature is rejected before any parsing or state change.
    forged = client.post(
        "/webhooks/flutterwave",
        json=_charge_payload(),
        headers={"verif-hash": "wrong"},
    )
    assert forged.status_code == 400

    # Domain fact: a settled invoice publishes InvoicePaid exactly once.
    from app.application.event_bus import default_event_bus
    from app.domain.events import InvoicePaid

    paid_events: list[InvoicePaid] = []
    default_event_bus.subscribe(InvoicePaid, paid_events.append)
    try:
        # Valid signature settles the invoice.
        valid = client.post(
            "/webhooks/flutterwave",
            json=_charge_payload(),
            headers={"verif-hash": "whash-secret"},
        )
        assert valid.status_code == 200, valid.text
        assert valid.json()["event_type"] == "invoice.payment_succeeded"

        # Duplicate delivery is idempotent: still 200, no second event.
        duplicate = client.post(
            "/webhooks/flutterwave",
            json=_charge_payload(),
            headers={"verif-hash": "whash-secret"},
        )
        assert duplicate.status_code == 200, duplicate.text

        # A verified callback actually settled the invoice server-side.
        status_response = client.get(
            f"/billing/payments/status?invoice_id={invoice_id}", headers=headers
        )
        assert status_response.status_code == 200, status_response.text
        assert status_response.json()["status"] == "paid"
        assert status_response.json()["paid"] is True
    finally:
        default_event_bus.unsubscribe(InvoicePaid, paid_events.append)

    assert len(paid_events) == 1
    assert paid_events[0].invoice_id == invoice_id
    assert paid_events[0].amount_cents == 1000
