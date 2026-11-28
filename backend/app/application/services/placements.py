"""Placements context: catalogue, matching, applications, profiles, documents."""
from __future__ import annotations
from contextlib import nullcontext
import re

from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4


from app.application.event_bus import EventBus, default_event_bus
from app.domain.commands import PlacementUpdate
from app.domain.events import (
    ApplicationSubmitted,
    InvoicePaid,
    PlacementPublished,
    SubscriptionActivated,
)
from app.application.ports import (
    ApplicationRepository,
    LearningResourceRepository,
    PlacementRepository,
    SavedRepository,
    StudentProfileRepository,
    ResumeRepository,
    StudentDocumentRepository,
    SubscriptionRepository,
    InvoiceRepository,
    TransactionRepository,
    StudentUsageRepository,
    PaymentMethodRepository,
)
from app.core.errors import (
    ApplicationDeadlinePassed,
    ApplicationLimitExceeded,
    LearningResourceNotFound,
    NoSlotsAvailable,
    NotEligible,
    PlacementNotFound,
    PlacementNotOpen,
)
from app.domain.entities import (
    Application, LearningResource, Placement, Resume, StudentDocument,
    StudentProfile, Subscription, Invoice, Transaction, StudentUsage
)
from app.domain.matching import (
    GRADE_RANK,
    REQUIRED_SKILLS,
    SKILLS,
    SKILL_NAMES,
    MatchingPolicy,
    RankedPlacement,
    SkillSuggestion,
    match_placement,
    suggest_skills_for_course,
)

class PlacementService:
    """Use cases for browsing the placements catalogue.

    Depends only on the ``PlacementRepository`` port, so the same service runs
    against Postgres in production and SQLite in tests.
    """

    def __init__(self, repo: PlacementRepository) -> None:
        self._repo = repo

    def list_placements(
        self,
        *,
        q: Optional[str] = None,
        org_type: Optional[str] = None,
        location: Optional[str] = None,
        mode: Optional[str] = None,
        opportunity_type: Optional[str] = None,
    ) -> list[Placement]:
        return self._repo.list(
            q=q, org_type=org_type, location=location, mode=mode, opportunity_type=opportunity_type
        )

    def get_placement(self, placement_id: str) -> Optional[Placement]:
        return self._repo.get(placement_id)

    def update_placement(
        self, placement_id: str, changes: PlacementUpdate
    ) -> Optional[Placement]:
        """Update mutable fields on a placement (requirements, courses, grade, ...)."""
        return self._repo.update(placement_id, changes)

    def catalog_meta(self) -> dict:
        """Catalogue metadata the UI needs to render filters and explain matches.

        Courses/types/locations are derived from the placements actually stored
        in the database — they can never drift from the catalog. The grade
        thresholds, skill taxonomy and per-placement requirements come from the
        matching domain, which is their single source of truth; the frontend
        keeps no private copies of these tables.
        """
        placements = self._repo.list()
        courses = sorted({c for p in placements for c in p.courses})
        org_types = sorted({p.org.type for p in placements if p.org and p.org.type})
        locations = sorted({p.loc for p in placements if p.loc})
        return {
            "courses": courses,
            "org_types": org_types,
            "locations": locations,
            "grade_rules": dict(GRADE_RANK),
            "required_skills": dict(REQUIRED_SKILLS),
            "skills": [
                {"name": s.name, "category": s.category, "keywords": list(s.keywords)}
                for s in SKILLS
            ],
        }

