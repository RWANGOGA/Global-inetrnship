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
    # Shortlist flag
    shortlisted: bool = False


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
    # Proficiency per skill: 1 Beginner, 2 Intermediate, 3 Advanced.
    skills_confidence: dict[str, int] = {}
    # optional catalogue filters (same as GET /placements)
    q: Optional[str] = None
    org_type: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None
    opportunity_type: Optional[str] = None
    limit: Optional[int] = None


class MatchResponse(BaseModel):
    total: int
    items: list[RankedPlacementRead]


class SkillSuggestionRead(BaseModel):
    name: str
    category: str
    demand: int
    placement_ids: list[str]


class SkillSuggestionListResponse(BaseModel):
    total: int
    items: list[SkillSuggestionRead]


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
    # Shortlist flag
    shortlisted: bool = False


class AdminApplicationRead(BaseModel):
    """Extended application schema for admin views with user/placement/job details."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str  # "internship" | "job"
    user_id: str
    user_name: str = ""
    user_email: str = ""
    placement_id: str | None = None
    placement_title: str | None = None
    job_id: str | None = None
    job_title: str | None = None
    organization: str | None = None
    status: str
    statement: str = ""
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
    # Shortlist flag
    shortlisted: bool = False


class AdminApplicationsResponse(BaseModel):
    total: int
    items: list[AdminApplicationRead]


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
    talent_search_opt_in: bool = False
    skills_confidence: dict[str, int] = {}
    skills_source: dict[str, str] = {}


class StudentProfileUpdate(BaseModel):
    course: str = ""
    year: str = ""
    cgpa: float = 0.0
    university: str = ""
    skills: list[str] = []
    talent_search_opt_in: bool = False
    skills_confidence: dict[str, int] = {}
    skills_source: dict[str, str] = {}


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


# ---------------- Employer Applicant Detail --------------------------------------------

class ApplicantMatchScore(BaseModel):
    score: int
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    course_fit: bool = False
    grade_fit: bool = False


class ApplicantDetailRead(BaseModel):
    """Comprehensive applicant detail for employer review."""
    model_config = ConfigDict(from_attributes=True)

    # Application info
    application_id: str
    application_type: str  # "internship" | "job"
    status: str
    statement: str
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
    shortlisted: bool = False
    created_at: str
    updated_at: str | None = None

    # Student profile
    student_id: str
    student_name: str = ""
    student_email: str = ""
    student_course: str = ""
    student_year: str = ""
    student_cgpa: float = 0.0
    student_university: str = ""
    student_skills: list[str] = []
    talent_search_opt_in: bool = False

    # Placement/Job info
    placement_id: str | None = None
    placement_title: str | None = None
    placement_opportunity_type: str | None = None
    job_id: str | None = None
    job_title: str | None = None

    # Documents
    documents: list[StudentDocumentRead] = []

    # Match score
    match_score: ApplicantMatchScore | None = None


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
    org_types: dict[str, int]


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


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    sector: Optional[str] = None
    loc: Optional[str] = None
    seal: Optional[str] = None
    about: Optional[str] = None
    billing_email: Optional[str] = None
    tax_id: Optional[str] = None
    billing_address: Optional[dict] = None


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


# ---------------- Admin Action Logs ------------------------------------

class AdminActionLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    admin_id: str
    admin_email: str
    target_user_id: str | None = None
    target_user_email: str | None = None
    action: str
    reason: str
    details: str | None = None
    created_at: str


class AdminActionLogListResponse(BaseModel):
    total: int
    items: list[AdminActionLogRead]


# ---------------- Admin Reports ------------------------------------

class ReportFilters(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    org_id: Optional[str] = None
    placement_id: Optional[str] = None


class PlacementReportItem(BaseModel):
    placement_id: str
    title: str
    organization: str
    org_type: str
    status: str
    review_status: str
    published_at: str
    closes_at: str
    starts_at: str
    slots: int
    applicants: int
    filled: int
    stipend: str
    location: str
    mode: str


class PlacementReportResponse(BaseModel):
    total: int
    items: list[PlacementReportItem]
    summary: dict


class ApplicationReportItem(BaseModel):
    application_id: str
    type: str
    user_id: str
    user_name: str
    user_email: str
    user_role: str
    placement_id: Optional[str] = None
    placement_title: Optional[str] = None
    job_id: Optional[str] = None
    job_title: Optional[str] = None
    organization: Optional[str] = None
    status: str
    created_at: str
    updated_at: str


class ApplicationReportResponse(BaseModel):
    total: int
    items: list[ApplicationReportItem]
    summary: dict


class HireReportItem(BaseModel):
    application_id: str
    user_id: str
    user_name: str
    user_email: str
    placement_id: str
    placement_title: str
    organization: str
    org_type: str
    hired_at: str
    stipend: str
    duration: str


class HireReportResponse(BaseModel):
    total: int
    items: list[HireReportItem]
    summary: dict


class VerificationReportItem(BaseModel):
    document_id: str
    user_id: str
    user_name: str
    user_email: str
    document_type: str
    filename: str
    status: str
    uploaded_at: str
    verified_at: Optional[str] = None
    verified_by: Optional[str] = None
    rejection_reason: str


class VerificationReportResponse(BaseModel):
    total: int
    items: list[VerificationReportItem]
    summary: dict


# ---------------- Organization Team Management ------------------------------------

class OrganizationMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    user_id: str
    user_name: str = ""
    user_email: str = ""
    role: str
    invited_by: str | None = None
    invited_at: str
    joined_at: str | None = None
    status: str
    created_at: str
    updated_at: str | None = None


class OrganizationMemberListResponse(BaseModel):
    total: int
    items: list[OrganizationMemberRead]


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"  # owner, admin, recruiter, member


class InviteMemberResponse(BaseModel):
    member: OrganizationMemberRead
    message: str


class UpdateMemberRoleRequest(BaseModel):
    role: str  # owner, admin, recruiter, member


class UpdateMemberRoleResponse(BaseModel):
    member: OrganizationMemberRead
    message: str


class RemoveMemberResponse(BaseModel):
    message: str


# ---------------- Hiring Funnel Analytics ------------------------------------

class FunnelStageMetrics(BaseModel):
    stage: str
    count: int
    conversion_rate: float  # percentage from previous stage
    avg_days_in_stage: float | None = None


class HiringFunnelAnalytics(BaseModel):
    """Complete hiring funnel analytics from application to hire."""
    placement_id: str | None = None
    organization_id: str | None = None
    period_start: str
    period_end: str
    total_applications: int
    stages: list[FunnelStageMetrics]
    overall_conversion_rate: float
    avg_time_to_hire_days: float | None = None
    top_source_channels: list[dict] = []


class EmployerHiringFunnelAnalytics(BaseModel):
    """Employer-specific hiring funnel analytics."""
    organization_id: str
    period_start: str
    period_end: str
    total_postings: int
    total_applications: int
    applications_by_status: dict[str, int]
    applications_by_type: dict[str, int]  # internship, job, gig, entry_level
    stages: list[FunnelStageMetrics]
    avg_time_to_hire_days: float | None = None
    top_skills_in_demand: list[dict] = []
    conversion_by_posting: list[dict] = []


class AdminHiringFunnelAnalytics(BaseModel):
    """Platform-wide hiring funnel analytics for admin."""
    period_start: str
    period_end: str
    total_organizations: int
    total_postings: int
    total_applications: int
    applications_by_type: dict[str, int]
    applications_by_status: dict[str, int]
    overall_stages: list[FunnelStageMetrics]
    avg_time_to_hire_days: float | None = None
    top_organizations_by_hires: list[dict] = []
    top_skills_platform: list[dict] = []
    conversion_by_org_type: dict[str, float] = {}
    conversion_by_opportunity_type: dict[str, float] = {}


class AdminHiringFunnelRequest(BaseModel):
    period_start: str
    period_end: str
    org_type: str | None = None
    opportunity_type: str | None = None


class EmployerHiringFunnelRequest(BaseModel):
    period_start: str
    period_end: str
    placement_id: str | None = None


# ---------------- Learning Resources -------------------------------------

class LearningResourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    url: str
    provider: str
    description: str
    skill: str
    placement_id: str
    level: str
    resource_type: str
    duration: str
    created_at: str


class LearningResourceWrite(BaseModel):
    title: str
    url: str
    provider: str = ""
    description: str = ""
    skill: str = ""
    placement_id: str = ""
    level: str = ""
    resource_type: str = "Course"
    duration: str = ""


class LearningResourceListResponse(BaseModel):
    total: int
    items: list[LearningResourceRead]


# ---------------- AI Enrichment --------------------------------------------

class EnrichmentRequest(BaseModel):
    personal_statement: str
    existing_skills: list[str] = []


class SkillCompetencyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    skill_id: str
    canonical_name: str
    aliases: list[str] = []
    category: str = ""
    proficiency: int
    confidence_score: float
    evidence: list[str] = []
    years_experience: float = 0.0
    learning_velocity: float = 0.0


class SoftSkillProfileRead(BaseModel):
    leadership: float = 0.0
    communication: float = 0.0
    teamwork: float = 0.0
    adaptability: float = 0.0
    problem_solving: float = 0.0
    initiative: float = 0.0
    organization: float = 0.0
    cultural_awareness: float = 0.0


class CareerTrajectoryRead(BaseModel):
    current_stage: str
    target_roles: list[str] = []
    career_aspirations: list[str] = []
    domain_interests: list[str] = []
    learning_goals: list[str] = []
    work_preferences: str = ""
    values_signals: list[str] = []


class CulturalValuesRead(BaseModel):
    autonomy_preference: float = 0.5
    mission_alignment: float = 0.5
    collaboration_style: str = "hybrid"
    risk_tolerance: float = 0.5
    learning_appetite: float = 0.5
    work_life_integration: float = 0.5
    feedback_receptivity: float = 0.5
    diversity_value: float = 0.5


class AdvancedStudentProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    user_id: str
    skills: list[SkillCompetencyRead] = []
    career_trajectory: CareerTrajectoryRead
    soft_skills: SoftSkillProfileRead
    cultural_values: CulturalValuesRead
    profile_embedding: list[float] = []
    skills_embedding: list[float] = []
    bio_embedding: list[float] = []
    course: str = ""
    university: str = ""
    cgpa: float = 0.0
    graduation_year: int = 0
    location_preferences: list[str] = []
    remote_ok: bool = False
    availability: str = "full-time"


class EnrichmentResponse(BaseModel):
    profile: AdvancedStudentProfileRead
    message: str = "Profile enriched successfully"
