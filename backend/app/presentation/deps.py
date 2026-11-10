"""FastAPI dependency wiring.

This is where the abstraction (port) is bound to a concrete adapter. Tests can
override ``get_session`` to point the same wiring at SQLite; production binds
it to Postgres — no use case changes.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.application.advisor import AdvisorService
from app.application.auth import AuthService
from app.application.ports import LLMClient
from app.application.services import (
    ApplicationService,
    BillingService,
    MatchingService,
    PlacementService,
    SavedService,
    StudentProfileService,
    ResumeService,
    StudentDocumentService,
)
from app.core.errors import AuthenticationError, UserNotFound
from app.core.security import decode_access_token
from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.groq import GroqClient
from app.infrastructure.payment_gateways.factory import get_gateway_factory
from app.infrastructure.repositories import (
    SqlAlchemyApplicationRepository,
    SqlAlchemyJobApplicationRepository,
    SqlAlchemyPlacementRepository,
    SqlAlchemySavedJobsRepository,
    SqlAlchemySavedRepository,
    SqlAlchemyStudentProfileRepository,
    SqlAlchemyResumeRepository,
    SqlAlchemyStudentDocumentRepository,
    SqlAlchemySubscriptionRepository,
    SqlAlchemyInvoiceRepository,
    SqlAlchemyTransactionRepository,
    SqlAlchemyStudentUsageRepository,
    SqlAlchemyUserRepository,
)


def get_placement_service(session: Session = Depends(get_session)) -> PlacementService:
    return PlacementService(SqlAlchemyPlacementRepository(session))


def get_matching_service(session: Session = Depends(get_session)) -> MatchingService:
    return MatchingService(SqlAlchemyPlacementRepository(session))


def get_llm_client() -> LLMClient:
    """Production binds Groq; tests override this to a deterministic fake."""
    return GroqClient()


def get_advisor_service(
    session: Session = Depends(get_session),
    llm: LLMClient = Depends(get_llm_client),
) -> AdvisorService:
    return AdvisorService(MatchingService(SqlAlchemyPlacementRepository(session)), llm)


def get_saved_service(session: Session = Depends(get_session)) -> SavedService:
    return SavedService(SqlAlchemySavedRepository(session))


def get_application_service(
    session: Session = Depends(get_session),
) -> ApplicationService:
    return ApplicationService(
        SqlAlchemyPlacementRepository(session), SqlAlchemyApplicationRepository(session)
    )


def get_billing_service(session: Session = Depends(get_session)) -> BillingService:
    gateway_factory = get_gateway_factory()
    return BillingService(
        session=session,
        subscription_repo=SqlAlchemySubscriptionRepository(session),
        invoice_repo=SqlAlchemyInvoiceRepository(session),
        transaction_repo=SqlAlchemyTransactionRepository(session),
        gateway_factory=gateway_factory,
        student_usage_repo=SqlAlchemyStudentUsageRepository(session),
    )


def get_student_profile_service(
    session: Session = Depends(get_session),
) -> StudentProfileService:
    return StudentProfileService(SqlAlchemyStudentProfileRepository(session))


def get_resume_service(session: Session = Depends(get_session)) -> ResumeService:
    return ResumeService(SqlAlchemyResumeRepository(session))


def get_student_document_service(
    session: Session = Depends(get_session),
) -> StudentDocumentService:
    return StudentDocumentService(SqlAlchemyStudentDocumentRepository(session))


# ---- Job Applications --------------------------------------------------------

def get_job_application_repository(
    session: Session = Depends(get_session),
):
    return SqlAlchemyJobApplicationRepository(session)


def get_saved_jobs_repository(
    session: Session = Depends(get_session),
):
    return SqlAlchemySavedJobsRepository(session)


# ---- Auth ------------------------------------------------------------------

bearer_scheme = HTTPBearer(auto_error=False)


def get_auth_service(session: Session = Depends(get_session)) -> AuthService:
    return AuthService(SqlAlchemyUserRepository(session))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    service: AuthService = Depends(get_auth_service),
) -> User:
    """Resolve the caller from a valid Bearer token, or raise 401 if not authenticated."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception as exc:  # jwt.InvalidTokenError and friends
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        return service.get(payload["sub"])
    except UserNotFound as exc:
        raise HTTPException(status_code=401, detail="Account no longer exists") from exc
