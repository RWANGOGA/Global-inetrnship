"""Sub-application that owns the domain-feature routers.

`main.py` mounts this under ``/api``. Keeping it a separate FastAPI instance
means the user's instinct holds: `main.py` stays a tiny composition root (system
endpoints + mounting), while feature routes live in their own mounted app
instead of piling onto one growing file. It also boots standalone for local dev
with its own tables + seed.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.errors import AuthenticationError
from app.infrastructure.db import Base, SessionLocal, engine
from app.infrastructure.orm import (  # noqa: F401 (register tables)
    JobORM,
    LearningResourceORM,
    OrganisationORM,
    PlacementORM,
    StudentProfileORM,
    ApplicationPackORM,
    StudentDocumentORM,
    ResumeORM,
    StudentDocumentORM,
    UserORM,
)
from app.infrastructure.seed import seed_if_empty
from app.presentation.routers import (
    advisor,
    auth,
    admin,
    matching,
    jobs,
    learning,
    placements,
    organization,
    user_state,
    billing,
    webhooks,
    ai_enrichment,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Standalone dev convenience. When mounted, the parent app owns lifespan,
    # so this only runs if you serve this sub-app directly.
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_if_empty(session)
    yield


def create_sub_app() -> FastAPI:
    sub = FastAPI(
        title="BrighterWorks API — features", version="0.1.0", lifespan=lifespan
    )
    sub.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    # A dependency (get_current_user) raises AuthenticationError for missing /
    # invalid tokens; the routers below are thin, so map it once at the app
    # boundary to a proper 401 rather than leaking a 500.
    @sub.exception_handler(AuthenticationError)
    async def _authentication_error(_: Request, exc: AuthenticationError) -> JSONResponse:
        return JSONResponse(status_code=401, content={"detail": str(exc)})

    sub.include_router(auth.router)
    sub.include_router(admin.router)
    sub.include_router(placements.router)
    sub.include_router(organization.router)
    sub.include_router(matching.router)
    sub.include_router(jobs.router)
    sub.include_router(learning.router)
    sub.include_router(advisor.router)
    sub.include_router(user_state.router)
    sub.include_router(billing.router)
    sub.include_router(webhooks.router)
    sub.include_router(ai_enrichment.router)
    return sub


subapp = create_sub_app()
