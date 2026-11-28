"""Composition root: a thin top-level app that keeps system endpoints and
mounts the feature sub-application. Feature routers live in
``app.presentation.sub`` so this file never bloats with domain routes.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings, validate_runtime_config
from app.infrastructure.db import Base, SessionLocal, engine, ensure_schema
from app.infrastructure.orm import (  # noqa: F401 (register tables)
    OrganisationORM,
    PlacementORM,
    JobORM,
    LearningResourceORM,
    StudentProfileORM,
    ApplicationPackORM,
    StudentDocumentORM,
    ResumeORM,
    StudentDocumentORM,
    UserORM,
)
from app.infrastructure.seed import seed_if_empty
from app.presentation.sub import create_sub_app


def _init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    with SessionLocal() as session:
        seed_if_empty(session)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db()
    yield


def create_app(sub_prefix: str = "/api", sub: FastAPI | None = None) -> FastAPI:
    """Build the top-level app.

    ``sub_prefix`` is where the feature app is mounted: ``/api`` in production,
    ``/`` in tests so existing routes keep their paths without the prefix.
    ``sub`` may be injected (tests) — mounted sub-apps keep their own
    ``dependency_overrides``, so we expose it on ``app.state.sub_app``.
    """
    settings = get_settings()
    validate_runtime_config(settings)
    app = FastAPI(
        title=f"{settings.app_name} (gateway)",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["system"])
    def health() -> dict:
        return {
            "status": "ok",
            "service": settings.app_name,
            "environment": settings.environment,
        }

    sub = sub or create_sub_app()
    app.state.sub_app = sub

    # Versioned surface first: ``/api/v1/...`` wins over the legacy ``/api``
    # mount, while existing clients keep working unchanged.
    if sub_prefix not in ("", "/"):
        app.mount(f"{sub_prefix}/v1", sub)
    app.mount(sub_prefix, sub)

    @app.middleware("http")
    async def _api_version_header(request, call_next):
        response = await call_next(request)
        if sub_prefix not in ("", "/") and request.url.path.startswith(f"{sub_prefix}/v1"):
            response.headers["X-API-Version"] = "v1"
        return response

    return app


app = create_app()
