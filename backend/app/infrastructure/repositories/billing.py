"""Billing bounded context: invoices, transactions, usage, subscriptions, payment methods."""
from datetime import datetime
from typing import Optional
from uuid import uuid4
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from app.application.ports import (
    SubscriptionRepository,
    InvoiceRepository,
    TransactionRepository,
    StudentUsageRepository,
    PaymentMethodRepository,
)
from app.domain.entities import (
    Invoice,
    StudentUsage,
    Subscription,
    Transaction,
)
from app.infrastructure.orm import (
    InvoiceORM,
    SubscriptionORM,
    TransactionORM,
    StudentUsageORM,
    PaymentMethodORM,
)

def _billing_org_id(session: Session, table: str, org_id: Optional[str]) -> Optional[str]:
    if org_id is not None or session.bind.dialect.name != "sqlite":
        return org_id
    columns = inspect(session.bind).get_columns(table)
    org_column = next((column for column in columns if column["name"] == "org_id"), None)
    return "" if org_column and not org_column["nullable"] else None

class SqlAlchemyInvoiceRepository(InvoiceRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: "InvoiceORM") -> Invoice:
        return Invoice(
            id=row.id,
            org_id=row.org_id,
            user_id=row.user_id,
            subscription_id=row.subscription_id,
            amount_cents=row.amount_cents,
            currency=row.currency,
            status=row.status,
            invoice_number=row.invoice_number,
            description=row.description,
            line_items=row.line_items or [],
            invoice_metadata=row.invoice_metadata or {},
            due_date=row.due_date,
            paid_at=row.paid_at,
            payment_gateway=row.payment_gateway,
            gateway_invoice_id=row.gateway_invoice_id,
            gateway_payment_intent_id=row.gateway_payment_intent_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def get(self, invoice_id: str) -> Optional[Invoice]:
        row = self._session.query(InvoiceORM).filter_by(id=invoice_id).first()
        return self._to_domain(row) if row else None

    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Invoice]:
        query = self._session.query(InvoiceORM).filter_by(org_id=org_id)
        if status:
            query = query.filter_by(status=status)
        rows = query.order_by(InvoiceORM.created_at.desc()).all()
        return [self._to_domain(r) for r in rows]

    def list_for_user(self, user_id: str, status: Optional[str] = None) -> list[Invoice]:
        query = self._session.query(InvoiceORM).filter(
            (InvoiceORM.user_id == user_id) | (InvoiceORM.org_id == user_id)
        )
        if status:
            query = query.filter_by(status=status)
        rows = query.order_by(InvoiceORM.created_at.desc()).all()
        return [self._to_domain(r) for r in rows]

    def list_all(self, status: Optional[str] = None, org_id: Optional[str] = None) -> list[Invoice]:
        query = self._session.query(InvoiceORM)
        if status:
            query = query.filter_by(status=status)
        if org_id:
            query = query.filter_by(org_id=org_id)
        rows = query.order_by(InvoiceORM.created_at.desc()).all()
        return [self._to_domain(r) for r in rows]

    def find_by_gateway_id(self, gateway: str, gateway_invoice_id: str) -> Optional[Invoice]:
        row = self._session.query(InvoiceORM).filter_by(
            payment_gateway=gateway,
            gateway_invoice_id=gateway_invoice_id
        ).first()
        return self._to_domain(row) if row else None

    def find_by_number(self, invoice_number: str) -> Optional[Invoice]:
        row = self._session.query(InvoiceORM).filter_by(invoice_number=invoice_number).first()
        return self._to_domain(row) if row else None

    def list_outstanding(self) -> list[Invoice]:
        rows = (
            self._session.query(InvoiceORM)
            .filter(InvoiceORM.status == "open")
            .filter(InvoiceORM.due_date < datetime.utcnow())
            .order_by(InvoiceORM.due_date.asc())
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def save(self, invoice: Invoice) -> Invoice:
        row = self._session.query(InvoiceORM).filter_by(id=invoice.id).first()
        if row is None:
            row = InvoiceORM(id=invoice.id)
            self._session.add(row)
        row.org_id = _billing_org_id(self._session, "invoices", invoice.org_id)
        row.user_id = invoice.user_id
        row.subscription_id = invoice.subscription_id
        row.amount_cents = invoice.amount_cents
        row.currency = invoice.currency
        row.status = invoice.status
        row.invoice_number = invoice.invoice_number
        row.description = invoice.description
        row.line_items = invoice.line_items
        row.invoice_metadata = invoice.invoice_metadata
        row.due_date = invoice.due_date
        row.paid_at = invoice.paid_at
        row.payment_gateway = invoice.payment_gateway
        row.gateway_invoice_id = invoice.gateway_invoice_id
        row.gateway_payment_intent_id = invoice.gateway_payment_intent_id
        row.updated_at = datetime.utcnow()
        self._session.commit()
        return invoice

class SqlAlchemyTransactionRepository(TransactionRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: "TransactionORM") -> Transaction:
        return Transaction(
            id=row.id,
            org_id=row.org_id,
            user_id=row.user_id,
            invoice_id=row.invoice_id,
            subscription_id=row.subscription_id,
            amount_cents=row.amount_cents,
            currency=row.currency,
            type=row.type,
            status=row.status,
            payment_gateway=row.payment_gateway,
            gateway_transaction_id=row.gateway_transaction_id,
            gateway_response=row.gateway_response or {},
            description=row.description,
            transaction_metadata=row.transaction_metadata or {},
            idempotency_key=row.idempotency_key,
            created_at=row.created_at,
            processed_at=row.processed_at,
        )

    def get(self, transaction_id: str) -> Optional[Transaction]:
        row = self._session.query(TransactionORM).filter_by(id=transaction_id).first()
        return self._to_domain(row) if row else None

    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Transaction]:
        query = self._session.query(TransactionORM).filter_by(org_id=org_id)
        if status:
            query = query.filter_by(status=status)
        rows = query.order_by(TransactionORM.created_at.desc()).all()
        return [self._to_domain(r) for r in rows]

    def list_all(self, status: Optional[str] = None, org_id: Optional[str] = None) -> list[Transaction]:
        query = self._session.query(TransactionORM)
        if status:
            query = query.filter_by(status=status)
        if org_id:
            query = query.filter_by(org_id=org_id)
        rows = query.order_by(TransactionORM.created_at.desc()).all()
        return [self._to_domain(r) for r in rows]

    def find_by_idempotency_key(self, key: str) -> Optional[Transaction]:
        row = self._session.query(TransactionORM).filter_by(idempotency_key=key).first()
        return self._to_domain(row) if row else None

    def find_by_invoice_and_type(self, invoice_id: str, type: str) -> Optional[Transaction]:
        row = self._session.query(TransactionORM).filter_by(
            invoice_id=invoice_id, type=type
        ).first()
        return self._to_domain(row) if row else None

    def save(self, transaction: Transaction) -> Transaction:
        row = self._session.query(TransactionORM).filter_by(id=transaction.id).first()
        if row is None:
            row = TransactionORM(id=transaction.id)
            self._session.add(row)
        row.org_id = _billing_org_id(self._session, "transactions", transaction.org_id)
        row.user_id = transaction.user_id
        row.invoice_id = transaction.invoice_id
        row.subscription_id = transaction.subscription_id
        row.amount_cents = transaction.amount_cents
        row.currency = transaction.currency
        row.type = transaction.type
        row.status = transaction.status
        row.payment_gateway = transaction.payment_gateway
        row.gateway_transaction_id = transaction.gateway_transaction_id
        row.gateway_response = transaction.gateway_response
        row.description = transaction.description
        row.transaction_metadata = transaction.transaction_metadata
        row.idempotency_key = transaction.idempotency_key
        row.processed_at = transaction.processed_at
        self._session.commit()
        return transaction

