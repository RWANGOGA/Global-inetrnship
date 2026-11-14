"""Auth endpoints — register, login, and the current-user lookup.

Register and login return a signed Bearer token plus the safe user view; the
password/hash never cross the boundary. ``/auth/me`` proves the token works and
is the anchor the frontend uses to restore a session on load.
"""
from fastapi import APIRouter, Body, Depends, HTTPException

from app.application.auth import AuthService
from app.core.errors import EmailAlreadyExists, InvalidCredentials
from app.core.security import create_access_token
from app.domain.entities import User
from app.presentation.deps import get_auth_service, get_current_user
from app.presentation.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id, user.role),
        user=UserRead.model_validate(user),
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: RegisterRequest, service: AuthService = Depends(get_auth_service)
) -> AuthResponse:
    try:
        user = service.register(
            email=payload.email,
            name=payload.name,
            role=payload.role,
            password=payload.password,
        )
    except EmailAlreadyExists:
        raise HTTPException(status_code=409, detail="Email already registered")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
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
