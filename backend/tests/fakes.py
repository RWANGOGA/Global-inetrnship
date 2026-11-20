"""Test doubles. A deterministic LLMClient so advisor tests never hit Groq."""
import dataclasses
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from app.application.ports import (
    ApplicationRepository,
    InvoiceRepository,
    LLMClient,
    PaymentMethodRepository,
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

    def reactivate(self, user_id: str, application_id: str) -> Optional[Application]:
        application = self.find_by_id(application_id)
        if application is None or application.user_id != user_id:
            return None
        updated = Application(
            id=application.id,
            user_id=application.user_id,
            placement_id=application.placement_id,
            status="Submitted",
            statement=application.statement,
            cover_letter=application.cover_letter,
            cv_url=application.cv_url,
            github_url=application.github_url,
            linkedin_url=application.linkedin_url,
            portfolio_url=application.portfolio_url,
            academic_papers=application.academic_papers,
            reference_1_name=application.reference_1_name,
            reference_1_email=application.reference_1_email,
            reference_1_phone=application.reference_1_phone,
            reference_1_relationship=application.reference_1_relationship,
            reference_2_name=application.reference_2_name,
            reference_2_email=application.reference_2_email,
            reference_2_phone=application.reference_2_phone,
            reference_2_relationship=application.reference_2_relationship,
            document_ids=application.document_ids,
            shortlisted=application.shortlisted,
            created_at=application.created_at,
            updated_at=datetime.utcnow().isoformat(),
        )
        self._items[self._items.index(application)] = updated
        return updated


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

    def list_for_user(self, user_id: str, status: Optional[str] = None) -> list[Invoice]:
        items = [inv for inv in self._items.values() if inv.user_id == user_id]
        if status:
            items = [inv for inv in items if inv.status == status]
        return items

    def list_all(self, status: Optional[str] = None, org_id: Optional[str] = None) -> list[Invoice]:
        items = list(self._items.values())
        if status:
            items = [inv for inv in items if inv.status == status]
        if org_id is not None:
            items = [inv for inv in items if inv.org_id == org_id]
        return items

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

    def list_all(self, status: Optional[str] = None, org_id: Optional[str] = None) -> list[Transaction]:
        items = list(self._items.values())
        if status:
            items = [txn for txn in items if txn.status == status]
        if org_id is not None:
            items = [txn for txn in items if txn.org_id == org_id]
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

    def list_by_role(self, role: str) -> list[User]:
        return [u for u in self._by_id.values() if u.role == role]

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


class InMemoryPaymentMethodRepository(PaymentMethodRepository):
    """PaymentMethodRepository double, keyed by (org_id, payment_method_id)."""

    def __init__(self) -> None:
        self._by_org: dict[tuple[str, str], dict] = {}
        self._seq = 0

    def _new_id(self, prefix: str) -> str:
        self._seq += 1
        return f"{prefix}_{self._seq:04d}"

    def list(self, org_id: str) -> list[dict]:
        return [m for (org, _), m in self._by_org.items() if org == org_id]

    def get(self, org_id: str, payment_method_id: str) -> Optional[dict]:
        return self._by_org.get((org_id, payment_method_id))

    def add(
        self,
        org_id: str,
        type: str,
        details: dict,
        gateway_payment_method_id: Optional[str] = None,
    ) -> dict:
        method = {
            "org_id": org_id,
            "payment_method_id": self._new_id("pm"),
            "type": type,
            "details": details or {},
            "gateway_payment_method_id": gateway_payment_method_id
            or self._new_id("pm_mock"),
        }
        self._by_org[(org_id, method["payment_method_id"])] = method
        return method

    def delete(self, org_id: str, payment_method_id: str) -> bool:
        return self._by_org.pop((org_id, payment_method_id), None) is not None

    def set_default(self, org_id: str, payment_method_id: str) -> bool:
        method = self.get(org_id, payment_method_id)
        if method is None:
            return False
        method["is_default"] = True
        return True


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

    def list_by_role(self, role: str) -> list[User]:
        return [u for u in self._by_id.values() if u.role == role]

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