class SqlAlchemyStudentUsageRepository(StudentUsageRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_domain(row: "StudentUsageORM") -> StudentUsage:
        return StudentUsage(
            id=row.id,
            user_id=row.user_id,
            month=row.month,
            application_count=row.application_count,
            billed_count=row.billed_count,
            last_billed_at=row.last_billed_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def get(self, user_id: str, month: str) -> Optional[StudentUsage]:
        row = self._session.query(StudentUsageORM).filter_by(user_id=user_id, month=month).first()
        return self._to_domain(row) if row else None

    def get_or_create(self, user_id: str, month: str) -> StudentUsage:
        row = self._session.query(StudentUsageORM).filter_by(user_id=user_id, month=month).first()
        if row is None:
            row = StudentUsageORM(
                id=f"su_{uuid4().hex[:12]}",
                user_id=user_id,
                month=month,
                application_count=0,
            )
            self._session.add(row)
            self._session.flush()
        return self._to_domain(row)

    def save(self, usage: StudentUsage) -> StudentUsage:
        row = self._session.query(StudentUsageORM).filter_by(user_id=usage.user_id, month=usage.month).first()
        if row is None:
            row = StudentUsageORM(
                id=usage.id,
                user_id=usage.user_id,
                month=usage.month,
            )
            self._session.add(row)
        row.application_count = usage.application_count
        row.billed_count = usage.billed_count
        row.last_billed_at = usage.last_billed_at
        row.updated_at = datetime.utcnow()
        self._session.commit()
        return usage

class SqlAlchemySubscriptionRepository(SubscriptionRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    @staticmethod
    def _to_orm_datetime(value: Optional[str]) -> Optional[datetime]:
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            return value
        return datetime.fromisoformat(value)

    def _to_domain(self, row: SubscriptionORM) -> Subscription:
        def _iso(value: Optional[datetime]) -> Optional[str]:
            if value is None:
                return None
            if hasattr(value, "isoformat"):
                return value.isoformat()
            return str(value)

        return Subscription(
            org_id=row.org_id,
            plan=row.plan or "Free",
            billing=row.billing or "",
            seats=row.seats or 1,
            since=row.since or "",
            status=row.status or "active",
            current_period_start=_iso(row.current_period_start),
            current_period_end=_iso(row.current_period_end),
            cancel_at_period_end=bool(row.cancel_at_period_end),
            trial_end=_iso(row.trial_end),
            payment_gateway=row.payment_gateway,
            gateway_customer_id=row.gateway_customer_id,
            gateway_subscription_id=row.gateway_subscription_id,
        )

    def get(self, org_id: str) -> Subscription:
        row = self._session.query(SubscriptionORM).filter_by(org_id=org_id).first()
        if row is None:
            return Subscription(org_id=org_id)  # Free default
        return self._to_domain(row)

    def save(self, subscription: Subscription) -> Subscription:
        row = (
            self._session.query(SubscriptionORM).filter_by(org_id=subscription.org_id).first()
        )
        if row is None:
            row = SubscriptionORM(org_id=subscription.org_id)
            self._session.add(row)
        row.plan = subscription.plan
        row.billing = subscription.billing
        row.seats = subscription.seats
        row.since = subscription.since
        row.status = subscription.status
        row.current_period_start = self._to_orm_datetime(subscription.current_period_start)
        row.current_period_end = self._to_orm_datetime(subscription.current_period_end)
        row.cancel_at_period_end = subscription.cancel_at_period_end
        row.trial_end = self._to_orm_datetime(subscription.trial_end)
        row.payment_gateway = subscription.payment_gateway
        row.gateway_customer_id = subscription.gateway_customer_id
        row.gateway_subscription_id = subscription.gateway_subscription_id
        self._session.commit()
        return subscription

class SqlAlchemyPaymentMethodRepository(PaymentMethodRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def _to_dict(self, row: PaymentMethodORM) -> dict:
        return {
            "id": row.id,
            "org_id": row.org_id,
            "type": row.type,
            "details": row.details or {},
            "is_default": bool(row.is_default),
            "gateway_payment_method_id": row.gateway_payment_method_id,
            "created_at": row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at or ""),
        }

    def list(self, org_id: str) -> list[dict]:
        rows = (
            self._session.query(PaymentMethodORM)
            .filter_by(org_id=org_id)
            .order_by(PaymentMethodORM.is_default.desc(), PaymentMethodORM.created_at.desc())
            .all()
        )
        return [self._to_dict(r) for r in rows]

    def get(self, org_id: str, payment_method_id: str) -> Optional[dict]:
        row = (
            self._session.query(PaymentMethodORM)
            .filter_by(id=payment_method_id, org_id=org_id)
            .first()
        )
        return self._to_dict(row) if row else None

    def add(self, org_id: str, type: str, details: dict, gateway_payment_method_id: Optional[str] = None) -> dict:
        from uuid import uuid4
        pm_id = f"pm_{uuid4().hex[:12]}"
        existing = (
            self._session.query(PaymentMethodORM)
            .filter_by(org_id=org_id)
            .first()
        )
        row = PaymentMethodORM(
            id=pm_id,
            org_id=org_id,
            type=type,
            details=details or {},
            is_default=existing is None,
            gateway_payment_method_id=gateway_payment_method_id,
        )
        self._session.add(row)
        self._session.commit()
        return self._to_dict(row)

    def delete(self, org_id: str, payment_method_id: str) -> bool:
        row = (
            self._session.query(PaymentMethodORM)
            .filter_by(id=payment_method_id, org_id=org_id)
            .first()
        )
        if row is None:
            return False
        self._session.delete(row)
        self._session.commit()
        return True

    def set_default(self, org_id: str, payment_method_id: str) -> bool:
        row = (
            self._session.query(PaymentMethodORM)
            .filter_by(id=payment_method_id, org_id=org_id)
            .first()
        )
        if row is None:
            return False
        self._session.query(PaymentMethodORM).filter_by(org_id=org_id).update({PaymentMethodORM.is_default: False})
        row.is_default = True
        self._session.commit()
        return True
