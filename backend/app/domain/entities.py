"""Domain entities and value objects for the Placements bounded context."""
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class Organisation:
    """An employer / institution that hosts placements."""

    id: str
    name: str
    type: str  # Government | Company | NGO | University
    sector: str
    loc: str
    seal: str  # monogram shown in place of a logo
    about: str = ""
    billing_email: Optional[str] = None
    tax_id: Optional[str] = None
    billing_address: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Placement:
    """A single internship posting. ``org`` is a read-view reference resolved
    by the repository so clients can render the employer inline."""

    id: str
    title: str
    org_id: str
    courses: list[str] = field(default_factory=list)
    grade: str = ""
    loc: str = ""
    mode: str = ""  # On-site | Hybrid | Remote
    duration: str = ""
    stipend: str = ""
    deadline: str = ""
    slots: int = 0
    status: str = "Open"  # Open | Closing | Closed
    applicants: int = 0
    docs: list[str] = field(default_factory=list)
    testimonial: bool = False
    about: str = ""
    duties: list[str] = field(default_factory=list)
    review_status: str = "approved"
    published_at: str = ""
    closes_at: str = ""
    starts_at: str = ""
    requirements: list[str] = field(default_factory=list)
    review_reason: str = ""
    # Opportunity type: internship | gig | entry_level
    opportunity_type: str = "internship"
    # Gig-specific fields
    duration_hours: int | None = None
    budget_range: str | None = None
    milestones: list | None = None
    remote_ok: bool | None = None
    # Entry-level specific fields
    salary_range: str | None = None
    probation_period: str | None = None
    training_included: bool | None = None
    career_path: str | None = None
    # Skill requirements (for matching)
    skills_required: list | None = None
    org: Optional[Organisation] = None


@dataclass(frozen=True)
class Job:
    """A published job in the separate Jobs Portal domain."""

    id: str
    title: str
    org_id: str
    loc: str = ""
    mode: str = ""
    employment_type: str = "Full time"
    salary: str = ""
    closes_at: str = ""
    summary: str = ""
    requirements: list[str] = field(default_factory=list)
    status: str = "Open"
    review_status: str = "approved"
    published_at: str = ""
    review_reason: str = ""
    org: Optional[Organisation] = None


# Application workflow statuses (kept as plain strings to stay persistence-friendly).
APPLICATION_STATUSES = ("Submitted", "In Review", "Accepted", "Rejected", "Withdrawn")


@dataclass(frozen=True)
class StudentProfile:
    """Persisted academic profile used by internship matching."""

    user_id: str
    course: str = ""
    year: str = ""
    cgpa: float = 0.0
    university: str = ""
    skills: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Resume:
    user_id: str
    filename: str
    content_type: str
    size_bytes: int
    content: bytes
    uploaded_at: str


@dataclass(frozen=True)
class StudentDocument:
    id: str
    user_id: str
    document_type: str
    filename: str
    content_type: str
    size_bytes: int
    content: bytes
    status: str = "pending"
    rejection_reason: str = ""
    uploaded_at: str = ""
    is_public: bool = False
    author_role: str = "student"
    author_id: str = ""


@dataclass(frozen=True)
class Application:
    """A student's submission to a placement. One row per (user, placement)."""

    id: str
    user_id: str
    placement_id: str
    status: str = "Submitted"
    statement: str = ""
    created_at: str = ""
    updated_at: str = ""
    # Rich application data
    cv_url: Optional[str] = None
    cover_letter: str = ""
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    academic_papers: list = field(default_factory=list)
    # References
    reference_1_name: str = ""
    reference_1_email: str = ""
    reference_1_phone: str = ""
    reference_1_relationship: str = ""
    reference_2_name: str = ""
    reference_2_email: str = ""
    reference_2_phone: str = ""
    reference_2_relationship: str = ""
    # Document IDs (referencing StudentDocument)
    document_ids: list = field(default_factory=list)
    # Shortlist flag
    shortlisted: bool = False


