"""Transfer all data from the old database to the new Neon database.

Usage:
  cd backend
  python transfer_db.py

Reads DATABASE_URL_OLD and DATABASE_URL_NEW from environment variables,
or falls back to the two Neon URLs embedded in .env.local.
"""
import json
import os
import sys

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

# Import all ORM models so Base.metadata knows about every table
from app.infrastructure.orm import Base  # noqa: F401

# Old (source) Neon database — the one that hit its network transfer limit
DATABASE_URL_OLD = os.getenv(
    "DATABASE_URL_OLD",
    "postgresql+psycopg://neondb_owner:npg_IDevf3xuQ7qn@ep-nameless-sky-bdhq9x8k.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)

# New (destination) Neon database — fresh project on Neon
DATABASE_URL_NEW = os.getenv(
    "DATABASE_URL_NEW",
    "postgresql+psycopg://neondb_owner:npg_ZGFLt6oD1yVH@ep-green-glitter-bestymml.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)

# Tables in dependency order: parents first, children after.
# Foreign keys: organisations <- placements, jobs, subscriptions, invoices, transactions, organization_members, chat_groups
# users <- saved_placements, saved_jobs, applications, job_applications, student_profiles, application_packs, resumes, student_documents, student_usage, organization_members, admin_action_logs, chat_groups, group_participants, chat_messages, direct_chats, user_chat_settings
# subscriptions <- invoices, transactions
# placements <- saved_placements, applications, chat_groups
# jobs <- saved_jobs, job_applications
# invoices <- transactions
# chat_groups <- group_participants, chat_messages
TABLES = [
    "organisations",
    "users",
    "payment_gateways",
    "subscriptions",
    "jobs",
    "placements",
    "learning_resources",
    "invoices",
    "saved_placements",
    "saved_jobs",
    "applications",
    "job_applications",
    "student_profiles",
    "application_packs",
    "resumes",
    "student_documents",
    "student_usage",
    "organization_members",
    "admin_action_logs",
    "chat_groups",
    "group_participants",
    "chat_messages",
    "direct_chats",
    "user_chat_settings",
]


def get_column_info(engine, table):
    """Return (col_names, json_cols, notnull_cols, col_defaults) for a table."""
    inspector = inspect(engine)
    cols = inspector.get_columns(table)
    col_names = [c["name"] for c in cols]
    json_cols = []
    notnull_cols = set()
    col_defaults = {}
    for c in cols:
        cname = c["name"]
        col_type_str = str(c["type"]).upper()
        if "JSON" in col_type_str:
            json_cols.append(cname)
        if not c.get("nullable", True):
            notnull_cols.add(cname)
        # Capture the default value expression
        if c.get("default") is not None:
            col_defaults[cname] = c["default"]
    return col_names, json_cols, notnull_cols, col_defaults


def _default_for_col(col_name, col_type_str, col_defaults):
    """Return a type-appropriate default for a NOT NULL column."""
    ctype = col_type_str.upper()
    if "JSON" in ctype:
        return "{}" if col_name in ("config", "billing_address", "gateway_response", "transaction_metadata", "invoice_metadata", "skills_confidence", "skills_source", "translations", "document_ids") else "[]"
    if "VARCHAR" in ctype or "STRING" in ctype or "TEXT" in ctype:
        return ""
    if "INT" in ctype:
        return 0
    if "BOOL" in ctype:
        return False
    if "DECIMAL" in ctype or "NUMERIC" in ctype:
        return 0
    if "TIMESTAMP" in ctype or "DATETIME" in ctype:
        return None  # keep NULL, will be handled by DB default if any
    return None


def _prepare_row(row, col_names, json_cols, notnull_cols, col_types, col_defaults):
    """Serialize JSON, replace None with defaults for NOT NULL columns."""
    d = dict(row)
    for cname in col_names:
        v = d.get(cname)
        # Serialize JSON columns
        if cname in json_cols and v is not None and not isinstance(v, str):
            d[cname] = json.dumps(v)
        # Replace None with default for NOT NULL columns
        if v is None and cname in notnull_cols:
            ctype = col_types.get(cname, "")
            default = _default_for_col(cname, ctype, col_defaults)
            d[cname] = default
    return d


def transfer_table(src_engine, dst_engine, table):
    """Copy all rows from one table in src to dst (insert or ignore on conflict)."""
    src_col_names, _, _, _ = get_column_info(src_engine, table)
    dst_col_names, dst_json_cols, dst_notnull_cols, dst_col_defaults = get_column_info(dst_engine, table)
    dst_col_types = {}
    inspector = inspect(dst_engine)
    for c in inspector.get_columns(table):
        dst_col_types[c["name"]] = str(c["type"])

    # Only transfer columns that exist in both source and dest
    common_cols = [c for c in src_col_names if c in dst_col_names]
    col_list = ", ".join(common_cols)
    placeholders = ", ".join([f":{c}" for c in common_cols])

    rows = []
    with src_engine.connect() as conn:
        result = conn.execute(text(f"SELECT {col_list} FROM {table}")).mappings().all()
        rows = [_prepare_row(r, common_cols, dst_json_cols, dst_notnull_cols, dst_col_types, dst_col_defaults) for r in result]

    if not rows:
        print(f"  {table}: 0 rows (skipped)")
        return 0

    # Use INSERT ... ON CONFLICT DO NOTHING for idempotency
    with dst_engine.begin() as conn:
        conn.execute(
            text(
                f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
                f"ON CONFLICT DO NOTHING"
            ),
            rows,
        )
    print(f"  {table}: {len(rows)} rows transferred")
    return len(rows)


def main():
    print("=" * 60)
    print("Database Transfer: Old Neon -> New Neon")
    print("=" * 60)
    print(f"Source:  {DATABASE_URL_OLD.split('@')[1][:60]}...")
    print(f"Dest:    {DATABASE_URL_NEW.split('@')[1][:60]}...")
    print()

    # Create engines
    src_engine = create_engine(DATABASE_URL_OLD, pool_pre_ping=True)
    dst_engine = create_engine(DATABASE_URL_NEW, pool_pre_ping=True)

    # Verify connectivity
    try:
        with src_engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            print(f"Source DB connected: OK (SELECT 1 = {result})")
    except Exception as e:
        print(f"Source DB connection FAILED: {e}")
        sys.exit(1)

    try:
        with dst_engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            print(f"Dest DB connected: OK (SELECT 1 = {result})")
    except Exception as e:
        print(f"Dest DB connection FAILED: {e}")
        sys.exit(1)

    print()

    # Create schema on destination (fresh Neon DB has no tables)
    print("Creating schema on destination database...")
    Base.metadata.create_all(dst_engine)
    dst_inspector = inspect(dst_engine)
    dst_tables = set(dst_inspector.get_table_names())
    print(f"  Created {len(dst_tables)} tables on destination")
    print()

    # Check source tables exist
    src_inspector = inspect(src_engine)
    src_tables = set(src_inspector.get_table_names())
    print(f"Source tables found: {sorted(src_tables)}")
    print()

    total = 0

    try:
        for table in TABLES:
            if table not in src_tables:
                print(f"  {table}: not in source (skipped)")
                continue
            count = transfer_table(src_engine, dst_engine, table)
            total += count
    finally:
        pass

    print()
    print("=" * 60)
    print(f"Transfer complete. {total} total rows transferred.")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Wire DATABASE_URL on Render to the new Neon URL")
    print("  2. Redeploy the backend on Render")
    print("  3. Verify the API works with the new database")


if __name__ == "__main__":
    main()
