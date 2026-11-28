"""Identity & Access bounded context: users, roles, admin audit."""
from dataclasses import dataclass, field
from typing import Optional


# Account roles. Mirrors the four dashboards the product exposes.
USER_ROLES = ("student", "jobseeker", "employer", "admin", "lecturer", "university", "alumni")


@dataclass(frozen=True)
class User:
    """An authenticated account. ``password_hash`` never leaves the domain —
    the presentation layer exposes a safe view without it. ``org_id`` links
    employer accounts to the organisation they act on (R1d: user-state
    endpoints derive the org from the token instead of a request parameter)."""

    id: str
    email: str
    name: str
    role: str
    password_hash: str
    created_at: str = ""
    org_id: Optional[str] = None
    # Account recovery: a deleted account cannot log in until the admin
    # restores it (PATCH /users/{id}/action, action=restore).
    deleted: bool = False
    deleted_at: Optional[str] = None
    # Graduation support: a student can keep their account by providing a
    # personal email; on graduation the login email becomes the personal one
    # and the role moves to "jobseeker" (alumni).
    personal_email: Optional[str] = None
    graduated: bool = False
    graduated_at: Optional[str] = None


@dataclass(frozen=True)
class AdminActionLog:
    """Record of admin actions for audit trail."""

    id: str
    admin_id: str
    admin_email: str
    action: str  # suspend, activate, change_role, delete, etc.
    reason: str
    target_user_id: Optional[str] = None
    target_user_email: Optional[str] = None
    details: Optional[str] = None
    created_at: str = ""
