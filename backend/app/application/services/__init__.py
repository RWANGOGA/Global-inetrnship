"""Application services, grouped by bounded context.

Import-compatible facade over the former single-module layout:
``from app.application.services import BillingService`` still works.
"""
from app.application.services.placements import (
    PlacementService,
    MatchingService,
    SavedService,
    ApplicationService,
    StudentProfileService,
    ResumeService,
    StudentDocumentService,
)
from app.application.services.billing import (
    BillingService,
)
from app.application.services.learning import (
    LearningResourceService,
    ContactInfoService,
    LearningService,
)

__all__ = [
    "PlacementService",
    "MatchingService",
    "SavedService",
    "ApplicationService",
    "BillingService",
    "StudentProfileService",
    "LearningResourceService",
    "ResumeService",
    "StudentDocumentService",
    "ContactInfoService",
    "LearningService",
]
