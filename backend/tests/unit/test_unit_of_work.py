"""Unit of Work behaviour: one session, one transaction boundary.

These tests use the real SQLAlchemy adapters against the seeded in-memory
SQLite database, so they exercise the same wiring used in production.
"""
from app.domain.entities import Organisation, User
from app.infrastructure.repositories.identity import (
    SqlAlchemyOrganisationRepository,
    SqlAlchemyUserRepository,
)
from app.infrastructure.unit_of_work import SqlAlchemyUnitOfWork


def _org(org_id: str) -> Organisation:
    return Organisation(
        id=org_id,
        name="Unit of Work Ltd",
        type="Company",
        sector="Technology",
        loc="Kampala",
        seal="UW",
        created_at="",
    )


def _user(user_id: str) -> User:
    return User(
        id=user_id,
        email=f"{user_id}@example.com",
        name="UoW Tester",
        role="student",
        password_hash="hashed",
    )


def test_uow_repositories_share_one_session(session_factory):
    session = session_factory()
    uow = SqlAlchemyUnitOfWork(session=session)
    try:
        uow.organisations.add(_org("uow-org"))
        uow.users.add(_user("uow-user"))

        # Both writes are visible through the same unit of work before commit.
        assert uow.organisations.get("uow-org") is not None
        assert uow.users.get_by_id("uow-user") is not None
    finally:
        uow.rollback()
        uow.close()
        session.close()


def test_uow_commit_persists_every_aggregate(session_factory):
    session = session_factory()
    uow = SqlAlchemyUnitOfWork(session=session)
    try:
        uow.organisations.add(_org("uow-org-2"))
        uow.users.add(_user("uow-user-2"))
        uow.commit()
    finally:
        uow.close()
        session.close()

    fresh = session_factory()
    try:
        assert SqlAlchemyOrganisationRepository(fresh).get("uow-org-2") is not None
        assert SqlAlchemyUserRepository(fresh).get_by_id("uow-user-2") is not None
    finally:
        fresh.close()


def test_uow_rollback_discards_every_aggregate(session_factory):
    session = session_factory()
    uow = SqlAlchemyUnitOfWork(session=session)
    try:
        uow.organisations.add(_org("uow-org-3"))
        uow.users.add(_user("uow-user-3"))
        uow.rollback()

        assert uow.organisations.get("uow-org-3") is None
        assert uow.users.get_by_id("uow-user-3") is None
    finally:
        uow.close()
        session.close()


def test_uow_context_manager_rolls_back_on_error(session_factory):
    session = session_factory()
    try:
        with SqlAlchemyUnitOfWork(session=session) as uow:
            uow.organisations.add(_org("uow-org-4"))
            assert uow.organisations.get("uow-org-4") is not None
            raise RuntimeError("business rule failed")
    except RuntimeError:
        pass

    fresh = session_factory()
    try:
        assert SqlAlchemyOrganisationRepository(fresh).get("uow-org-4") is None
    finally:
        fresh.close()
        session.close()
