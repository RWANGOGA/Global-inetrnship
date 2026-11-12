"""Composition root: a thin top-level app that keeps system endpoints and
mounts the feature sub-application. Feature routers live in
``app.presentation.sub`` so this file never bloats with domain routes.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
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
    app = FastAPI(
        title=f"{settings.app_name} (gateway)",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
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
    app.mount(sub_prefix, sub)
    return app


app = create_app()