class MatchingService:
    """Use case: rank placements against a student's skill profile.

    Pulls the candidate pool through the same ``PlacementRepository`` port and
    delegates the actual scoring to the pure domain matcher. Keeping the repo
    behind the port means this use case is testable offline and DB-agnostic.
    """

    def __init__(
        self, repo: PlacementRepository, policy: MatchingPolicy | None = None
    ) -> None:
        self._repo = repo
        self._policy = policy

    def rank(
        self,
        *,
        student_skills: list[str],
        student_course: str,
        student_cgpa: float,
        student_confidence: Optional[dict[str, int]] = None,
        q: Optional[str] = None,
        org_type: Optional[str] = None,
        location: Optional[str] = None,
        mode: Optional[str] = None,
        opportunity_type: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> list[RankedPlacement]:
        candidates = self._repo.list(
            q=q, org_type=org_type, location=location, mode=mode, opportunity_type=opportunity_type
        )
        ranked = [
            RankedPlacement(
                placement=p,
                match=match_placement(
                    p,
                    student_skills,
                    student_course,
                    student_cgpa,
                    student_confidence,
                    policy=self._policy,
                ),
            )
            for p in candidates
        ]
        ranked.sort(key=lambda r: (-r.match.score, r.placement.id))
        return ranked[:limit] if limit else ranked

    def suggest_skills(
        self, *, student_course: str, student_skills: list[str]
    ) -> list[SkillSuggestion]:
        return suggest_skills_for_course(
            self._repo.list(), student_course, set(student_skills)
        )

class SavedService:
    """Use cases for a user's bookmarked placements."""

    def __init__(self, repo: SavedRepository) -> None:
        self._repo = repo

    def list(self, user_id: str) -> list[str]:
        return self._repo.list(user_id)

    def is_saved(self, user_id: str, placement_id: str) -> bool:
        return self._repo.is_saved(user_id, placement_id)

    def toggle(self, user_id: str, placement_id: str) -> "tuple[bool, list[str]]":
        now_saved = self._repo.toggle(user_id, placement_id)
        return now_saved, self._repo.list(user_id)

def _parse_deadline(v):
    for fmt in ("%Y-%m-%d", "%d %b %Y"):
        try:
            return datetime.strptime(v, fmt).date()
        except (ValueError, TypeError):
            pass
    return None  # unparsable -> skip the check

class ApplicationService:
    """Use cases for applying to placements.

    Holds the two real business rules: you can only apply to an existing, open
    placement, and applying twice for the same placement is idempotent.
    """

    def __init__(
        self,
        placements: PlacementRepository,
        apps: ApplicationRepository,
        billing: BillingService = None,
        student_profiles: StudentProfileRepository = None,
        student_documents: StudentDocumentRepository = None,
        *,
        events: EventBus | None = None,
    ) -> None:
        self._placements = placements
        self._apps = apps
        self._billing = billing
        self._student_profiles = student_profiles
        self._student_documents = student_documents
        self._events = events or default_event_bus

    def apply(
        self,
        *,
        user_id: str,
        placement_id: str,
        statement: str = "",
        cover_letter: str = "",
        cv_url: str | None = None,
        github_url: str | None = None,
        linkedin_url: str | None = None,
        portfolio_url: str | None = None,
        academic_papers: list | None = None,
        reference_1_name: str = "",
        reference_1_email: str = "",
        reference_1_phone: str = "",
        reference_1_relationship: str = "",
        reference_2_name: str = "",
        reference_2_email: str = "",
        reference_2_phone: str = "",
        reference_2_relationship: str = "",
        document_ids: list | None = None,
    ) -> Application:
        placement = self._placements.get(placement_id)
        if placement is None:
            raise PlacementNotFound(placement_id)
        if placement.status == "Closed" or placement.review_status != "approved":
            raise PlacementNotOpen(placement_id)

        # Check deadline (unparsable dates are skipped, not hard-failed)
        deadline = _parse_deadline(placement.deadline) if placement.deadline else None
        if deadline is not None and deadline < date.today():
            raise ApplicationDeadlinePassed()

        # Slots is the number of hires, so count only accepted applications.
        if placement.slots and placement.slots > 0:
            accepted = len(
                [a for a in self._apps.list_for_placement(placement_id) if a.status == "Accepted"]
            )
            if accepted >= placement.slots:
                raise NoSlotsAvailable()

        existing = self._apps.find(user_id, placement_id)
        if existing is not None:
            if existing.status == "Withdrawn":
                # A withdrawn application can be replaced: reactivate the row.
                existing = self._apps.reactivate(user_id, existing.id)
            return existing  # idempotent: no duplicate applications

        # Eligibility: course, CGPA (grade rank) and required documents.
        self._check_eligibility(user_id, placement)

        # Check student application limit (billing gate)
        if self._billing:
            limit_check = self._billing.check_student_application_limit(user_id)
            if not limit_check["allowed"]:
                raise ApplicationLimitExceeded(
                    current=limit_check["current"],
                    limit=limit_check["limit"],
                    unpaid_invoice=limit_check.get("unpaid_invoice"),
                    reason=limit_check["reason"],
                )

        now = date.today().isoformat()
        application = Application(
            id=uuid4().hex,
            user_id=user_id,
            placement_id=placement_id,
            status="Submitted",
            statement=statement,
            cover_letter=cover_letter,
            cv_url=cv_url,
            github_url=github_url,
            linkedin_url=linkedin_url,
            portfolio_url=portfolio_url,
            academic_papers=academic_papers or [],
            reference_1_name=reference_1_name,
            reference_1_email=reference_1_email,
            reference_1_phone=reference_1_phone,
            reference_1_relationship=reference_1_relationship,
            reference_2_name=reference_2_name,
            reference_2_email=reference_2_email,
            reference_2_phone=reference_2_phone,
            reference_2_relationship=reference_2_relationship,
            document_ids=document_ids or [],
            shortlisted=False,
            created_at=now,
            updated_at=now,
        )
        application = self._apps.add(application)

        # Record for student billing (tracks free tier / overage)
        if self._billing:
            self._billing.record_student_application(user_id)

        self._events.publish(
            ApplicationSubmitted(
                application_id=application.id,
                user_id=user_id,
                placement_id=placement_id,
            )
        )

        return application

    def _check_eligibility(self, user_id: str, placement: Placement) -> None:
        reasons: list[str] = []
        profile = self._student_profiles.get(user_id) if self._student_profiles else None
        course = profile.course if profile else ""
        cgpa = profile.cgpa if profile else 0.0

        if placement.courses and course and course not in placement.courses:
            reasons.append(f"course '{course}' not accepted for this placement")
        if placement.grade and profile and profile.cgpa is not None:
            threshold = GRADE_RANK.get(placement.grade)
            if threshold is not None and cgpa < threshold:
                reasons.append(f"CGPA {cgpa} below required {placement.grade} ({threshold})")
        if placement.docs and self._student_documents:
            allowed = {
                t.lower().replace(" ", "_") for t in StudentDocumentService.ALLOWED_TYPES
            }
            required = {d.lower().replace(" ", "_") for d in placement.docs} & allowed
            uploaded = {d.document_type for d in self._student_documents.list_for_user(user_id)}
            missing = required - uploaded
            if missing:
                reasons.append(f"missing required documents: {', '.join(sorted(missing))}")
        if reasons:
            raise NotEligible(placement.id, "; ".join(reasons))

    def list_for_user(self, user_id: str) -> list[Application]:
        return self._apps.list_for_user(user_id)

    def list_for_placement(self, placement_id: str) -> list[Application]:
        return self._apps.list_for_placement(placement_id)

    def withdraw(self, *, user_id: str, application_id: str) -> Optional[Application]:
        application = self._apps.find_by_id(application_id)
        if application is None or application.user_id != user_id:
            return None
        if application.status in ("Accepted", "Rejected", "Withdrawn"):
            return application
        return self._apps.withdraw(user_id, application_id)

class StudentProfileService:
    """Use cases for a student's persisted academic profile."""

    def __init__(self, repo: StudentProfileRepository) -> None:
        self._repo = repo

    def get(self, user_id: str) -> StudentProfile:
        return self._repo.get(user_id)

    def save(
        self,
        *,
        user_id: str,
        course: str,
        year: str,
        cgpa: float,
        university: str,
        skills: list[str],
        talent_search_opt_in: bool = False,
        skills_confidence: Optional[dict[str, int]] = None,
        skills_source: Optional[dict[str, str]] = None,
    ) -> StudentProfile:
        clean_skills = list(
            dict.fromkeys(skill.strip() for skill in skills if skill.strip())
        )
        owned = set(clean_skills)
        confidence = {
            name: int(level)
            for name, level in (skills_confidence or {}).items()
            if name in owned and level in (1, 2, 3)
        }
        source = {
            name: value
            for name, value in (skills_source or {}).items()
            if name in owned and value
        }
        return self._repo.save(
            StudentProfile(
                user_id=user_id,
                course=course.strip(),
                year=year.strip(),
                cgpa=max(0.0, cgpa),
                university=university.strip(),
                skills=clean_skills,
                talent_search_opt_in=talent_search_opt_in,
                skills_confidence=confidence,
                skills_source=source,
            )
        )

class ResumeService:
    def __init__(self, repo: ResumeRepository) -> None:
        self._repo = repo

    def get(self, user_id: str) -> Optional[Resume]:
        return self._repo.get(user_id)

    def save(
        self,
        *,
        user_id: str,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> Resume:
        return self._repo.save(
            Resume(
                user_id=user_id,
                filename=filename,
                content_type=content_type,
                size_bytes=len(content),
                content=content,
                uploaded_at=datetime.now(timezone.utc).isoformat(),
            )
        )

class StudentDocumentService:
    ALLOWED_TYPES = {
        "transcript",
        "student_id",
        "national_id",
        "recommendation",
        "portfolio",
        "testimonial",
    }

    def __init__(self, repo: StudentDocumentRepository) -> None:
        self._repo = repo

    def list(self, user_id: str) -> list[StudentDocument]:
        return self._repo.list_for_user(user_id)

    def get_by_id(self, document_id: str) -> StudentDocument | None:
        return self._repo.get_by_id(document_id)

    def list_all(self, status: str | None = None) -> list[StudentDocument]:
        return self._repo.list_all(status=status)

    def verify_document(
        self,
        *,
        document_id: str,
        status: str,
        rejection_reason: str = "",
    ) -> StudentDocument | None:
        """Admin action: verify or reject a student document."""
        if status not in ("verified", "rejected"):
            raise ValueError("Status must be 'verified' or 'rejected'")
        if status == "rejected" and not rejection_reason.strip():
            raise ValueError("Rejection reason is required")
        document = self._repo.get_by_id(document_id)
        if document is None:
            return None
        document = StudentDocument(
            id=document.id,
            user_id=document.user_id,
            document_type=document.document_type,
            filename=document.filename,
            content_type=document.content_type,
            size_bytes=document.size_bytes,
            content=document.content,
            status=status,
            rejection_reason=rejection_reason.strip() if status == "rejected" else "",
            uploaded_at=document.uploaded_at,
            is_public=document.is_public,
            author_role=document.author_role,
            author_id=document.author_id,
        )
        return self._repo.save(document)

    def save(
        self,
        *,
        user_id: str,
        document_type: str,
        filename: str,
        content_type: str,
        content: bytes,
        author_role: str = "student",
    ) -> StudentDocument:
        if document_type not in self.ALLOWED_TYPES:
            raise ValueError("Unsupported document type")
        existing = next(
            (
                d
                for d in self._repo.list_for_user(user_id)
                if d.document_type == document_type
            ),
            None,
        )
        # Determine author_id based on role
        author_id = user_id
        if author_role in ("employer", "employee"):
            # For employer/employee, author_id could be org_id or user_id
            # We'll use user_id for now, can be enhanced later
            author_id = user_id
        document = StudentDocument(
            id=existing.id if existing else uuid4().hex,
            user_id=user_id,
            document_type=document_type,
            filename=filename,
            content_type=content_type,
            size_bytes=len(content),
            content=content,
            status="pending",
            uploaded_at=datetime.now(timezone.utc).isoformat(),
            is_public=document_type == "testimonial",  # Testimonials are public by default
            author_role=author_role,
            author_id=author_id,
        )
        return self._repo.save(document)

    def set_document_public(self, document_id: str, is_public: bool) -> StudentDocument | None:
        """Set the is_public flag on a document (admin only)."""
        document = self._repo.get_by_id(document_id)
        if document is None:
            return None
        document = StudentDocument(
            id=document.id,
            user_id=document.user_id,
            document_type=document.document_type,
            filename=document.filename,
            content_type=document.content_type,
            size_bytes=document.size_bytes,
            content=document.content,
            status=document.status,
            rejection_reason=document.rejection_reason,
            uploaded_at=document.uploaded_at,
            is_public=is_public,
            author_role=document.author_role,
            author_id=document.author_id,
        )
        return self._repo.save(document)

    def list_public_testimonials(self, limit: int = 10) -> list[StudentDocument]:
        """Get verified public testimonials for the home page carousel."""
        all_docs = self._repo.list_all(status="verified")
        public_testimonials = [d for d in all_docs if d.document_type == "testimonial" and d.is_public]
        return public_testimonials[:limit]

    def list_public_testimonials_by_role(self, role: str, limit: int = 10) -> list[StudentDocument]:
        """Get verified public testimonials filtered by author role."""
        all_docs = self._repo.list_all(status="verified")
        public_testimonials = [d for d in all_docs if d.document_type == "testimonial" and d.is_public and d.author_role == role]
        return public_testimonials[:limit]


# =============================================================================
# CONTACT INFO SERVICE
# =============================================================================
