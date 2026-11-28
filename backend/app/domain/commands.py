"""Explicit update commands for repositories.

Primitive ``**fields`` dictionaries let any caller write any column. These
command objects declare exactly which aggregate attributes may change, give
the values types, and make "leave unchanged" (``None``) explicit (SOLID: ISP).
"""
from dataclasses import dataclass, fields
from typing import Any, Optional


class UpdateCommand:
    """Base helper: only non-``None`` values are applied."""

    def changed_fields(self) -> dict[str, Any]:
        return {
            f.name: getattr(self, f.name)
            for f in fields(self)
            if getattr(self, f.name) is not None
        }

    @classmethod
    def from_dict(cls, values: dict[str, Any]):
        allowed = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in values.items() if k in allowed})


@dataclass(frozen=True)
class PlacementUpdate(UpdateCommand):
    title: Optional[str] = None
    courses: Optional[list[str]] = None
    grade: Optional[str] = None
    loc: Optional[str] = None
    mode: Optional[str] = None
    duration: Optional[str] = None
    stipend: Optional[str] = None
    deadline: Optional[str] = None
    slots: Optional[int] = None
    status: Optional[str] = None
    applicants: Optional[int] = None
    docs: Optional[list[str]] = None
    testimonial: Optional[bool] = None
    about: Optional[str] = None
    duties: Optional[list[str]] = None
    requirements: Optional[list[str]] = None
    review_status: Optional[str] = None
    published_at: Optional[str] = None
    closes_at: Optional[str] = None
    starts_at: Optional[str] = None
    review_reason: Optional[str] = None
    opportunity_type: Optional[str] = None
    duration_hours: Optional[int] = None
    budget_range: Optional[str] = None
    milestones: Optional[list] = None
    remote_ok: Optional[bool] = None
    salary_range: Optional[str] = None
    probation_period: Optional[str] = None
    training_included: Optional[bool] = None
    career_path: Optional[str] = None
    skills_required: Optional[list] = None


@dataclass(frozen=True)
class JobUpdate(UpdateCommand):
    title: Optional[str] = None
    loc: Optional[str] = None
    mode: Optional[str] = None
    employment_type: Optional[str] = None
    salary: Optional[str] = None
    closes_at: Optional[str] = None
    summary: Optional[str] = None
    requirements: Optional[list[str]] = None
    status: Optional[str] = None
    review_status: Optional[str] = None
    published_at: Optional[str] = None
    review_reason: Optional[str] = None


@dataclass(frozen=True)
class UserUpdate(UpdateCommand):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password_hash: Optional[str] = None
    org_id: Optional[str] = None
    deleted: Optional[bool] = None
    deleted_at: Optional[str] = None
    personal_email: Optional[str] = None
    graduated: Optional[bool] = None
    graduated_at: Optional[str] = None


@dataclass(frozen=True)
class ChatGroupUpdate(UpdateCommand):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    updated_at: Optional[str] = None
    placement_id: Optional[str] = None
    org_id: Optional[str] = None


@dataclass(frozen=True)
class GroupParticipantUpdate(UpdateCommand):
    role: Optional[str] = None
    last_read_at: Optional[str] = None
    is_muted: Optional[bool] = None
    notifications_enabled: Optional[bool] = None


@dataclass(frozen=True)
class ChatMessageUpdate(UpdateCommand):
    content: Optional[str] = None
    is_edited: Optional[bool] = None
    translations: Optional[dict[str, str]] = None
    deleted_at: Optional[str] = None


@dataclass(frozen=True)
class UserChatSettingsUpdate(UpdateCommand):
    preferred_language: Optional[str] = None
    auto_translate: Optional[bool] = None
    show_original: Optional[bool] = None
    notification_sound: Optional[bool] = None
    desktop_notifications: Optional[bool] = None
    theme: Optional[str] = None
    font_size: Optional[int] = None
