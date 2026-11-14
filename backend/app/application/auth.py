"""Auth use cases — register, authenticate, resolve the current user.

Depends only on the ``UserRepository`` port plus the pure ``security`` helpers,
so it runs identically against Postgres and the SQLite test harness and is fully
offline-testable.
"""
from uuid import uuid4
from datetime import date

from app.application.ports import UserRepository, OrganisationRepository
from app.core.errors import EmailAlreadyExists, InvalidCredentials, UserNotFound
from app.core.security import hash_password, verify_password
from app.domain.entities import USER_ROLES, User, Organisation


class AuthService:
    def __init__(self, users: UserRepository, organisations: OrganisationRepository = None) -> None:
        self._users = users
        self._organisations = organisations

    def register(
        self, *, email: str, name: str, role: str, password: str,
        org_name: str = "", org_type: str = "", org_sector: str = "",
        org_loc: str = "", org_about: str = ""
    ) -> User:
        email = email.strip().lower()
        role = role.strip()
        if role not in USER_ROLES or role == "admin":
            raise ValueError(f"Unknown role: {role!r}")
        if not email or "@" not in email:
            raise ValueError("A valid email is required")
        if not password:
            raise ValueError("A password is required")
        if self._users.get_by_email(email) is not None:
            raise EmailAlreadyExists(email)

        # For employers, org_name is required
        if role == "employer" and not org_name.strip():
            raise ValueError("Organisation name is required for employer registration")

        user = User(
            id=uuid4().hex,
            email=email,
            name=name.strip() or email.split("@")[0],
            role=role,
            password_hash=hash_password(password),
            created_at=date.today().isoformat(),
        )
        user = self._users.add(user)

        # For employers, create organisation and link user
        if role == "employer" and self._organisations:
            org = Organisation(
                id=uuid4().hex,
                name=org_name.strip(),
                type=org_type.strip() if org_type.strip() else "Company",
                sector=org_sector.strip() if org_sector.strip() else "",
                loc=org_loc.strip() if org_loc.strip() else "",
                about=org_about.strip() if org_about.strip() else "",
                owner_id=user.id,
                created_at=date.today().isoformat(),
            )
            org = self._organisations.add(org)
            # Link user to organisation
            user = self._users.update(user.id, org_id=org.id)

        return user

    def login(self, *, email: str, password: str) -> User:
        user = self._users.get_by_email(email.strip().lower())
        # Same error for unknown email and wrong password: don't leak existence.
        if user is None or not verify_password(password, user.password_hash):
            raise InvalidCredentials()
        return user

    def get(self, user_id: str) -> User:
        user = self._users.get_by_id(user_id)
        if user is None:
            raise UserNotFound(user_id)
        return user
