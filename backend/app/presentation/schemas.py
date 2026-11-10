"""API response schemas (transport concern only)."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class OrganisationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    sector: str
    loc: str
    seal: str
    about: str = ""


class PlacementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    org_id: str
    courses: list[str]
    grade: str
    loc: str
    mode: str
    duration: str
    stipend: str
    deadline: str
    slots: int
    status: str
    applicants: int
    docs: list[str]
    testimonial: bool
    about: str
    duties: list[str]
    review_status: str
    published_at: str
    closes_at: str
    starts_at: str
    requirements: list[str]
    review_reason: str
    org: Optional[OrganisationRead] = None


class PlacementListResponse(BaseModel):
    total: int
    items: list[PlacementRead]


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    org_id: str
    loc: str
    mode: str
    employment_type: str
    salary: str
    closes_at: str
    summary: str
    requirements: list[str]
    status: str
    review_status: str
    published_at: str
    review_reason: str
    org: Optional[OrganisationRead] = None


class JobListResponse(BaseModel):
    total: int
    items: list[JobRead]


class JobPostingCreate(BaseModel):
    title: str
    loc: str = ""
    mode: str = "On-site"
    employment_type: str = "Full time"
    salary: str = ""
    closes_at: str
    summary: str = ""
    requirements: list[str] = []


class JobPostingListResponse(JobListResponse):
    pass


class JobApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    job_id: str
    status: str
    statement: str
    created_at: str
    updated_at: str | None = None
    # Rich application data
    cv_url: str | None = None
    cover_letter: str = ""
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    academic_papers: list = []
    # References
    reference_1_name: str = ""
    reference_1_email: str = ""
    reference_1_phone: str = ""
    reference_1_relationship: str = ""
    reference_2_name: str = ""
    reference_2_email: str = ""
    reference_2_phone: str = ""
    reference_2_relationship: str = ""
    # Document IDs
    document_ids: list = []


class JobApplicationCreate(BaseModel):
    statement: str = ""
    cover_letter: str = ""
    cv_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    academic_papers: list = []
    reference_1_name: str = ""
    reference_1_email: str = ""
    reference_1_phone: str = ""
    reference_1_relationship: str = ""
    reference_2_name: str = ""
    reference_2_email: str = ""
    reference_2_phone: str = ""
    reference_2_relationship: str = ""
    document_ids: list = []


class JobApplicationListResponse(BaseModel):
    total: int
    items: list[JobApplicationRead]


class JobApplicationStatusUpdate(BaseModel):
    status: str


class JobReviewRequest(BaseModel):
    decision: str
    reason: str = ""


class SkillRead(BaseModel):
    name: str
    category: str
    keywords: list[str]


class CatalogMetaRead(BaseModel):
    """Everything the frontend used to hardcode: the course/type/location filter
    values derived from the live catalog, plus the matching tables owned by the
    domain (grade thresholds, skill taxonomy, per-placement requirements)."""

    courses: list[str]
    org_types: list[str]
    locations: list[str]
    grade_rules: dict[str, float]
    required_skills: dict[str, list[str]]
    skills: list[SkillRead]


class MatchRead(BaseModel):
    score: int
    matched: list[str]
    missing: list[str]
    course_fit: bool
    grade_fit: bool


class RankedPlacementRead(BaseModel):
    placement: PlacementRead
    match: MatchRead


class MatchRequest(BaseModel):
    skills: list[str] = []
    course: str = ""
    cgpa: float = 0.0
    # optional catalogue filters (same as GET /placements)
    q: Optional[str] = None
    org_type: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None
    limit: Optional[int] = None


class MatchResponse(BaseModel):
    total: int
    items: list[RankedPlacementRead]


class ExtractRequest(BaseModel):
    text: str


class ExtractResponse(BaseModel):
    skills: list[str]


class AdvisorRequest(BaseModel):
    message: str
    skills: list[str] = []
    course: str = ""
    cgpa: float = 0.0
    role: str = "student"
    history: list[dict] = []


class AdvisorAction(BaseModel):
    type: str  # "navigate", "apply", "check_eligibility", "open_placement", "open_dashboard"
    label: str
    payload: dict = {}


class AdvisorResponse(BaseModel):
    reply: str
    actions: list[AdvisorAction] = []


# ---------------- B4: user state (saved, applications, subscription) -------


class SavedListResponse(BaseModel):
    saved_ids: list[str]


class ToggleSavedRequest(BaseModel):
    placement_id: str
    # R1d: identity comes from the Bearer token. Kept optional so an in-flight
    # client that still sends it isn't rejected; the router ignores it.
    user_id: Optional[str] = None


class ToggleSavedResponse(BaseModel):
    saved: bool
    saved_ids: list[str]


class ApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    placement_id: str
    status: str
    statement: str
    created_at: str
    updated_at: str = ""
    # Rich application data
    cv_url: str | None = None
    cover_letter: str = ""
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    academic_papers: list = []
    # References
    reference_1_name: str = ""
    reference_1_email: str = ""
    reference_1_phone: str = ""
    reference_1_relationship: str = ""
    reference_2_name: str = ""
    reference_2_email: str = ""
    reference_2_phone: str = ""
    reference_2_relationship: str = ""
    # Document IDs
    document_ids: list = []


class ApplyRequest(BaseModel):
    placement_id: str
    statement: str = ""
    cover_letter: str = ""
    cv_url: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    academic_papers: list = []
    reference_1_name: str = ""
    reference_1_email: str = ""
    reference_1_phone: str = ""
    reference_1_relationship: str = ""
    reference_2_name: str = ""
    reference_2_email: str = ""
    reference_2_phone: str = ""
    reference_2_relationship: str = ""
    document_ids: list = []
    # R1d: ignored — the applicant is the authenticated user from the token.
    user_id: Optional[str] = None


class ApplicationsResponse(BaseModel):
    total: int
    items: list[ApplicationRead]


class InternshipPostingCreate(BaseModel):
    title: str
    courses: list[str] = []
    grade: str = ""
    loc: str = ""
    mode: str = "On-site"
    duration: str = ""
    stipend: str = ""
    slots: int = 1
    about: str = ""
    duties: list[str] = []
    requirements: list[str] = []
    docs: list[str] = []
    testimonial: bool = False
    published_at: str = ""
    closes_at: str
    starts_at: str
    # Opportunity type: internship | gig | entry_level
    opportunity_type: str = "internship"
    # Gig-specific fields
    duration_hours: int | None = None
    budget_range: str | None = None
    milestones: list[str] | None = None
    remote_ok: bool | None = None
    # Entry-level specific fields
    salary_range: str | None = None
    probation_period: str | None = None
    training_included: bool | None = None
    career_path: str | None = None
    # Skill requirements (for matching)
    skills_required: list[str] | None = None


class InternshipPostingRead(PlacementRead):
    pass


class InternshipPostingListResponse(BaseModel):
    total: int
    items: list[InternshipPostingRead]


class InternshipReviewRequest(BaseModel):
    decision: str
    reason: str = ""


class InternshipReviewListResponse(BaseModel):
    total: int
    items: list[InternshipPostingRead]


class StudentProfileRead(BaseModel):
    user_id: str
    course: str
    year: str
    cgpa: float
    university: str
    skills: list[str]


class StudentProfileUpdate(BaseModel):
    course: str = ""
    year: str = ""
    cgpa: float = 0.0
    university: str = ""
    skills: list[str] = []


class ApplicationPackRead(BaseModel):
    user_id: str
    statement: str
    targets: list[str]


class ApplicationPackUpdate(BaseModel):
    statement: str = ""
    targets: list[str] = []


class ResumeRead(BaseModel):
    filename: str
    content_type: str
    size_bytes: int
    uploaded_at: str


class StudentDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    document_type: str
    filename: str
    content_type: str
    size_bytes: int
    status: str
    rejection_reason: str
    uploaded_at: str
    is_public: bool = False


class StudentDocumentsResponse(BaseModel):
    items: list[StudentDocumentRead]


class StudentDocumentVerifyRequest(BaseModel):
    status: str  # "verified" or "rejected"
    rejection_reason: str = ""


class StudentDocumentVerifyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    document_type: str
    filename: str
    content_type: str
    size_bytes: int
    status: str
    rejection_reason: str
    uploaded_at: str
    is_public: bool = False


# ---------------- Admin dashboard --------------------------------------------


class AdminQueueItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    n: str
    i: str
    c: str
    y: str
    p: str
    d: str
    st: str


class AdminQueueListResponse(BaseModel):
    total: int
    items: list[AdminQueueItemRead]


class AdminDashboardMetrics(BaseModel):
    open_placements: int
    pending_documents: int
    students_placed: int
    placement_record_complete: int  # percentage
    total_users: int
    users_by_role: dict[str, int]
    total_organizations: int
    total_applications: int
    total_revenue_cents: int
    verification_rate: float  # percentage


class AdminActivityItem(BaseModel):
    who: str
    action: str
    time: str


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_id: str
    plan: str
    billing: str
    seats: int
    since: str
    is_premium: bool


class ActivatePlanRequest(BaseModel):
    plan: str
    billing: str = "Card"
    seats: int = 1
    # R1d: org is derived from the token for employers. An admin may target an
    # org explicitly; ignored otherwise.
    org_id: Optional[str] = None


class CancelPlanRequest(BaseModel):
    org_id: Optional[str] = None


# ---------------- Auth ------------------------------------------------------


class RegisterRequest(BaseModel):
    email: str
    name: str = ""
    role: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    org_id: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


# ---------------- Organization Management ------------------------------------

class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    sector: str
    loc: str
    seal: str
    about: str
    billing_email: Optional[str] = None
    tax_id: Optional[str] = None
    billing_address: dict = {}
    created_at: str
    is_active: bool = True


class OrganizationListResponse(BaseModel):
    total: int
    items: list[OrganizationRead]


class OrganizationDetailResponse(BaseModel):
    organization: OrganizationRead
    stats: dict
    active_placements: int
    total_hired: int
    total_revenue_cents: int
    compliance_score: int
    active_postings: int
    subscription: dict
    billing_email: Optional[str] = None
    tax_id: Optional[str] = None


class OrganizationSanctionRequest(BaseModel):
    action: str  # "suspend" | "unsuspend" | "sanction"
    reason: str


class OrganizationSanctionResponse(BaseModel):
    organization: OrganizationRead
    action: str
    reason: str
    message: str


# ---------------- User Management ------------------------------------

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    org_id: Optional[str] = None
    created_at: str
    is_active: bool = True


class UserListResponse(BaseModel):
    total: int
    items: list[UserRead]


class UserDetailResponse(BaseModel):
    user: UserRead
    stats: dict
    applications_count: int
    documents_count: int
    testimonials_count: int
    applications: list
    documents: list
    testimonials: list
    subscription: Optional[dict] = None


class UserActionRequest(BaseModel):
    action: str  # "suspend" | "activate" | "change_role"
    reason: str
    new_role: Optional[str] = None


class UserActionResponse(BaseModel):
    user: UserRead
    action: str
    reason: str
    message: str
