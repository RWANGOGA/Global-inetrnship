"""SQLAlchemy ORM models (the persistence schema).

These live only in infrastructure and never leak into the domain. List-valued
fields (courses, docs, duties) are stored as JSON so the schema stays portable
across Postgres and SQLite without association tables — keeping the project
minimal for now.
"""
from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, DateTime, DECIMAL, UniqueConstraint
from sqlalchemy import LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.infrastructure.db import Base


class OrganisationORM(Base):
    __tablename__ = "organisations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str] = mapped_column(String, default="")
    loc: Mapped[str] = mapped_column(String, default="")
    seal: Mapped[str] = mapped_column(String, default="")
    about: Mapped[str] = mapped_column(Text, default="")
    billing_email: Mapped[str | None] = mapped_column(String, nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String, nullable=True)
    billing_address: Mapped[dict] = mapped_column(JSON, default=dict)


class PlacementORM(Base):
    __tablename__ = "placements"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True)
    courses: Mapped[list] = mapped_column(JSON, default=list)
    grade: Mapped[str] = mapped_column(String, default="")
    loc: Mapped[str] = mapped_column(String, default="")
    mode: Mapped[str] = mapped_column(String, default="")
    duration: Mapped[str] = mapped_column(String, default="")
    stipend: Mapped[str] = mapped_column(String, default="")
    deadline: Mapped[str] = mapped_column(String, default="")
    slots: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="Open")
    applicants: Mapped[int] = mapped_column(Integer, default=0)
    docs: Mapped[list] = mapped_column(JSON, default=list)
    testimonial: Mapped[bool] = mapped_column(Boolean, default=False)
    about: Mapped[str] = mapped_column(Text, default="")
    duties: Mapped[list] = mapped_column(JSON, default=list)
    review_status: Mapped[str] = mapped_column(String, default="approved")
    published_at: Mapped[str] = mapped_column(String, default="")
    closes_at: Mapped[str] = mapped_column(String, default="")
    starts_at: Mapped[str] = mapped_column(String, default="")
    requirements: Mapped[list] = mapped_column(JSON, default=list)
    review_reason: Mapped[str] = mapped_column(Text, default="")


class JobORM(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True)
    loc: Mapped[str] = mapped_column(String, default="")
    mode: Mapped[str] = mapped_column(String, default="")
    employment_type: Mapped[str] = mapped_column(String, default="Full time")
    salary: Mapped[str] = mapped_column(String, default="")
    closes_at: Mapped[str] = mapped_column(String, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    requirements: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String, default="Open")
    review_status: Mapped[str] = mapped_column(String, default="approved")
    published_at: Mapped[str] = mapped_column(String, default="")
    review_reason: Mapped[str] = mapped_column(Text, default="")


class SavedORM(Base):
    __tablename__ = "saved_placements"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    placement_id: Mapped[str] = mapped_column(String, primary_key=True)


class ApplicationORM(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    placement_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String, default="Submitted")
    statement: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[str] = mapped_column(String, default="")


class StudentProfileORM(Base):
    __tablename__ = "student_profiles"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), primary_key=True
    )
    course: Mapped[str] = mapped_column(String, default="")
    year: Mapped[str] = mapped_column(String, default="")
    cgpa: Mapped[float] = mapped_column(default=0.0)
    university: Mapped[str] = mapped_column(String, default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)


class ApplicationPackORM(Base):
    __tablename__ = "application_packs"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    statement: Mapped[str] = mapped_column(Text, default="")
    targets: Mapped[list] = mapped_column(JSON, default=list)


class ResumeORM(Base):
    __tablename__ = "resumes"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    uploaded_at: Mapped[str] = mapped_column(String, default="")


class StudentDocumentORM(Base):
    __tablename__ = "student_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    document_type: Mapped[str] = mapped_column(String, index=True)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")
    rejection_reason: Mapped[str] = mapped_column(Text, default="")
    uploaded_at: Mapped[str] = mapped_column(String, default="")
    is_public: Mapped[bool] = mapped_column(default=False)


class SubscriptionORM(Base):
    __tablename__ = "subscriptions"

    org_id: Mapped[str] = mapped_column(String, primary_key=True)
    plan: Mapped[str] = mapped_column(String, default="Free")
    billing: Mapped[str] = mapped_column(String, default="")
    seats: Mapped[int] = mapped_column(Integer, default=1)
    since: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="active")  # active, past_due, cancelled, trialing
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    trial_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payment_gateway: Mapped[str | None] = mapped_column(String, nullable=True)
    gateway_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    gateway_subscription_id: Mapped[str | None] = mapped_column(String, nullable=True)


class InvoiceORM(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.org_id"), nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(String, default="draft")  # draft, open, paid, void, uncollectible
    invoice_number: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    line_items: Mapped[list] = mapped_column(JSON, default=list)
    invoice_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payment_gateway: Mapped[str | None] = mapped_column(String, nullable=True)
    gateway_invoice_id: Mapped[str | None] = mapped_column(String, nullable=True)
    gateway_payment_intent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TransactionORM(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.org_id"), nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    type: Mapped[str] = mapped_column(String, nullable=False)  # payment, refund, chargeback, credit, fee
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, succeeded, failed, cancelled
    payment_gateway: Mapped[str] = mapped_column(String, nullable=False)
    gateway_transaction_id: Mapped[str | None] = mapped_column(String, nullable=True)
    gateway_response: Mapped[dict] = mapped_column(JSON, default=dict)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    idempotency_key: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class StudentUsageORM(Base):
    __tablename__ = "student_usage"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM
    application_count: Mapped[int] = mapped_column(Integer, default=0)
    billed_count: Mapped[int] = mapped_column(Integer, default=0)
    last_billed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint('user_id', 'month', name='uq_student_usage_user_month'),)


class PaymentGatewayORM(Base):
    __tablename__ = "payment_gateways"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # stripe, paypal, flutterwave, mpesa, bank_transfer, crypto
    name: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    supported_currencies: Mapped[list] = mapped_column(JSON, default=list)
    supported_countries: Mapped[list] = mapped_column(JSON, default=list)
    fee_percentage: Mapped[float | None] = mapped_column(DECIMAL(5,4), nullable=True)
    fee_fixed_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    min_amount_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_amount_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserORM(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, default="")
    # Employer accounts act on their organisation; derived from the token in
    # the user-state endpoints. Nullable: students/jobseekers/admins have none.
    org_id: Mapped[str | None] = mapped_column(String, nullable=True)
