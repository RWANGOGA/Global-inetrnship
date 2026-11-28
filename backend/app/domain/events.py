"""Domain events for the bounded contexts.

Events describe business facts that already happened ("an application was
submitted", "an invoice was paid"). They carry ids and primitives only, never
live entities or repository handles, so handlers stay decoupled from the
aggregates that produced them.
"""
from dataclasses import dataclass, field
from datetime import datetime


def _now() -> str:
    return datetime.utcnow().isoformat()


@dataclass(frozen=True, kw_only=True)
class DomainEvent:
    """Base class for every domain event."""

    occurred_at: str = field(default_factory=_now)


@dataclass(frozen=True, kw_only=True)
class PlacementPublished(DomainEvent):
    placement_id: str
    org_id: str = ""


@dataclass(frozen=True, kw_only=True)
class ApplicationSubmitted(DomainEvent):
    application_id: str
    user_id: str
    placement_id: str


@dataclass(frozen=True, kw_only=True)
class InvoicePaid(DomainEvent):
    invoice_id: str
    amount_cents: int
    currency: str = "USD"
    org_id: str | None = None
    user_id: str | None = None


@dataclass(frozen=True, kw_only=True)
class SubscriptionActivated(DomainEvent):
    org_id: str
    plan: str


@dataclass(frozen=True, kw_only=True)
class UserRoleChanged(DomainEvent):
    user_id: str
    old_role: str
    new_role: str
