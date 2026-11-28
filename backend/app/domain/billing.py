"""Billing bounded context: subscriptions, invoices, transactions, usage."""
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class Subscription:
    """A host organisation's live billing state (placement-fee plan).

    ``plan == "Free"`` means no paid plan; the free posting allowance then
    applies. Premium lives with employers/institutions, never students.
    """

    org_id: str
    plan: str = "Free"
    billing: str = ""
    seats: int = 1
    since: str = ""
    status: str = "active"
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool = False
    trial_end: Optional[str] = None
    payment_gateway: Optional[str] = None
    gateway_customer_id: Optional[str] = None
    gateway_subscription_id: Optional[str] = None

    @property
    def is_premium(self) -> bool:
        return self.plan != "Free" and self.status in ("active", "trialing")


@dataclass(frozen=True)
class Invoice:
    """An invoice for billing an organisation."""

    id: str
    org_id: Optional[str]
    user_id: Optional[str] = None
    subscription_id: Optional[str] = None
    amount_cents: int = 0
    currency: str = "USD"
    status: str = "draft"  # draft, open, paid, void, uncollectible
    invoice_number: str = ""
    description: Optional[str] = None
    line_items: list = field(default_factory=list)
    invoice_metadata: dict = field(default_factory=dict)
    due_date: Optional[str] = None
    paid_at: Optional[str] = None
    payment_gateway: Optional[str] = None
    gateway_invoice_id: Optional[str] = None
    gateway_payment_intent_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass(frozen=True)
class Transaction:
    """A payment transaction (immutable ledger)."""

    id: str
    org_id: Optional[str]
    user_id: Optional[str] = None
    invoice_id: Optional[str] = None
    subscription_id: Optional[str] = None
    amount_cents: int = 0
    currency: str = "USD"
    type: str = ""  # payment, refund, chargeback, credit, fee
    status: str = "pending"  # pending, succeeded, failed, cancelled
    payment_gateway: str = ""
    gateway_transaction_id: Optional[str] = None
    gateway_response: dict = field(default_factory=dict)
    description: Optional[str] = None
    transaction_metadata: dict = field(default_factory=dict)
    idempotency_key: Optional[str] = None
    created_at: Optional[str] = None
    processed_at: Optional[str] = None


@dataclass(frozen=True)
class StudentUsage:
    """Student application usage tracking for billing."""

    id: str
    user_id: str
    month: str  # YYYY-MM
    application_count: int = 0
    billed_count: int = 0
    last_billed_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
