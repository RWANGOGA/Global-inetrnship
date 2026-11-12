"""Domain entities and value objects for the Placements bounded context."""
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


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
    talent_search_opt_in: bool = False
    # Optional proficiency per skill (1 = Beginner, 2 = Intermediate,
    # 3 = Advanced). A skill with no rating contributes as a full match.
    skills_confidence: dict[str, int] = field(default_factory=dict)
    # How each skill entered the profile (manual, project, course, quiz).
    skills_source: dict[str, str] = field(default_factory=dict)


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


@dataclass(frozen=True)
class AdminActionLog:
    """Record of admin actions for audit trail."""

    id: str
    admin_id: str
    admin_email: str
    action: str  # suspend, activate, change_role, delete, etc.
    reason: str
    target_user_id: Optional[str] = None
    target_user_email: Optional[str] = None
    details: Optional[str] = None
    created_at: str = ""


@dataclass(frozen=True)
class LearningResource:
    """A curated resource that helps a student learn a skill or prepare for a
    specific placement. Managed by administrators, read by students."""

    id: str
    title: str
    url: str
    provider: str = ""
    description: str = ""
    skill: str = ""
    placement_id: str = ""
    level: str = ""  # Beginner | Intermediate | Advanced
    resource_type: str = "Course"
    duration: str = ""
    created_at: str = ""


# =============================================================================
# ADVANCED MATCHING ENTITIES (AI-Driven Career Matching)
# =============================================================================

class ProficiencyLevel(Enum):
    BEGINNER = 1
    INTERMEDIATE = 2
    ADVANCED = 3


class CareerStage(Enum):
    STUDENT = "student"
    EARLY_CAREER = "early_career"
    MID_CAREER = "mid_career"
    SENIOR = "senior"
    LEAD_PRINCIPAL = "lead_principal"


@dataclass(frozen=True)
class SkillCompetency:
    """Rich skill representation with proficiency and evidence."""
    
    skill_id: str
    canonical_name: str
    aliases: list[str] = field(default_factory=list)
    category: str = ""
    proficiency: ProficiencyLevel = ProficiencyLevel.BEGINNER
    confidence_score: float = 0.0
    evidence: list[str] = field(default_factory=list)
    years_experience: float = 0.0
    last_used: Optional[str] = None
    learning_velocity: float = 0.0


@dataclass(frozen=True)
class SoftSkillProfile:
    """AI-extracted soft skills from unstructured text."""
    
    leadership: float = 0.0
    communication: float = 0.0
    teamwork: float = 0.0
    adaptability: float = 0.0
    problem_solving: float = 0.0
    initiative: float = 0.0
    organization: float = 0.0
    cultural_awareness: float = 0.0


@dataclass(frozen=True)
class CareerTrajectory:
    """Student/employee career path analysis."""
    
    current_stage: CareerStage = CareerStage.STUDENT
    target_roles: list[str] = field(default_factory=list)
    career_aspirations: list[str] = field(default_factory=list)
    domain_interests: list[str] = field(default_factory=list)
    learning_goals: list[str] = field(default_factory=list)
    work_preferences: str = ""
    values_signals: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class CulturalValues:
    """Extracted cultural values and work style preferences."""
    
    autonomy_preference: float = 0.5
    mission_alignment: float = 0.5
    collaboration_style: str = "hybrid"
    risk_tolerance: float = 0.5
    learning_appetite: float = 0.5
    work_life_integration: float = 0.5
    feedback_receptivity: float = 0.5
    diversity_value: float = 0.5


@dataclass(frozen=True)
class AdvancedStudentProfile:
    """Complete enriched student profile for AI-driven matching."""
    
    user_id: str
    skills: list[SkillCompetency] = field(default_factory=list)
    career_trajectory: CareerTrajectory = field(default_factory=CareerTrajectory)
    soft_skills: SoftSkillProfile = field(default_factory=SoftSkillProfile)
    cultural_values: CulturalValues = field(default_factory=CulturalValues)
    profile_embedding: list[float] = field(default_factory=list)
    skills_embedding: list[float] = field(default_factory=list)
    bio_embedding: list[float] = field(default_factory=list)
    course: str = ""
    university: str = ""
    cgpa: float = 0.0
    graduation_year: int = 0
    location_preferences: list[str] = field(default_factory=list)
    remote_ok: bool = False
    availability: str = "full-time"


@dataclass(frozen=True)
class AdvancedPlacementProfile:
    """Complete enriched placement/job profile for AI-driven matching."""
    
    placement_id: str
    required_skills: list[SkillCompetency] = field(default_factory=list)
    preferred_skills: list[SkillCompetency] = field(default_factory=list)
    experience_level: CareerStage = CareerStage.STUDENT
    required_soft_skills: dict[str, float] = field(default_factory=dict)
    cultural_values: CulturalValues = field(default_factory=CulturalValues)
    team_composition: dict[str, int] = field(default_factory=dict)
    description_embedding: list[float] = field(default_factory=list)
    requirements_embedding: list[float] = field(default_factory=list)
    culture_embedding: list[float] = field(default_factory=list)
    org_id: str = ""
    org_type: str = ""
    org_size: str = ""
    location: str = ""
    remote_policy: str = ""
    compensation_band: tuple[float, float] = (0.0, 0.0)
    urgency: str = "this_month"
    hiring_manager_id: Optional[str] = None