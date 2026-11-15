"""Mock payment gateway for development and testing.

Simulates all payment flows without external API calls.
Supports: Stripe, PayPal, Flutterwave, M-Pesa, Bank Transfer, Crypto
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field

from app.application.ports import (
    PaymentGateway, GatewayCustomer, GatewaySubscription, 
    GatewayInvoice, GatewayPayment, GatewayPaymentMethod,
    WebhookEvent, FeeBreakdown
)


@dataclass
class MockCustomer:
    id: str
    email: str
    name: str
    metadata: dict
    payment_methods: list = field(default_factory=list)


@dataclass
class MockSubscription:
    id: str
    customer_id: str
    status: str
    current_period_start: str
    current_period_end: str
    price_id: str


@dataclass
class MockInvoice:
    id: str
    customer_id: str
    amount_cents: int
    currency: str
    status: str
    line_items: list[dict]
    hosted_invoice_url: str = ""


@dataclass
class MockPayment:
    id: str
    invoice_id: str
    amount_cents: int
    currency: str
    status: str
    raw_response: dict


class MockGateway(PaymentGateway):
    """Mock gateway for development - simulates all payment flows without external calls."""
    
    GATEWAY_ID = "mock"
    SUPPORTED_CURRENCIES = ["USD", "UGX", "EUR", "KES", "GBP"]
    
    def __init__(self, gateway_id: str = "mock", config: dict = None):
        self.gateway_id = gateway_id
        self.config = config or {}
        self._customers: dict[str, MockCustomer] = {}
        self._subscriptions: dict[str, MockSubscription] = {}
        self._invoices: dict[str, MockInvoice] = {}
        self._payments: dict[str, MockPayment] = {}
        self._webhook_secret = config.get("webhook_secret", "mock_webhook_secret")
        self._fee_percentage = config.get("fee_percentage", 0.029)
        self._fee_fixed_cents = config.get("fee_fixed_cents", 30)
    
    # ---- Customer Management ----
    
    def create_customer(self, org_id: str, email: str, name: str, metadata: dict) -> GatewayCustomer:
        customer_id = f"cus_{uuid.uuid4().hex[:16]}"
        customer = MockCustomer(
            id=customer_id,
            email=email,
            name=name,
            metadata=metadata,
        )
        self._customers[org_id] = customer
        return GatewayCustomer(
            id=customer.id,
            email=customer.email,
            name=customer.name,
            metadata=customer.metadata,
        )
    
    def get_or_create_customer(
        self,
        org_id: str,
        email: str | None = None,
        name: str | None = None,
    ) -> GatewayCustomer:
        if org_id in self._customers:
            customer = self._customers[org_id]
            if email:
                customer.email = email
            if name:
                customer.name = name
            return GatewayCustomer(
                id=customer.id,
                email=customer.email,
                name=customer.name,
                metadata=customer.metadata,
            )
        # Create with defaults
        return self.create_customer(
            org_id,
            email or f"org_{org_id}@example.com",
            name or f"Org {org_id}",
            {},
        )
    
    # ---- Subscription Management ----
    
    def create_subscription(self, customer_id: str, price_id: str, trial_days: int = 0) -> GatewaySubscription:
        sub_id = f"sub_{uuid.uuid4().hex[:16]}"
        now = datetime.utcnow()
        period_start = now
        if trial_days > 0:
            period_end = now + timedelta(days=trial_days)
            status = "trialing"
        else:
            period_end = now + timedelta(days=30)
            status = "active"
        
        sub = MockSubscription(
            id=sub_id,
            customer_id=customer_id,
            status=status,
            current_period_start=period_start.isoformat(),
            current_period_end=period_end.isoformat(),
            price_id=price_id,
        )
        self._subscriptions[sub_id] = sub
        return GatewaySubscription(
            id=sub.id,
            customer_id=sub.customer_id,
            status=sub.status,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            price_id=sub.price_id,
        )
    
    def cancel_subscription(self, subscription_id: str, at_period_end: bool = True) -> GatewaySubscription:
        if subscription_id not in self._subscriptions:
            raise ValueError(f"Subscription {subscription_id} not found")
        sub = self._subscriptions[subscription_id]
        if at_period_end:
            sub.status = "active"  # Will cancel at period end
        else:
            sub.status = "cancelled"
        return GatewaySubscription(
            id=sub.id,
            customer_id=sub.customer_id,
            status=sub.status,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            price_id=sub.price_id,
        )

    def resume_subscription(self, subscription_id: str) -> GatewaySubscription:
        if subscription_id not in self._subscriptions:
            raise ValueError(f"Subscription {subscription_id} not found")
        sub = self._subscriptions[subscription_id]
        sub.status = "active"
        return GatewaySubscription(
            id=sub.id,
            customer_id=sub.customer_id,
            status=sub.status,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            price_id=sub.price_id,
        )
    
    # ---- Invoice Management ----
    
    def create_invoice(self, customer_id: str, line_items: list[dict], metadata: dict) -> GatewayInvoice:
        inv_id = f"in_{uuid.uuid4().hex[:16]}"
        total = sum(item.get("unit_amount_cents", 0) * item.get("quantity", 1) for item in line_items)
        invoice = MockInvoice(
            id=inv_id,
            customer_id=customer_id,
            amount_cents=total,
            currency="USD",
            status="draft",
            line_items=line_items,
        )
        self._invoices[inv_id] = invoice
        return GatewayInvoice(
            id=invoice.id,
            customer_id=invoice.customer_id,
            amount_cents=invoice.amount_cents,
            currency=invoice.currency,
            status=invoice.status,
            line_items=invoice.line_items,
            hosted_invoice_url=f"https://mock-billing.example.com/invoices/{inv_id}",
        )
    
    def finalize_invoice(self, invoice_id: str) -> GatewayInvoice:
        if invoice_id not in self._invoices:
            raise ValueError(f"Invoice {invoice_id} not found")
        invoice = self._invoices[invoice_id]
        invoice.status = "open"
        return GatewayInvoice(
            id=invoice.id,
            customer_id=invoice.customer_id,
            amount_cents=invoice.amount_cents,
            currency=invoice.currency,
            status=invoice.status,
            line_items=invoice.line_items,
            hosted_invoice_url=f"https://mock-billing.example.com/invoices/{invoice_id}",
        )
    
    # ---- Payment Processing ----
    
    def pay_invoice(self, invoice_id: str, payment_method_id: str = None) -> GatewayPayment:
        if invoice_id not in self._invoices:
            raise ValueError(f"Invoice {invoice_id} not found")
        invoice = self._invoices[invoice_id]
        
        # Simulate payment processing
        # In mock mode, randomly succeed or fail based on config
        force_fail = self.config.get("force_payment_fail", False)
        payment_status = "failed" if force_fail else "succeeded"
        
        payment_id = f"pi_{uuid.uuid4().hex[:16]}"
        payment = MockPayment(
            id=payment_id,
            invoice_id=invoice_id,
            amount_cents=invoice.amount_cents,
            currency=invoice.currency,
            status=payment_status,
            raw_response={
                "id": payment_id,
                "status": payment_status,
                "amount": invoice.amount_cents / 100,
                "currency": invoice.currency,
                "invoice_id": invoice_id,
            },
        )
        self._payments[payment_id] = payment
        
        invoice.status = "paid" if payment_status == "succeeded" else "open"
        
        return GatewayPayment(
            id=payment.id,
            invoice_id=payment.invoice_id,
            amount_cents=payment.amount_cents,
            currency=payment.currency,
            status=payment.status,
            raw_response=payment.raw_response,
        )
    
    def create_payment_method(self, customer_id: str, type: str, details: dict) -> GatewayPaymentMethod:
        pm_id = f"pm_{uuid.uuid4().hex[:16]}"
        return GatewayPaymentMethod(
            id=pm_id,
            customer_id=customer_id,
            type=type,
            details=details,
        )
    
    # ---- Webhook Handling ----
    
    def handle_webhook(self, payload: bytes, signature: str) -> WebhookEvent:
        # In mock mode, parse payload and return event
        import json
        try:
            data = json.loads(payload.decode())
        except json.JSONDecodeError:
            data = {"raw": payload.decode()}
        
        event_type = data.get("type", "unknown")
        
        return WebhookEvent(
            type=event_type,
            data=data,
            raw_data=data,
            gateway=self.gateway_id,
        )
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        # Mock verification - always true in development
        return True
    
    # ---- Utility ----
    
    def get_supported_currencies(self) -> list[str]:
        return self.SUPPORTED_CURRENCIES
    
    def calculate_fees(self, amount_cents: int, currency: str) -> FeeBreakdown:
        gateway_fee = int(amount_cents * self._fee_percentage) + self._fee_fixed_cents
        platform_fee = int(amount_cents * 0.005)  # 0.5% platform fee
        net_amount = amount_cents - gateway_fee - platform_fee
        return FeeBreakdown(
            gateway_fee_cents=gateway_fee,
            platform_fee_cents=platform_fee,
            net_amount_cents=net_amount,
        )


class StripeMockGateway(MockGateway):
    """Stripe-specific mock gateway."""
    GATEWAY_ID = "stripe"
    SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "UGX", "KES"]


class PayPalMockGateway(MockGateway):
    """PayPal-specific mock gateway."""
    GATEWAY_ID = "paypal"
    SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP"]


class FlutterwaveMockGateway(MockGateway):
    """Flutterwave (Africa) mock gateway."""
    GATEWAY_ID = "flutterwave"
    SUPPORTED_CURRENCIES = ["USD", "UGX", "KES", "NGN", "GHS", "ZAR"]


class MpesaMockGateway(MockGateway):
    """M-Pesa (Mobile Money Kenya) mock gateway."""
    GATEWAY_ID = "mpesa"
    SUPPORTED_CURRENCIES = ["KES", "USD"]


class BankTransferMockGateway(MockGateway):
    """Bank Transfer mock gateway."""
    GATEWAY_ID = "bank_transfer"
    SUPPORTED_CURRENCIES = ["USD", "UGX", "EUR", "KES"]


class CryptoMockGateway(MockGateway):
    """Crypto (USDC/USDT) mock gateway."""
    GATEWAY_ID = "crypto"
    SUPPORTED_CURRENCIES = ["USDC", "USDT", "USD"]


# Gateway factory for easy instantiation
GATEWAY_CLASSES = {
    "mock": MockGateway,
    "stripe": StripeMockGateway,
    "paypal": PayPalMockGateway,
    "flutterwave": FlutterwaveMockGateway,
    "mpesa": MpesaMockGateway,
    "bank_transfer": BankTransferMockGateway,
    "crypto": CryptoMockGateway,
}


def create_gateway(gateway_id: str, config: dict = None) -> PaymentGateway:
    """Factory function to create gateway instances."""
    gateway_class = GATEWAY_CLASSES.get(gateway_id.lower(), MockGateway)
    return gateway_class(gateway_id, config or {})