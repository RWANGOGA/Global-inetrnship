"""FastAPI dependency wiring.

This is where the abstraction (port) is bound to a concrete adapter. Tests can
override ``get_session`` to point the same wiring at SQLite; production binds
it to Postgres — no use case changes.
"""
from collections import defaultdict
from time import time
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.ai.enrichment_service import GroqEnrichmentService
from app.application.advisor import AdvisorService
from app.application.auth import AuthService
from app.application.ports import LLMClient, VoiceClient, TranslationClient
from app.application.services import (
    ApplicationService,
    BillingService,
    LearningResourceService,
    LearningService,
    MatchingService,
    PlacementService,
    SavedService,
    StudentProfileService,
    ResumeService,
    StudentDocumentService,
)
from app.core.errors import AuthenticationError, UserNotFound, VoiceNotConfigured, TranslationNotConfigured
from app.core.security import decode_access_token
from app.domain.entities import User
from app.infrastructure.db import get_session, SessionLocal
from app.infrastructure.groq import GroqClient
from app.infrastructure.deepl import DeepLClient
from app.infrastructure.translation import DeepLTranslationClient
from app.infrastructure.payment_gateways.factory import get_gateway_factory
from app.infrastructure.repositories import (
    SqlAlchemyAdminActionLogRepository,
    SqlAlchemyApplicationRepository,
    SqlAlchemyJobApplicationRepository,
    SqlAlchemyLearningResourceRepository,
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
    SqlAlchemyChatGroupRepository,
    SqlAlchemyGroupParticipantRepository,
    SqlAlchemyChatMessageRepository,
    SqlAlchemyDirectChatRepository,
    SqlAlchemyUserChatSettingsRepository,
    SqlAlchemyOrganisationRepository,
)


# ---- Rate limiting -----------------------------------------------------------

class RateLimiter:
    """Simple in-memory rate limiter (per IP)."""
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: defaultdict[str, list[float]] = defaultdict(list)

    def check(self, ip: str) -> bool:
        now = time()
        window_start = now - 60
        # Clean old entries
        self.requests[ip] = [t for t in self.requests[ip] if t > window_start]
        if len(self.requests[ip]) >= self.requests_per_minute:
            return False
        self.requests[ip].append(now)
        return True


rate_limiter = RateLimiter(requests_per_minute=60)


async def rate_limit(request: Request) -> None:
    """FastAPI dependency to enforce rate limiting."""
    ip = request.client.host if request.client else "unknown"
    if not rate_limiter.check(ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")


def get_placement_service(session: Session = Depends(get_session)) -> PlacementService:
    return PlacementService(SqlAlchemyPlacementRepository(session))


def get_matching_service(session: Session = Depends(get_session)) -> MatchingService:
    return MatchingService(SqlAlchemyPlacementRepository(session))


def get_llm_client() -> LLMClient:
    """Production binds Groq; tests override this to a deterministic fake."""
    return GroqClient()


def get_voice_client() -> VoiceClient:
    """Production binds DeepL; tests override this to a deterministic fake."""
    return DeepLClient()


def get_translation_client() -> TranslationClient:
    """Production binds DeepL; tests override this to a deterministic fake."""
    return DeepLTranslationClient()


def get_enrichment_service() -> GroqEnrichmentService:
    """Production binds GroqEnrichmentService; tests override this to a deterministic fake."""
    return GroqEnrichmentService()


def get_advisor_service(
    session: Session = Depends(get_session),
    llm: LLMClient = Depends(get_llm_client),
) -> AdvisorService:
    return AdvisorService(MatchingService(SqlAlchemyPlacementRepository(session)), llm)


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


def get_application_service(
    session: Session = Depends(get_session),
    billing: BillingService = Depends(get_billing_service),
) -> ApplicationService:
    return ApplicationService(
        SqlAlchemyPlacementRepository(session),
        SqlAlchemyApplicationRepository(session),
        billing,
    )


def get_saved_service(session: Session = Depends(get_session)) -> SavedService:
    return SavedService(SqlAlchemySavedRepository(session))


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


def get_learning_resource_service(
    session: Session = Depends(get_session),
) -> LearningResourceService:
    return LearningResourceService(
        SqlAlchemyLearningResourceRepository(session),
        SqlAlchemyPlacementRepository(session),
    )


# ---- Chat / Messaging ---------------------------------------------------------

def get_chat_group_repository(session: Session = Depends(get_session)):
    return SqlAlchemyChatGroupRepository(session)


def get_group_participant_repository(session: Session = Depends(get_session)):
    return SqlAlchemyGroupParticipantRepository(session)


def get_chat_message_repository(session: Session = Depends(get_session)):
    return SqlAlchemyChatMessageRepository(session)


def get_direct_chat_repository(session: Session = Depends(get_session)):
    return SqlAlchemyDirectChatRepository(session)


def get_user_chat_settings_repository(session: Session = Depends(get_session)):
    return SqlAlchemyUserChatSettingsRepository(session)


# ---- Job Applications --------------------------------------------------------

def get_job_application_repository(
    session: Session = Depends(get_session),
):
    return SqlAlchemyJobApplicationRepository(session)


def get_saved_jobs_repository(
    session: Session = Depends(get_session),
):
    return SqlAlchemySavedJobsRepository(session)


def get_admin_action_log_repository(
    session: Session = Depends(get_session),
):
    return SqlAlchemyAdminActionLogRepository(session)


# ---- Auth ------------------------------------------------------------------

bearer_scheme = HTTPBearer(auto_error=False)


def get_learning_service(session: Session = Depends(get_session)) -> LearningService:
    return LearningService(session)


def get_auth_service(session: Session = Depends(get_session)) -> AuthService:
    return AuthService(
        SqlAlchemyUserRepository(session),
        SqlAlchemyOrganisationRepository(session),
    )


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


def require_roles(*allowed_roles: str):
    """FastAPI dependency that enforces role-based access control.
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
