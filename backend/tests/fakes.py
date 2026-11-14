"""Test doubles. A deterministic LLMClient so advisor tests never hit Groq."""
import dataclasses
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from app.application.ports import (
    ApplicationRepository,
    InvoiceRepository,
    LLMClient,
    PlacementRepository,
    SavedRepository,
    StudentUsageRepository,
    SubscriptionRepository,
    TransactionRepository,
    UserRepository,
)
from app.domain.entities import (
    Application, Invoice, Placement, StudentUsage, Subscription, 
    Transaction, User
)
from app.infrastructure.payment_gateways.factory import PaymentGatewayFactory as InfraGatewayFactory
from app.infrastructure.payment_gateways.mock_gateway import create_gateway


class FakeLLM(LLMClient):
    def __init__(self, canned: str = "Here is your advice.") -> None:
        self.canned = canned
        self.last_prompt: str | None = None
        self.calls = 0

    def complete(self, prompt: str) -> str:
        self.last_prompt = prompt
        self.calls += 1
        return self.canned


class InMemoryPlacementRepository(PlacementRepository):
    def __init__(self, placements: list[Placement]) -> None:
        self._by_id = {p.id: p for p in placements}

    def list(self, **filters) -> list[Placement]:
        return list(self._by_id.values())

    def get(self, placement_id: str) -> Optional[Placement]:
        return self._by_id.get(placement_id)

    def update(self, placement_id: str, **fields) -> Optional[Placement]:
        existing = self._by_id.get(placement_id)
        if existing is None:
            return None
        updated = dataclasses.replace(existing, **fields)
        self._by_id[placement_id] = updated
        return updated


class InMemoryApplicationRepository(ApplicationRepository):
    def __init__(self) -> None:
        self._items: list[Application] = []

    def add(self, application: Application) -> Application:
        self._items.append(application)
        return application

    def find(self, user_id: str, placement_id: str) -> Optional[Application]:
        return next(
            (
                a
                for a in self._items
                if a.user_id == user_id and a.placement_id == placement_id
            ),
            None,
        )

    def find_by_id(self, application_id: str) -> Optional[Application]:
        return next((a for a in self._items if a.id == application_id), None)

    def withdraw(self, user_id: str, application_id: str) -> Optional[Application]:
        application = self.find_by_id(application_id)
        if application is None or application.user_id != user_id:
            return None
        updated = Application(
            id=application.id,
            user_id=application.user_id,
            placement_id=application.placement_id,
            status="Withdrawn",
            statement=application.statement,
            created_at=application.created_at,
        )
        self._items[self._items.index(application)] = updated
        return updated

    def list_for_user(self, user_id: str) -> list[Application]:
        return [a for a in self._items if a.user_id == user_id]

    def list_for_placement(self, placement_id: str) -> list[Application]:
        return [a for a in self._items if a.placement_id == placement_id]


class InMemorySavedRepository(SavedRepository):
    def __init__(self) -> None:
        self._by_user: dict[str, set[str]] = defaultdict(set)

    def list(self, user_id: str) -> list[str]:
        return sorted(self._by_user[user_id])

    def is_saved(self, user_id: str, placement_id: str) -> bool:
        return placement_id in self._by_user[user_id]

    def toggle(self, user_id: str, placement_id: str) -> bool:
        if placement_id in self._by_user[user_id]:
            self._by_user[user_id].discard(placement_id)
            return False
        self._by_user[user_id].add(placement_id)
        return True


class InMemorySubscriptionRepository(SubscriptionRepository):
    def __init__(self) -> None:
        self._by_org: dict[str, Subscription] = {}

    def get(self, org_id: str) -> Subscription:
        return self._by_org.get(org_id, Subscription(org_id=org_id))

    def save(self, subscription: Subscription) -> Subscription:
        self._by_org[subscription.org_id] = subscription
        return subscription


class InMemoryInvoiceRepository(InvoiceRepository):
    def __init__(self) -> None:
        self._items: dict[str, Invoice] = {}

    def get(self, invoice_id: str) -> Optional[Invoice]:
        return self._items.get(invoice_id)

    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Invoice]:
        items = [inv for inv in self._items.values() if inv.org_id == org_id]
        if status:
            items = [inv for inv in items if inv.status == status]
        return items

    def list_outstanding(self) -> list[Invoice]:
        now = datetime.utcnow()
        return [
            inv
            for inv in self._items.values()
            if inv.status == "open"
            and inv.due_date is not None
            and inv.due_date < now.isoformat()
        ]

    def find_by_gateway_id(self, gateway: str, gateway_invoice_id: str) -> Optional[Invoice]:
        for inv in self._items.values():
            if inv.payment_gateway == gateway and inv.gateway_invoice_id == gateway_invoice_id:
                return inv
        return None

    def find_by_number(self, invoice_number: str) -> Optional[Invoice]:
        for inv in self._items.values():
            if inv.invoice_number == invoice_number:
                return inv
        return None

    def save(self, invoice: Invoice) -> Invoice:
        self._items[invoice.id] = invoice
        return invoice


