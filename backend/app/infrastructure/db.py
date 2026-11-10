"""Database engine and session.

One engine is built from settings at import time (connection creation is lazy,
so importing this module does not open a socket). SQLite in-memory uses a
StaticPool so the single connection — and its data — survives across sessions,
which is what lets the test harness reuse an in-memory database.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _build_engine(url: str):
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in url:
            kwargs["poolclass"] = StaticPool
        return create_engine(url, **kwargs)
    return create_engine(url, pool_pre_ping=True)


engine = _build_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session():
    """FastAPI dependency yielding a per-request session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def ensure_schema() -> None:
    """Idempotent, additive column migrations for already-created tables.

    ``Base.metadata.create_all`` only creates missing tables — it never alters
    an existing one, so a column added to the ORM after a database already
    exists (here: ``users.org_id`` for the R1d token-derived identity) would
    otherwise be absent and every users query would fail. We check the actual
    schema and add just the missing column. Fresh SQLite test databases get the
    column from create_all, so this is a no-op there; only long-lived Postgres
    (Neon) is patched.
    """
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("users")}
    statements = []
    if "org_id" not in existing:
        statements.append("ALTER TABLE users ADD COLUMN org_id VARCHAR")
    if "placements" in inspector.get_table_names():
        placement_columns = {
            c["name"] for c in inspector.get_columns("placements")
        }
        additions = {
            "review_status": "VARCHAR DEFAULT 'approved'",
            "published_at": "VARCHAR DEFAULT ''",
            "closes_at": "VARCHAR DEFAULT ''",
            "starts_at": "VARCHAR DEFAULT ''",
            "requirements": "JSON",
            "review_reason": "TEXT DEFAULT ''",
            "opportunity_type": "VARCHAR DEFAULT 'internship'",
            "duration_hours": "INTEGER",
            "budget_range": "VARCHAR",
            "milestones": "JSON",
            "remote_ok": "BOOLEAN",
            "salary_range": "VARCHAR",
            "probation_period": "VARCHAR",
            "training_included": "BOOLEAN",
            "career_path": "TEXT",
            "skills_required": "JSON",
        }
        statements.extend(
            f"ALTER TABLE placements ADD COLUMN {name} {definition}"
            for name, definition in additions.items()
            if name not in placement_columns
        )
    if "jobs" in inspector.get_table_names():
        job_columns = {c["name"] for c in inspector.get_columns("jobs")}
        job_additions = {
            "review_status": "VARCHAR DEFAULT 'approved'",
            "published_at": "VARCHAR DEFAULT ''",
            "review_reason": "TEXT DEFAULT ''",
        }
        statements.extend(
            f"ALTER TABLE jobs ADD COLUMN {name} {definition}"
            for name, definition in job_additions.items()
            if name not in job_columns
        )
    if "organisations" in inspector.get_table_names():
        org_columns = {c["name"] for c in inspector.get_columns("organisations")}
        org_additions = {
            "billing_email": "VARCHAR",
            "tax_id": "VARCHAR",
            "billing_address": "JSON DEFAULT '{}'",
        }
        statements.extend(
            f"ALTER TABLE organisations ADD COLUMN {name} {definition}"
            for name, definition in org_additions.items()
            if name not in org_columns
        )
    if "subscriptions" in inspector.get_table_names():
        sub_columns = {c["name"] for c in inspector.get_columns("subscriptions")}
        sub_additions = {
            "status": "VARCHAR DEFAULT 'active'",
            "current_period_start": "TIMESTAMP",
            "current_period_end": "TIMESTAMP",
            "cancel_at_period_end": "BOOLEAN DEFAULT FALSE",
            "trial_end": "TIMESTAMP",
            "payment_gateway": "VARCHAR",
            "gateway_customer_id": "VARCHAR",
            "gateway_subscription_id": "VARCHAR",
        }
        statements.extend(
            f"ALTER TABLE subscriptions ADD COLUMN {name} {definition}"
            for name, definition in sub_additions.items()
            if name not in sub_columns
        )
    if "student_documents" in inspector.get_table_names():
        doc_columns = {c["name"] for c in inspector.get_columns("student_documents")}
        if "is_public" not in doc_columns:
            statements.append("ALTER TABLE student_documents ADD COLUMN is_public BOOLEAN DEFAULT FALSE")
        if "author_role" not in doc_columns:
            statements.append("ALTER TABLE student_documents ADD COLUMN author_role VARCHAR DEFAULT 'student'")
        if "author_id" not in doc_columns:
            statements.append("ALTER TABLE student_documents ADD COLUMN author_id VARCHAR")
    # New tables - create if not exists (handled by create_all, but we check here for completeness)
    new_tables = ["invoices", "transactions", "student_usage", "payment_gateways"]
    for table in new_tables:
        if table not in inspector.get_table_names():
            # Table will be created by create_all
            pass
    
    if statements:
        with engine.begin() as conn:
            for statement in statements:
                conn.execute(text(statement))
