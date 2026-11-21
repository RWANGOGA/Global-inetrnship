"""Auth endpoints — register, login, and the current-user lookup.

Register and login return a signed Bearer token plus the safe user view; the
password/hash never cross the boundary. ``/auth/me`` proves the token works and
is the anchor the frontend uses to restore a session on load.
"""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from app.application.auth import AuthService
from app.application.chat import ChatService
from app.core.errors import EmailAlreadyExists, InvalidCredentials
from app.core.security import create_access_token
from app.domain.entities import User
from app.presentation.deps import get_auth_service, get_chat_service, get_current_user, get_session
from app.presentation.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserRead,
)
from app.infrastructure.orm import UserORM

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id, user.role),
        user=UserRead.model_validate(user),
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
    chat_service: ChatService = Depends(get_chat_service),
) -> AuthResponse:
    try:
        user = service.register(
            email=payload.email,
            name=payload.name,
            role=payload.role,
            password=payload.password,
            org_name=payload.org_name,
            org_type=payload.org_type,
            org_sector=payload.org_sector,
            org_loc=payload.org_loc,
            org_about=payload.org_about,
        )
    except EmailAlreadyExists:
        raise HTTPException(status_code=409, detail="Email already registered")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # New accounts join the channels that match their role automatically; admins
    # join every channel. Membership failures must not block registration.
    try:
        chat_service.auto_join_for_user(user.id, user.role)
    except Exception:
        pass

    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest = Body(...), service: AuthService = Depends(get_auth_service)
) -> AuthResponse:
    try:
        user = service.login(email=payload.username, password=payload.password)
    except InvalidCredentials:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return _auth_response(user)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


from pydantic import BaseModel as _BaseModel

class GraduateRequest(_BaseModel):
    personal_email: str


@router.post("/graduate", response_model=AuthResponse)
def graduate(
    payload: GraduateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Convert a student account on graduation.

    The student provides a personal email; the login email becomes the personal
    one (so the university mailbox can be retired) and the role moves to
    "jobseeker" (alumni). The original student email is retained as a note.
    """
    from datetime import date

    pe = payload.personal_email.strip().lower()
    if "@" not in pe:
        raise HTTPException(status_code=422, detail="A valid personal email is required")

    row = session.query(UserORM).filter_by(id=current_user.id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if row.role not in ("student", "jobseeker"):
        raise HTTPException(status_code=400, detail="Only students can graduate")

    # Ensure the personal email is not already in use
    existing = session.query(UserORM).filter_by(email=pe).first()
    if existing is not None and existing.id != row.id:
        raise HTTPException(status_code=409, detail="That email is already in use")

    row.personal_email = pe
    row.graduated = True
    row.graduated_at = date.today().isoformat()
    row.email = pe
    if row.role == "student":
        row.role = "jobseeker"
    session.commit()

    user = User(
        id=row.id,
        email=row.email,
        name=row.name,
        role=row.role,
        password_hash=row.password_hash,
        created_at=row.created_at or "",
        org_id=row.org_id or None,
        deleted=bool(row.deleted),
        deleted_at=row.deleted_at or None,
        personal_email=row.personal_email or None,
        graduated=bool(row.graduated),
        graduated_at=row.graduated_at or None,
    )
    return _auth_response(user)
