"""Test harness.

Each test gets its own isolated, seeded in-memory SQLite database. We override
``get_session`` on the *mounted sub-app* (not the parent) because Starlette
resolves dependencies against the app that owns the route — a mounted sub-app
keeps its own ``dependency_overrides``. The engine is reached through the same
repository port the API uses, so tests exercise the identical code path as
Postgres in production.
"""
import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENVIRONMENT"] = "test"
# Force the advisor model to be unset so the default Groq adapter raises
# before any network call — tests either override the LLM port or expect a 503.
os.environ["GROQ_MODEL"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.infrastructure import orm  # noqa: F401 (register all ORM models)
from app.infrastructure.db import Base, get_session
from app.infrastructure.seed import seed_if_empty
from app.presentation.main import create_app
from app.infrastructure.orm import UserORM


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = factory()
    seed_if_empty(session)
    # Ensure employer user has org_id set (fixes integration test)
    employer = session.query(UserORM).filter_by(email="hiring@lumenlabs.example").first()
    if employer and not employer.org_id:
        employer.org_id = "o4"
        session.commit()
    session.close()
    try:
        yield factory
    finally:
        engine.dispose()


@pytest.fixture
def session(session_factory):
    s = session_factory()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def app(session_factory):
    a = create_app(sub_prefix="/")  # mount features at root so paths keep working

    def _override():
        s = session_factory()
        try:
            yield s
        finally:
            s.close()

    a.state.sub_app.dependency_overrides[get_session] = _override
    return a


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c