@dataclass(frozen=True)
class JobApplication:
    """A jobseeker's submission to a job posting. One row per (user, job)."""

    id: str
    user_id: str
    job_id: str
    status: str = "Submitted"
    statement: str = ""
    created_at: str = ""
    updated_at: str = ""
    # Rich application data
    cv_url: Optional[str] = None
    cover_letter: str = ""
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    academic_papers: list = field(default_factory=list)
    # References
    reference_1_name: str = ""
    reference_1_email: str = ""
    reference_1_phone: str = ""
    reference_1_relationship: str = ""
    reference_2_name: str = ""
    reference_2_email: str = ""
    reference_2_phone: str = ""
    reference_2_relationship: str = ""
    # Document IDs (referencing StudentDocument)
    document_ids: list = field(default_factory=list)
    # Shortlist flag
    shortlisted: bool = False


@dataclass(frozen=True)
class Subscription:
    """A host organisation's live billing state (placement-fee plan).

    ``plan == "Free"`` means no paid plan; the free posting allowance then
    applies. Premium lives with employers/institutions, never students.
    """

    org_id: str
    plan: str = "Free"
    billing: str = ""
    seats: int = 1
    since: str = ""
    status: str = "active"
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool = False
    trial_end: Optional[str] = None
    payment_gateway: Optional[str] = None
    gateway_customer_id: Optional[str] = None
    gateway_subscription_id: Optional[str] = None

    @property
    def is_premium(self) -> bool:
        return self.plan != "Free"


# Account roles. Mirrors the four dashboards the product exposes.
USER_ROLES = ("student", "jobseeker", "employer", "admin")


@dataclass(frozen=True)
class User:
    """An authenticated account. ``password_hash`` never leaves the domain —
    the presentation layer exposes a safe view without it. ``org_id`` links
    employer accounts to the organisation they act on (R1d: user-state
    endpoints derive the org from the token instead of a request parameter)."""

    id: str
    email: str
    name: str
    role: str
    password_hash: str
    created_at: str = ""
    org_id: Optional[str] = None


@dataclass(frozen=True)
class ApplicationPack:
    """The student's ready-to-submit application pack, auto-filled from profile
    and tailored for each placement application."""

    user_id: str
    statement: str = ""
    targets: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Invoice:
    """An invoice for billing an organisation."""

    id: str
    org_id: str
    subscription_id: Optional[str] = None
    amount_cents: int = 0
    currency: str = "USD"
    status: str = "draft"  # draft, open, paid, void, uncollectible
    invoice_number: str = ""
    description: Optional[str] = None
    line_items: list = field(default_factory=list)
    invoice_metadata: dict = field(default_factory=dict)
    due_date: Optional[str] = None
    paid_at: Optional[str] = None
    payment_gateway: Optional[str] = None
    gateway_invoice_id: Optional[str] = None
    gateway_payment_intent_id: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class Transaction:
    """A payment transaction (immutable ledger)."""

    id: str
    org_id: str
    invoice_id: Optional[str] = None
    subscription_id: Optional[str] = None
    amount_cents: int = 0
    currency: str = "USD"
    type: str = ""  # payment, refund, chargeback, credit, fee
    status: str = "pending"  # pending, succeeded, failed, cancelled
    payment_gateway: str = ""
    gateway_transaction_id: Optional[str] = None
    gateway_response: dict = field(default_factory=dict)
    description: Optional[str] = None
    transaction_metadata: dict = field(default_factory=dict)
    idempotency_key: Optional[str] = None
    created_at: str = ""
    processed_at: Optional[str] = None


@dataclass(frozen=True)
class StudentUsage:
    """Student application usage tracking for billing."""

    id: str
    user_id: str
    month: str  # YYYY-MM
    application_count: int = 0
    billed_count: int = 0
    last_billed_at: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""