"""SQLAlchemy repository adapters, grouped by bounded context.

Kept import-compatible with the former single-module layout:
``from app.infrastructure.repositories import SqlAlchemyPlacementRepository``.
"""
from app.infrastructure.repositories.placements import (
    SqlAlchemyPlacementRepository,
    SqlAlchemyJobRepository,
    SqlAlchemySavedRepository,
    SqlAlchemySavedJobsRepository,
    SqlAlchemyApplicationRepository,
    SqlAlchemyJobApplicationRepository,
    SqlAlchemyStudentProfileRepository,
    SqlAlchemyResumeRepository,
    SqlAlchemyStudentDocumentRepository,
    SqlAlchemyLearningResourceRepository,
)
from app.infrastructure.repositories.billing import (
    _billing_org_id,
    SqlAlchemyInvoiceRepository,
    SqlAlchemyTransactionRepository,
    SqlAlchemyStudentUsageRepository,
    SqlAlchemySubscriptionRepository,
    SqlAlchemyPaymentMethodRepository,
)
from app.infrastructure.repositories.identity import (
    SqlAlchemyUserRepository,
    SqlAlchemyAdminActionLogRepository,
    SqlAlchemyOrganisationRepository,
)
from app.infrastructure.repositories.chat import (
    SqlAlchemyChatGroupRepository,
    SqlAlchemyGroupParticipantRepository,
    SqlAlchemyChatMessageRepository,
    SqlAlchemyDirectChatRepository,
    SqlAlchemyUserChatSettingsRepository,
)

__all__ = [
    "SqlAlchemyPlacementRepository",
    "SqlAlchemyJobRepository",
    "SqlAlchemySavedRepository",
    "SqlAlchemySavedJobsRepository",
    "SqlAlchemyApplicationRepository",
    "SqlAlchemyJobApplicationRepository",
    "SqlAlchemyStudentProfileRepository",
    "SqlAlchemyResumeRepository",
    "SqlAlchemyStudentDocumentRepository",
    "SqlAlchemyLearningResourceRepository",
    "_billing_org_id",
    "SqlAlchemyInvoiceRepository",
    "SqlAlchemyTransactionRepository",
    "SqlAlchemyStudentUsageRepository",
    "SqlAlchemySubscriptionRepository",
    "SqlAlchemyPaymentMethodRepository",
    "SqlAlchemyUserRepository",
    "SqlAlchemyAdminActionLogRepository",
    "SqlAlchemyOrganisationRepository",
    "SqlAlchemyChatGroupRepository",
    "SqlAlchemyGroupParticipantRepository",
    "SqlAlchemyChatMessageRepository",
    "SqlAlchemyDirectChatRepository",
    "SqlAlchemyUserChatSettingsRepository",
]
