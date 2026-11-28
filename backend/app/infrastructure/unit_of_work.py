"""SQLAlchemy Unit of Work.

Owns a single session and lazily builds every repository against it with
``autocommit=False``, so one ``commit`` at the end of a use case persists all
writes together and a failure rolls the whole business operation back.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.application.ports import (
    ApplicationRepository,
    InvoiceRepository,
    JobApplicationRepository,
    JobRepository,
    OrganisationRepository,
    PaymentMethodRepository,
    PlacementRepository,
    StudentUsageRepository,
    SubscriptionRepository,
    TransactionRepository,
    UserRepository,
)
from app.application.unit_of_work import UnitOfWork
from app.infrastructure.db import SessionLocal
from app.infrastructure.repositories.billing import (
    SqlAlchemyInvoiceRepository,
    SqlAlchemyPaymentMethodRepository,
    SqlAlchemyStudentUsageRepository,
    SqlAlchemySubscriptionRepository,
    SqlAlchemyTransactionRepository,
)
from app.infrastructure.repositories.identity import (
    SqlAlchemyOrganisationRepository,
    SqlAlchemyUserRepository,
)
from app.infrastructure.repositories.placements import (
    SqlAlchemyApplicationRepository,
    SqlAlchemyJobApplicationRepository,
    SqlAlchemyJobRepository,
    SqlAlchemyPlacementRepository,
)


class SqlAlchemyUnitOfWork(UnitOfWork):
    """A request-scoped business transaction."""

    def __init__(
        self,
        session: Optional[Session] = None,
        *,
        session_factory=None,
    ) -> None:
        self._owns_session = session is None
        self._session = session or (session_factory or SessionLocal)()
        self._repos: dict[str, object] = {}

    # -- repositories ---------------------------------------------------
    def _repo(self, key: str, factory):
        existing = self._repos.get(key)
        if existing is None:
            existing = factory(self._session, autocommit=False)
            self._repos[key] = existing
        return existing

    @property
    def users(self) -> UserRepository:
        return self._repo("users", SqlAlchemyUserRepository)

    @property
    def organisations(self) -> OrganisationRepository:
        return self._repo("organisations", SqlAlchemyOrganisationRepository)

    @property
    def placements(self) -> PlacementRepository:
        return self._repo("placements", SqlAlchemyPlacementRepository)

    @property
    def jobs(self) -> JobRepository:
        return self._repo("jobs", SqlAlchemyJobRepository)

    @property
    def applications(self) -> ApplicationRepository:
        return self._repo("applications", SqlAlchemyApplicationRepository)

    @property
    def job_applications(self) -> JobApplicationRepository:
        return self._repo("job_applications", SqlAlchemyJobApplicationRepository)

    @property
    def invoices(self) -> InvoiceRepository:
        return self._repo("invoices", SqlAlchemyInvoiceRepository)

    @property
    def transactions(self) -> TransactionRepository:
        return self._repo("transactions", SqlAlchemyTransactionRepository)

    @property
    def subscriptions(self) -> SubscriptionRepository:
        return self._repo("subscriptions", SqlAlchemySubscriptionRepository)

    @property
    def student_usage(self) -> StudentUsageRepository:
        return self._repo("student_usage", SqlAlchemyStudentUsageRepository)

    @property
    def payment_methods(self) -> PaymentMethodRepository:
        return self._repo("payment_methods", SqlAlchemyPaymentMethodRepository)

    # -- transaction boundary -------------------------------------------
    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()

    def close(self) -> None:
        if self._owns_session:
            self._session.close()

    @property
    def session(self) -> Session:
        """Escape hatch for services that still take a session directly."""
        return self._session