class InMemoryTransactionRepository(TransactionRepository):
    def __init__(self) -> None:
        self._items: dict[str, Transaction] = {}

    def get(self, transaction_id: str) -> Optional[Transaction]:
        return self._items.get(transaction_id)

    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Transaction]:
        items = [txn for txn in self._items.values() if txn.org_id == org_id]
        if status:
            items = [txn for txn in items if txn.status == status]
        return items

    def find_by_idempotency_key(self, key: str) -> Optional[Transaction]:
        for txn in self._items.values():
            if txn.idempotency_key == key:
                return txn
        return None

    def find_by_invoice_and_type(self, invoice_id: str, type: str) -> Optional[Transaction]:
        for txn in self._items.values():
            if txn.invoice_id == invoice_id and txn.type == type:
                return txn
        return None

    def save(self, transaction: Transaction) -> Transaction:
        self._items[transaction.id] = transaction
        return transaction


class InMemoryStudentUsageRepository(StudentUsageRepository):
    def __init__(self) -> None:
        self._items: dict[tuple[str, str], StudentUsage] = {}

    def get(self, user_id: str, month: str) -> Optional[StudentUsage]:
        return self._items.get((user_id, month))

    def get_or_create(self, user_id: str, month: str) -> StudentUsage:
        key = (user_id, month)
        if key not in self._items:
            self._items[key] = StudentUsage(
                id=f"su_test_{user_id}_{month}",
                user_id=user_id,
                month=month,
                application_count=0,
            )
        return self._items[key]

    def save(self, usage: StudentUsage) -> StudentUsage:
        self._items[(usage.user_id, usage.month)] = usage
        return usage


class FakeGatewayFactory(InfraGatewayFactory):
    def __init__(self):
        super().__init__()
        # Register mock gateways
        for gw_id in ["mock", "stripe", "paypal", "flutterwave", "mpesa", "bank_transfer", "crypto"]:
            self.register_gateway(gw_id, {"mode": "mock"})


class InMemoryUserRepository(UserRepository):
    def __init__(self) -> None:
        self._by_id: dict[str, User] = {}
        self._by_email: dict[str, User] = {}

    def add(self, user: User) -> User:
        self._by_id[user.id] = user
        self._by_email[user.email] = user
        return user

    def get_by_email(self, email: str) -> User | None:
        return self._by_email.get(email)

    def get_by_id(self, user_id: str) -> User | None:
        return self._by_id.get(user_id)

    def update(self, user_id: str, **fields) -> User | None:
        existing = self._by_id.get(user_id)
        if existing is None:
            return None
        updated = dataclasses.replace(existing, **fields)
        self._by_id[user_id] = updated
        self._by_email.pop(existing.email, None)
        if "email" in fields:
            self._by_email[fields["email"]] = updated
        return updated


class InMemorySubscriptionRepository(SubscriptionRepository):
    def __init__(self) -> None:
        self._by_org: dict[str, Subscription] = {}

    def get(self, org_id: str) -> Subscription:
        return self._by_org.get(org_id, Subscription(org_id=org_id))

    def save(self, subscription: Subscription) -> Subscription:
        self._by_org[subscription.org_id] = subscription
        return subscription


class InMemoryUserRepository(UserRepository):
    def __init__(self) -> None:
        self._by_id: dict[str, User] = {}
        self._by_email: dict[str, User] = {}

    def add(self, user: User) -> User:
        self._by_id[user.id] = user
        self._by_email[user.email] = user
        return user

    def get_by_email(self, email: str) -> User | None:
        return self._by_email.get(email)

    def get_by_id(self, user_id: str) -> User | None:
        return self._by_id.get(user_id)

    def update(self, user_id: str, **fields) -> User | None:
        existing = self._by_id.get(user_id)
        if existing is None:
            return None
        updated = dataclasses.replace(existing, **fields)
        self._by_id[user_id] = updated
        self._by_email.pop(existing.email, None)
        if "email" in fields:
            self._by_email[fields["email"]] = updated
        return updated
