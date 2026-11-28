"""Learning context: resources, progress, contact information."""
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
    RankedPlacement,
    SkillSuggestion,
    match_placement,
    suggest_skills_for_course,
)

class LearningResourceService:
    """Admin-curated resources that help students close skill gaps."""

    LEVELS = {"Beginner", "Intermediate", "Advanced"}

    def __init__(
        self,
        repo: LearningResourceRepository,
        placements: PlacementRepository,
    ) -> None:
        self._repo = repo
        self._placements = placements

    def list(
        self,
        *,
        skill: Optional[str] = None,
        placement_id: Optional[str] = None,
    ) -> list[LearningResource]:
        return self._repo.list(skill=skill, placement_id=placement_id)

    def create(
        self,
        *,
        title: str,
        url: str,
        provider: str = "",
        description: str = "",
        skill: str = "",
        placement_id: str = "",
        level: str = "",
        resource_type: str = "Course",
        duration: str = "",
    ) -> LearningResource:
        fields = self._validate(
            title=title,
            url=url,
            provider=provider,
            description=description,
            skill=skill,
            placement_id=placement_id,
            level=level,
            resource_type=resource_type,
            duration=duration,
        )
        return self._repo.add(
            LearningResource(
                id=uuid4().hex,
                created_at=datetime.now(timezone.utc).isoformat(),
                **fields,
            )
        )

    def update(
        self,
        resource_id: str,
        *,
        title: str,
        url: str,
        provider: str = "",
        description: str = "",
        skill: str = "",
        placement_id: str = "",
        level: str = "",
        resource_type: str = "Course",
        duration: str = "",
    ) -> LearningResource:
        existing = self._repo.get(resource_id)
        if existing is None:
            raise LearningResourceNotFound(resource_id)
        fields = self._validate(
            title=title,
            url=url,
            provider=provider,
            description=description,
            skill=skill,
            placement_id=placement_id,
            level=level,
            resource_type=resource_type,
            duration=duration,
        )
        return self._repo.update(
            LearningResource(
                id=existing.id,
                created_at=existing.created_at,
                **fields,
            )
        )

    def delete(self, resource_id: str) -> None:
        if not self._repo.delete(resource_id):
            raise LearningResourceNotFound(resource_id)

    def _validate(
        self,
        *,
        title: str,
        url: str,
        provider: str,
        description: str,
        skill: str,
        placement_id: str,
        level: str,
        resource_type: str,
        duration: str,
    ) -> dict:
        title = title.strip()
        url = url.strip()
        skill = skill.strip()
        placement_id = placement_id.strip()
        level = level.strip()
        if not title:
            raise ValueError("Title is required")
        if not url.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if skill and skill not in SKILL_NAMES:
            raise ValueError("Choose a skill from the skills taxonomy")
        if placement_id and self._placements.get(placement_id) is None:
            raise ValueError("Placement not found")
        if level and level not in self.LEVELS:
            raise ValueError("Level must be Beginner, Intermediate or Advanced")
        return {
            "title": title,
            "url": url,
            "provider": provider.strip(),
            "description": description.strip(),
            "skill": skill,
            "placement_id": placement_id,
            "level": level,
            "resource_type": (resource_type.strip() or "Course"),
            "duration": duration.strip(),
        }

class ContactInfoService:
    """Service for managing contact information (email, WhatsApp)."""
    
    def __init__(self):
        # In production, this would come from a config table or environment variables
        self.email = "akandwanahojonan256@gmail.com"
        self.whatsapp = "+256756348528"
    
    def get_contact_info(self) -> dict:
        return {
            "email": self.email,
            "whatsapp": self.whatsapp,
        }


# =============================================================================
# LEARNING SERVICE
# =============================================================================

class LearningService:
    """Service for tracking student learning progress, courses, badges, and achievements."""
    
    def __init__(self, session):
        self.session = session
    
    def get_student_learning_profile(self, user_id: str) -> dict:
        """Get the student's complete learning profile."""
        # In production, this would query the database
        # For now, return mock data
        return {
            "user_id": user_id,
            "completed_courses": [
                {
                    "course_id": "python-101",
                    "course_name": "Python Fundamentals",
                    "completed_modules": 8,
                    "total_modules": 8,
                    "progress_percentage": 100.0,
                    "last_accessed": "2026-10-15T10:30:00Z",
                    "badge_earned": "python-fundamentals"
                },
                {
                    "course_id": "web-dev-101",
                    "course_name": "Web Development Basics",
                    "completed_modules": 6,
                    "total_modules": 10,
                    "progress_percentage": 60.0,
                    "last_accessed": "2026-11-01T14:20:00Z",
                    "badge_earned": None
                }
            ],
            "in_progress_courses": [
                {
                    "course_id": "react-101",
                    "course_name": "React Fundamentals",
                    "completed_modules": 3,
                    "total_modules": 8,
                    "progress_percentage": 37.5,
                    "last_accessed": "2026-11-10T09:15:00Z",
                    "badge_earned": None
                }
            ],
            "achievements": [
                {
                    "id": "python-fundamentals",
                    "name": "Python Fundamentals",
                    "description": "Completed all modules in Python Fundamentals course",
                    "earned_at": "2026-10-15T10:30:00Z",
                    "badge_icon": "🐍"
                }
],
            "badges": [
                {
                    "id": "python-fundamentals",
                    "name": "Python Fundamentals",
                    "icon": "🐍",
                    "earned": True,
                    "earned_at": "2026-10-15T10:30:00Z"
                },
                {
                    "id": "web-dev-101",
                    "name": "Web Development Basics",
                    "icon": "🌐",
                    "earned": False
                },
                {
                    "id": "react-101",
                    "name": "React Fundamentals",
                    "icon": "⚛️",
                    "earned": False
                }
            ],
            "skills_confidence": {"Figma": 3, "UI Design": 2},
            "skills_source": {"Figma": "project", "UI Design": "course"},
        }
    
    def mark_module_complete(self, user_id: str, course_id: str, module_id: str) -> dict:
        """Mark a module as complete and check for badge earning."""
        # In production, this would update the database
        # For now, return mock response
        
        # Check if course is complete
        badge_earned = None
        if course_id == "python-101" and module_id == "module-8":
            badge_earned = "python-fundamentals"
        elif course_id == "web-dev-101" and module_id == "module-10":
            badge_earned = "web-dev-101"
        elif course_id == "react-101" and module_id == "module-8":
            badge_earned = "react-101"
        
        return {
            "success": True,
            "badge_earned": badge_earned
        }
