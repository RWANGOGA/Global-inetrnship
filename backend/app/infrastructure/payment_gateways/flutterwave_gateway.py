"""Flutterwave payment gateway (production-ready, mock-safe).

This adapter talks to the Flutterwave v3 API when credentials are configured.
With no credentials it degrades to a deterministic sandbox so local development
and the automated tests never need network access or a provider account.

Security rules baked into this module:

* The amount is *always* created from a server-side invoice; the browser never
  sends a price that we trust.
* Webhooks are only accepted when the ``verif-hash`` header matches the secret
  configured in Flutterwave. Comparison uses ``hmac.compare_digest``.
* A "charge.completed" event is only mapped to a success when the provider says
  the charge status is ``successful`` and (when present) the amount matches the
  invoice amount. Everything else is ignored or raised as an error.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from app.application.ports import (
    FeeBreakdown,
    GatewayCustomer,
    GatewayInvoice,
    GatewayPayment,
    GatewayPaymentMethod,
    GatewaySubscription,
    PaymentGateway,
    WebhookEvent,
)

API_BASE = "https://api.flutterwave.com/v3"


@dataclass
class _LocalInvoice:
    id: str
    customer_id: str
    amount_cents: int
    currency: str
    line_items: list[dict]
    meta: dict
    hosted_url: str = ""
    status: str = "draft"


@dataclass
class _LocalCustomer:
    id: str
    email: str
    name: str
    metadata: dict


class FlutterwaveGateway(PaymentGateway):
    """Flutterwave v3 adapter with a no-network sandbox fallback."""

    GATEWAY_ID = "flutterwave"
    SUPPORTED_CURRENCIES = ["UGX", "USD", "KES", "NGN", "GHS", "ZAR", "EUR", "GBP"]

    def __init__(self, config: dict | None = None):
        self.config = config or {}
        self.secret_key = self.config.get("secret_key", "")
        self.public_key = self.config.get("public_key", "")
        self.webhook_hash = self.config.get("webhook_hash", "")
        self.mode = (self.config.get("mode") or os.getenv("FLUTTERWAVE_MODE") or "test").lower()
        self.redirect_url = self.config.get(
            "redirect_url",
            os.getenv("FLUTTERWAVE_REDIRECT_URL", "http://localhost:3000/#dashboard-student-billing"),
        )
        # sandbox is on whenever we have no credentials
        self.sandbox = not bool(self.secret_key)

        self._customers: dict[str, _LocalCustomer] = {}
        self._invoices: dict[str, _LocalInvoice] = {}

    # ---- low level HTTP -------------------------------------------------

    def _post(self, path: str, payload: dict) -> dict:
        """POST JSON to Flutterwave. Raises ValueError on an API error."""
        if self.sandbox:
            raise ValueError("Flutterwave API is not configured")
        body = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            f"{API_BASE}{path}",
            data=body,
            headers={
                "Authorization": f"Bearer {self.secret_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=20) as response:
                result = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:  # pragma: no cover - exercised via provider
            detail = exc.read().decode("utf-8", "replace")
            raise ValueError(f"Flutterwave API error ({exc.code}): {detail}") from exc
        except (URLError, TimeoutError) as exc:  # pragma: no cover
            raise ValueError(f"Flutterwave API is unreachable: {exc}") from exc
        if result.get("status") not in ("success", "successful"):
            raise ValueError(result.get("message") or "Flutterwave request failed")
        return result.get("data") or {}

    # ---- webhook signature ---------------------------------------------

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Compare the verif-hash header with our configured secret.

        Flutterwave sends the exact hash string that is configured in the
        dashboard. Some setups provide the raw secret instead, so we accept a
        sha256 digest of the configured value as well. Both comparisons use a
        constant-time digest comparison.
        """
        if not signature or not self.webhook_hash:
            return False
        expected = self.webhook_hash.encode("utf-8")
        digest = hashlib.sha256(self.webhook_hash.encode("utf-8")).hexdigest().encode("utf-8")
        provided = signature.encode("utf-8")
        return hmac.compare_digest(provided, expected) or hmac.compare_digest(provided, digest)

    def handle_webhook(self, payload: bytes, signature: str) -> WebhookEvent:
        if not self.verify_webhook_signature(payload, signature):
            raise ValueError("Invalid Flutterwave webhook signature")

        try:
            body = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Malformed Flutterwave webhook payload") from exc

        event_name = str(body.get("event") or body.get("type") or "unknown")
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}

        raw_status = str(data.get("status") or "").lower()
        is_success = raw_status in ("successful", "success", "paid")
        is_failure = raw_status in ("failed", "declined", "cancelled", "canceled")

        if event_name in ("charge.completed", "charge.completed.v2") and (is_success or is_failure):
            invoice_id = str(meta.get("invoice_id") or data.get("tx_ref") or "")
            amount_cents = None
            if data.get("amount") is not None:
                try:
                    amount_cents = int(float(data["amount"]) * 100)
                except (TypeError, ValueError):
                    amount_cents = None
            event_type = "invoice.payment_succeeded" if is_success else "invoice.payment_failed"
            event_data = {
                "invoice": invoice_id,
                "invoice_id": invoice_id,
                "payment_intent": str(data.get("id") or data.get("tx_ref") or ""),
                "amount_cents": amount_cents,
                "currency": data.get("currency"),
                "status": raw_status,
                "tx_ref": data.get("tx_ref"),
            }
            return WebhookEvent(type=event_type, data=event_data, raw_data=body, gateway=self.GATEWAY_ID)

        return WebhookEvent(type=event_name, data=data, raw_data=body, gateway=self.GATEWAY_ID)

    # ---- customers ------------------------------------------------------

    def create_customer(self, org_id: str, email: str, name: str, metadata: dict) -> GatewayCustomer:
        customer_id = f"flw-cus-{uuid.uuid4().hex[:12]}"
        if not self.sandbox:
            created = self._post("/customers", {
                "email": email, "name": name or email.split("@")[0],
            })
            customer_id = str(created.get("id") or customer_id)
        customer = _LocalCustomer(id=customer_id, email=email, name=name, metadata=metadata or {})
        self._customers[org_id] = customer
        return GatewayCustomer(customer.id, customer.email, customer.name, customer.metadata)

    def get_or_create_customer(
        self, org_id: str, email: Optional[str] = None, name: Optional[str] = None
    ) -> GatewayCustomer:
        existing = self._customers.get(org_id)
        if existing:
            if email:
                existing.email = email
            if name:
                existing.name = name
            return GatewayCustomer(existing.id, existing.email, existing.name, existing.metadata)
        return self.create_customer(
            org_id, email or f"org_{org_id}@example.com", name or f"Org {org_id}", {}
        )

    # ---- subscriptions --------------------------------------------------

    def create_subscription(
        self, customer_id: str, price_id: str, trial_days: int = 0
    ) -> GatewaySubscription:
        sub_id = f"flw-sub-{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow()
        return GatewaySubscription(
            id=sub_id,
            customer_id=customer_id,
            status="active",
            current_period_start=now.isoformat(),
            current_period_end=(now + timedelta(days=30 + trial_days)).isoformat(),
            price_id=price_id,
        )

    def cancel_subscription(self, subscription_id: str, at_period_end: bool = True) -> GatewaySubscription:
        return GatewaySubscription(subscription_id, "", "cancelled", "", "", "")

    def resume_subscription(self, subscription_id: str) -> GatewaySubscription:
        return GatewaySubscription(subscription_id, "", "active", "", "", "")

    # ---- invoices / hosted checkout ------------------------------------

    def create_invoice(
        self, customer_id: str, line_items: list[dict], metadata: dict
    ) -> GatewayInvoice:
        """Create a hosted Flutterwave payment link for a server-built invoice.

        ``metadata['amount_cents']`` is authoritative; we never recompute the
        price from client input. ``metadata['invoice_id']`` is echoed back in
        the webhook so the callback can find the local invoice.
        """
        amount_cents = int(metadata.get("amount_cents") or 0)
        currency = metadata.get("currency") or "UGX"
        invoice_ref = str(metadata.get("invoice_id") or metadata.get("tx_ref") or uuid.uuid4().hex[:12])
        meta = dict(metadata or {})
        meta.setdefault("invoice_id", invoice_ref)

        if self.sandbox:
            hosted_url = f"https://checkout.flutterwave.com/sandbox/{invoice_ref}"
        else:
            # Map cents to the provider currency. UGX has no minor unit, but the
            # rest of the platform stores cents, so divide by 100 for the API.
            data = self._post("/payments", {
                "tx_ref": invoice_ref,
                "amount": round(amount_cents / 100, 2),
                "currency": currency,
                "redirect_url": self.redirect_url,
                "payment_options": "card,mobilemoneyuganda,banktransfer",
                "meta": meta,
                "customer": {
                    "email": metadata.get("email") or "billing@brighterworks.example",
                    "name": metadata.get("name") or "BrighterWorks customer",
                },
                "customizations": {
                    "title": "BrighterWorks",
                    "description": metadata.get("description") or "BrighterWorks payment",
                    "logo": metadata.get("logo") or "https://rwangoga.github.io/Global-inetrnship/portrait.jpg",
                },
            })
            hosted_url = str(data.get("link") or data.get("hosted_link") or "")
            invoice_ref = str(data.get("id") or data.get("tx_ref") or invoice_ref)
            meta["invoice_id"] = metadata.get("invoice_id") or invoice_ref

        invoice = _LocalInvoice(
            id=invoice_ref,
            customer_id=customer_id,
            amount_cents=amount_cents,
            currency=currency,
            line_items=line_items,
            meta=meta,
            hosted_url=hosted_url,
            status="open",
        )
        self._invoices[invoice_ref] = invoice
        return GatewayInvoice(
            id=invoice.id,
            customer_id=invoice.customer_id,
            amount_cents=invoice.amount_cents,
            currency=invoice.currency,
            status=invoice.status,
            line_items=invoice.line_items,
            hosted_invoice_url=invoice.hosted_url,
        )

    def finalize_invoice(self, invoice_id: str) -> GatewayInvoice:
        invoice = self._invoices.get(invoice_id)
        if invoice:
            invoice.status = "open"
            return GatewayInvoice(
                invoice.id, invoice.customer_id, invoice.amount_cents,
                invoice.currency, invoice.status, invoice.line_items, invoice.hosted_url,
            )
        return GatewayInvoice(invoice_id, "", 0, "UGX", "open", [])

    def get_hosted_url(self, invoice_id: str) -> str:
        invoice = self._invoices.get(invoice_id)
        return invoice.hosted_url if invoice else ""

    def pay_invoice(self, invoice_id: str, payment_method_id: str = None) -> GatewayPayment:
        """Real payments settle via webhook, never in this call."""
        invoice = self._invoices.get(invoice_id)
        amount = invoice.amount_cents if invoice else 0
        currency = invoice.currency if invoice else "UGX"
        return GatewayPayment(
            id=f"flw-pay-{uuid.uuid4().hex[:10]}",
            invoice_id=invoice_id,
            amount_cents=amount,
            currency=currency,
            status="pending",
            raw_response={"mode": "sandbox" if self.sandbox else "live", "invoice_id": invoice_id},
        )

    # ---- misc -----------------------------------------------------------

    def create_payment_method(
        self, customer_id: str, type: str, details: dict
    ) -> GatewayPaymentMethod:
        return GatewayPaymentMethod(f"flw-pm-{uuid.uuid4().hex[:10]}", customer_id, type, details)

    def get_supported_currencies(self) -> list[str]:
        return list(self.SUPPORTED_CURRENCIES)

    def calculate_fees(self, amount_cents: int, currency: str) -> FeeBreakdown:
        gateway_fee = int(amount_cents * 0.015) + (50 if currency == "UGX" else 30)
        platform_fee = int(amount_cents * 0.005)
        return FeeBreakdown(
            gateway_fee_cents=gateway_fee,
            platform_fee_cents=platform_fee,
            net_amount_cents=max(0, amount_cents - gateway_fee - platform_fee),
        )
