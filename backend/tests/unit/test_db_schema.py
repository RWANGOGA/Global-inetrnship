"""Tests for the additive schema migration in db.py (ensure_schema).

Simulates a long-lived database whose schema predates newer ORM columns and
verifies ensure_schema() adds the missing ones so no ORM column is missing.
"""
import pytest
from sqlalchemy import inspect, text

from app.infrastructure.db import Base, engine, ensure_schema
from app.infrastructure.orm import OrganisationORM


@pytest.fixture
def nov5_schema():
    """Install a Nov-5-era organisations table (without is_active) on the
    shared app engine, then tear it down so create_app() can rebuild it cleanly
    for the tests that follow."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    with engine.begin() as conn:
        if "organisations" in tables:
            conn.execute(text("DROP TABLE organisations"))
        if "users" in tables:
            conn.execute(text("DROP TABLE users"))
        conn.execute(text("CREATE TABLE users (id VARCHAR PRIMARY KEY, email VARCHAR NOT NULL, role VARCHAR NOT NULL)"))
        conn.execute(
            text(
                "CREATE TABLE organisations ("
                "id VARCHAR PRIMARY KEY, "
                "name VARCHAR NOT NULL, "
                "type VARCHAR NOT NULL, "
                "sector VARCHAR DEFAULT '', "
                "loc VARCHAR DEFAULT '', "
                "seal VARCHAR DEFAULT '', "
                "about TEXT DEFAULT '', "
                "owner_id VARCHAR, "
                "created_at VARCHAR DEFAULT '', "
                "billing_email VARCHAR, "
                "tax_id VARCHAR, "
                "billing_address JSON DEFAULT '{}')"
            )
        )
    yield
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS organisations"))
        conn.execute(text("DROP TABLE IF EXISTS users"))


def _column_names(table: str) -> set[str]:
    inspector = inspect(engine)
    return {c["name"] for c in inspector.get_columns(table)}


def test_ensure_schema_adds_missing_organisation_columns(nov5_schema):
    """Organisations created before is_active was tracked should get it patched
    in, and no ORM column should be missing afterwards."""
    before = _column_names("organisations")
    assert "is_active" not in before

    ensure_schema()

    after = _column_names("organisations")
    assert "is_active" in after

    # Every ORM-mapped column on OrganisationORM must be present in the DB.
    orm_columns = {column.name for column in OrganisationORM.__table__.columns}
    missing = orm_columns - after
    assert not missing, f"Missing ORM columns on organisations: {sorted(missing)}"

    # Base.metadata.create_all (as create_app() runs) must not complain about
    # the now-present is_active column.
    Base.metadata.create_all(bind=engine)
