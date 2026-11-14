"""Organization-scoped internship posting workflow."""
from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
import io

from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.orm import OrganisationORM, PlacementORM, JobORM, ApplicationORM, JobApplicationORM, UserORM, StudentProfileORM, OrganizationMemberORM
from app.presentation.deps import get_current_user
from app.presentation.schemas import (
    InternshipPostingCreate,
    InternshipPostingListResponse,
    InternshipPostingRead,
    JobPostingCreate,
    JobPostingListResponse,
    JobRead,
    OrganizationRead,
    OrganizationUpdate,
    ApplicationRead,
    JobApplicationRead,
    StudentProfileRead,
    StudentDocumentRead,
    ApplicantDetailRead,
    ApplicantMatchScore,
    OrganizationMemberRead,
    OrganizationMemberListResponse,
    InviteMemberRequest,
    InviteMemberResponse,
    UpdateMemberRoleRequest,
    UpdateMemberRoleResponse,
    RemoveMemberResponse,
    EmployerHiringFunnelAnalytics,
    FunnelStageMetrics,
    EmployerHiringFunnelRequest,
)
from pydantic import BaseModel
from typing import Optional
from app.infrastructure.orm import StudentProfileORM, UserORM
from app.infrastructure.repositories import SqlAlchemyPlacementRepository

router = APIRouter(prefix="/organization", tags=["organization"])


def _require_employer(user: User) -> str:
    if user.role != "employer" or not user.org_id:
        raise HTTPException(
            status_code=403,
            detail="Only an employer linked to an organisation can manage internships",
        )
    return user.org_id


def _validate_dates(payload: InternshipPostingCreate) -> None:
    try:
        close = date.fromisoformat(payload.closes_at)
        start = date.fromisoformat(payload.starts_at)
        if payload.published_at:
            published = date.fromisoformat(payload.published_at)
        else:
            published = date.today()
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="published_at, closes_at, and starts_at must use YYYY-MM-DD",
        ) from exc
    if close < published:
        raise HTTPException(status_code=422, detail="Closing date must be after publication date")
    if start < close:
        raise HTTPException(status_code=422, detail="Start date must be on or after the closing date")


@router.get("/internships", response_model=InternshipPostingListResponse)
def list_organization_internships(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InternshipPostingListResponse:
    org_id = _require_employer(current_user)
    rows = (
        session.query(PlacementORM)
        .filter(PlacementORM.org_id == org_id)
        .order_by(PlacementORM.id.desc())
        .all()
    )
    repo = SqlAlchemyPlacementRepository(session)
    items = [repo.get(row.id) for row in rows]
    resolved = [item for item in items if item is not None]
    return InternshipPostingListResponse(
        total=len(resolved),
        items=[InternshipPostingRead.model_validate(item) for item in resolved],
    )


@router.post("/internships", response_model=InternshipPostingRead, status_code=201)
def create_organization_internship(
    payload: InternshipPostingCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InternshipPostingRead:
    org_id = _require_employer(current_user)
    _validate_dates(payload)
    if session.get(OrganisationORM, org_id) is None:
        raise HTTPException(status_code=409, detail="Organisation record was not found")
    if not payload.title.strip() or not payload.courses:
        raise HTTPException(status_code=422, detail="Title and at least one eligible course are required")

    # Check placement limit based on subscription
    from app.application.services import BillingService
    from app.presentation.deps import get_billing_service
    billing_service = get_billing_service(session)
    limit_check = billing_service.check_placement_limit(org_id, session)
    if not limit_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "placement_limit_exceeded",
                "message": limit_check["reason"],
                "current": limit_check["current"],
                "limit": limit_check["limit"],
                "plan": billing_service.get_subscription(org_id).plan
            }
        )
    row = PlacementORM(
        id=f"p-{uuid4().hex[:12]}",
        title=payload.title.strip(),
        org_id=org_id,
        courses=list(dict.fromkeys(course.strip() for course in payload.courses if course.strip())),
        grade=payload.grade.strip(),
        loc=payload.loc.strip(),
        mode=payload.mode.strip(),
        duration=payload.duration.strip(),
        stipend=payload.stipend.strip(),
        deadline=payload.closes_at,
        slots=max(1, payload.slots),
        status="Open",
        applicants=0,
        docs=list(payload.docs),
        testimonial=payload.testimonial,
        about=payload.about.strip(),
        duties=list(payload.duties),
        review_status="pending_review",
        published_at=payload.published_at or date.today().isoformat(),
        closes_at=payload.closes_at,
        starts_at=payload.starts_at,
        requirements=list(payload.requirements),
        opportunity_type=payload.opportunity_type,
        duration_hours=payload.duration_hours,
        budget_range=payload.budget_range,
        milestones=payload.milestones,
        remote_ok=payload.remote_ok,
        salary_range=payload.salary_range,
        probation_period=payload.probation_period,
        training_included=payload.training_included,
        career_path=payload.career_path,
        skills_required=payload.skills_required,
    )
    session.add(row)
    session.commit()
    placement = SqlAlchemyPlacementRepository(session).get(row.id)
    if placement is None:
        raise HTTPException(status_code=500, detail="Internship could not be loaded after creation")
    return InternshipPostingRead.model_validate(placement)


@router.delete("/internships/{internship_id}", response_model=dict)
def delete_organization_internship(
    internship_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_employer(current_user)
    placement = session.get(PlacementORM, internship_id)
    if not placement:
        raise HTTPException(status_code=404, detail="Internship not found")
    if placement.org_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this internship")
    session.delete(placement)
    session.commit()
    return {"deleted": True, "id": internship_id}


@router.get("/jobs", response_model=JobPostingListResponse)
def list_organization_jobs(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JobPostingListResponse:
    org_id = _require_employer(current_user)
    rows = session.query(JobORM).filter(JobORM.org_id == org_id).order_by(JobORM.id.desc()).all()
    return JobPostingListResponse(
        total=len(rows),
        items=[JobRead.model_validate(row, from_attributes=True) for row in rows],
    )


@router.post("/jobs", response_model=JobRead, status_code=201)
def create_organization_job(
    payload: JobPostingCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JobRead:
    org_id = _require_employer(current_user)
    if session.get(OrganisationORM, org_id) is None:
        raise HTTPException(status_code=409, detail="Organisation record was not found")
    try:
        closing_date = date.fromisoformat(payload.closes_at)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="closes_at must use YYYY-MM-DD") from exc
    if closing_date < date.today():
        raise HTTPException(status_code=422, detail="Closing date must be in the future")
    if not payload.title.strip():
        raise HTTPException(status_code=422, detail="Job title is required")
    row = JobORM(
        id=f"j-{uuid4().hex[:12]}",
        title=payload.title.strip(),
        org_id=org_id,
        loc=payload.loc.strip(),
        mode=payload.mode.strip(),
        employment_type=payload.employment_type.strip(),
        salary=payload.salary.strip(),
        closes_at=payload.closes_at,
        summary=payload.summary.strip(),
        requirements=list(dict.fromkeys(value.strip() for value in payload.requirements if value.strip())),
        status="Open",
        review_status="pending_review",
        published_at=date.today().isoformat(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return JobRead.model_validate(row, from_attributes=True)


# ---------------- CSV Exports (Employer) ------------------------------------

@router.get("/export/placements.csv")
def export_org_placements_csv(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_employer(current_user)
    
    rows = session.query(PlacementORM).filter(PlacementORM.org_id == org_id).order_by(PlacementORM.published_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Title", "Location", "Mode", "Duration", "Stipend", "Deadline", "Slots",
        "Status", "Applicants", "Review Status", "Published At", "Closes At", "Starts At",
        "Grade", "Courses", "Requirements", "Documents Required", "About", "Duties",
        "Opportunity Type"
    ])
    
    for p in rows:
        writer.writerow([
            p.id, p.title, p.loc, p.mode, p.duration, p.stipend, p.deadline, p.slots,
            p.status, p.applicants, p.review_status, p.published_at, p.closes_at, p.starts_at,
            p.grade, "; ".join(p.courses) if p.courses else "",
            "; ".join(p.requirements) if p.requirements else "",
            "; ".join(p.docs) if p.docs else "",
            p.about, "; ".join(p.duties) if p.duties else "",
            p.opportunity_type
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=my_placements.csv"}
    )


@router.get("/export/jobs.csv")
def export_org_jobs_csv(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_employer(current_user)
    
    rows = session.query(JobORM).filter(JobORM.org_id == org_id).order_by(JobORM.published_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Title", "Location", "Mode", "Employment Type", "Salary", "Closes At",
        "Summary", "Requirements", "Status", "Review Status", "Published At", "Applicants"
    ])
    
    for j in rows:
        writer.writerow([
            j.id, j.title, j.loc, j.mode, j.employment_type, j.salary, j.closes_at,
            j.summary, "; ".join(j.requirements) if j.requirements else "",
            j.status, j.review_status, j.published_at, j.applicants or 0
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=my_jobs.csv"}
    )


@router.get("/export/placement/{placement_id}/applicants.csv")
def export_org_placement_applicants_csv(
    placement_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_employer(current_user)
    
    placement = session.query(PlacementORM).filter_by(id=placement_id, org_id=org_id).first()
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found or not yours")
    
    apps = session.query(ApplicationORM).filter_by(placement_id=placement_id).all()
    users = {u.id: u for u in session.query(UserORM).filter(UserORM.id.in_([a.user_id for a in apps])).all()}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Application ID", "User ID", "User Name", "User Email", "Status",
        "Statement", "Cover Letter", "CV URL", "GitHub", "LinkedIn", "Portfolio",
        "Academic Papers", "Reference 1 Name", "Reference 1 Email", "Reference 1 Phone", "Reference 1 Relationship",
        "Reference 2 Name", "Reference 2 Email", "Reference 2 Phone", "Reference 2 Relationship",
        "Applied At", "Updated At"
    ])
    
    for app in apps:
        user = users.get(app.user_id)
        writer.writerow([
            app.id, app.user_id, user.name if user else "", user.email if user else "",
            app.status, app.statement, app.cover_letter, app.cv_url or "",
            app.github_url or "", app.linkedin_url or "", app.portfolio_url or "",
            "; ".join(app.academic_papers) if app.academic_papers else "",
            app.reference_1_name, app.reference_1_email, app.reference_1_phone, app.reference_1_relationship,
            app.reference_2_name, app.reference_2_email, app.reference_2_phone, app.reference_2_relationship,
            app.created_at, app.updated_at
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=placement_{placement_id}_applicants.csv"}
    )


@router.get("/export/job/{job_id}/applicants.csv")
def export_org_job_applicants_csv(
    job_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    org_id = _require_employer(current_user)
    
    job = session.query(JobORM).filter_by(id=job_id, org_id=org_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not yours")
    
    apps = session.query(JobApplicationORM).filter_by(job_id=job_id).all()
    users = {u.id: u for u in session.query(UserORM).filter(UserORM.id.in_([a.user_id for a in apps])).all()}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Application ID", "User ID", "User Name", "User Email", "Status",
        "Statement", "Cover Letter", "CV URL", "GitHub", "LinkedIn", "Portfolio",
        "Academic Papers", "Reference 1 Name", "Reference 1 Email", "Reference 1 Phone", "Reference 1 Relationship",
        "Reference 2 Name", "Reference 2 Email", "Reference 2 Phone", "Reference 2 Relationship",
        "Applied At", "Updated At"
    ])
    
    for app in apps:
        user = users.get(app.user_id)
        writer.writerow([
            app.id, app.user_id, user.name if user else "", user.email if user else "",
            app.status, app.statement, app.cover_letter, app.cv_url or "",
            app.github_url or "", app.linkedin_url or "", app.portfolio_url or "",
            "; ".join(app.academic_papers) if app.academic_papers else "",
            app.reference_1_name, app.reference_1_email, app.reference_1_phone, app.reference_1_relationship,
            app.reference_2_name, app.reference_2_email, app.reference_2_phone, app.reference_2_relationship,
            app.created_at, app.updated_at
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=job_{job_id}_applicants.csv"}
    )


# ---- Public Organization Profile -------------------------------------------

@router.get("/public/{org_id}", response_model=OrganizationRead)
def get_public_organization(
    org_id: str,
    session: Session = Depends(get_session),
) -> OrganizationRead:
    """Get public organization profile (no auth required)."""
    org = session.query(OrganisationORM).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationRead(
        id=org.id,
        name=org.name,
        type=org.type,
        sector=org.sector,
        loc=org.loc,
        seal=org.seal,
        about=org.about,
    )


# ---- Employer Organization Profile -------------------------------------------

@router.get("/profile", response_model=OrganizationRead)
def get_organization_profile(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> OrganizationRead:
    """Get the current employer's organization profile."""
    org_id = _require_employer(current_user)
    org = session.query(OrganisationORM).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationRead.model_validate(org, from_attributes=True)


@router.patch("/profile", response_model=OrganizationRead)
def update_organization_profile(
    payload: OrganizationUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> OrganizationRead:
    """Update the current employer's organization profile."""
    org_id = _require_employer(current_user)
    org = session.query(OrganisationORM).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)
    
    session.commit()
    session.refresh(org)
    return OrganizationRead.model_validate(org, from_attributes=True)


# ---- Organization Team Management -------------------------------------------

def _require_org_owner_or_admin(user: User, session: Session, org_id: str) -> None:
    """Check if user is owner or admin of the organization."""
    member = session.query(OrganizationMemberORM).filter_by(
        org_id=org_id, user_id=user.id
    ).first()
    if not member or member.role not in ("owner", "admin") or member.status != "active":
        raise HTTPException(
            status_code=403,
            detail="Only organization owners and admins can manage team members"
        )


@router.get("/members", response_model=OrganizationMemberListResponse)
def list_organization_members(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> OrganizationMemberListResponse:
    """List all members of the employer's organization."""
    org_id = _require_employer(current_user)
    _require_org_owner_or_admin(current_user, session, org_id)
    
    members = session.query(OrganizationMemberORM).filter_by(org_id=org_id).all()
    
    items = []
    for member in members:
        user = session.query(UserORM).filter_by(id=member.user_id).first()
        items.append(OrganizationMemberRead(
            id=member.id,
            org_id=member.org_id,
            user_id=member.user_id,
            user_name=user.name if user else "",
            user_email=user.email if user else "",
            role=member.role,
            invited_by=member.invited_by,
            invited_at=member.invited_at,
            joined_at=member.joined_at,
            status=member.status,
            created_at=member.created_at,
            updated_at=member.updated_at,
        ))
    
    return OrganizationMemberListResponse(total=len(items), items=items)


@router.post("/members/invite", response_model=InviteMemberResponse, status_code=201)
def invite_organization_member(
    payload: InviteMemberRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InviteMemberResponse:
    """Invite a new member to the organization."""
    org_id = _require_employer(current_user)
    _require_org_owner_or_admin(current_user, session, org_id)
    
    # Find user by email
    user = session.query(UserORM).filter_by(email=payload.email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User with this email not found")
    
    # Check if already a member
    existing = session.query(OrganizationMemberORM).filter_by(
        org_id=org_id, user_id=user.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member of this organization")
    
    # Validate role
    valid_roles = ["owner", "admin", "recruiter", "member"]
    if payload.role not in valid_roles:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Prevent creating another owner
    if payload.role == "owner":
        raise HTTPException(status_code=422, detail="Cannot invite another owner")
    
    # Create invitation
    from uuid import uuid4
    now = date.today().isoformat()
    member = OrganizationMemberORM(
        id=f"om-{uuid4().hex[:12]}",
        org_id=org_id,
        user_id=user.id,
        role=payload.role,
        invited_by=current_user.id,
        invited_at=now,
        status="pending",
        created_at=now,
    )
    session.add(member)
    session.commit()
    session.refresh(member)
    
    return InviteMemberResponse(
        member=OrganizationMemberRead(
            id=member.id,
            org_id=member.org_id,
            user_id=member.user_id,
            user_name=user.name,
            user_email=user.email,
            role=member.role,
            invited_by=member.invited_by,
            invited_at=member.invited_at,
            joined_at=member.joined_at,
            status=member.status,
            created_at=member.created_at,
            updated_at=member.updated_at,
        ),
        message=f"Invitation sent to {user.email}"
    )


@router.patch("/members/{member_id}/role", response_model=UpdateMemberRoleResponse)
def update_member_role(
    member_id: str,
    payload: UpdateMemberRoleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UpdateMemberRoleResponse:
    """Update a member's role in the organization."""
    org_id = _require_employer(current_user)
    _require_org_owner_or_admin(current_user, session, org_id)
    
    member = session.query(OrganizationMemberORM).filter_by(id=member_id, org_id=org_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Prevent changing owner role
    if member.role == "owner":
        raise HTTPException(status_code=422, detail="Cannot change owner's role")
    
    # Validate role
    valid_roles = ["owner", "admin", "recruiter", "member"]
    if payload.role not in valid_roles:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    
    # Prevent promoting to owner
    if payload.role == "owner":
        raise HTTPException(status_code=422, detail="Cannot promote to owner")
    
    member.role = payload.role
    member.updated_at = date.today().isoformat()
    session.commit()
    session.refresh(member)
    
    user = session.query(UserORM).filter_by(id=member.user_id).first()
    
    return UpdateMemberRoleResponse(
        member=OrganizationMemberRead(
            id=member.id,
            org_id=member.org_id,
            user_id=member.user_id,
            user_name=user.name if user else "",
            user_email=user.email if user else "",
            role=member.role,
            invited_by=member.invited_by,
            invited_at=member.invited_at,
            joined_at=member.joined_at,
            status=member.status,
            created_at=member.created_at,
            updated_at=member.updated_at,
        ),
        message=f"Role updated to {payload.role}"
    )


@router.delete("/members/{member_id}", response_model=RemoveMemberResponse)
def remove_organization_member(
    member_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RemoveMemberResponse:
    """Remove a member from the organization."""
    org_id = _require_employer(current_user)
    _require_org_owner_or_admin(current_user, session, org_id)
    
    member = session.query(OrganizationMemberORM).filter_by(id=member_id, org_id=org_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Prevent removing owner
    if member.role == "owner":
        raise HTTPException(status_code=422, detail="Cannot remove organization owner")
    
    # Prevent self-removal
    if member.user_id == current_user.id:
        raise HTTPException(status_code=422, detail="Cannot remove yourself")
    
    session.delete(member)
    session.commit()
    
    return RemoveMemberResponse(message="Member removed from organization")


# ---- Shortlisted Applications -------------------------------------------

@router.get("/shortlisted", response_model=list[ApplicationRead])
def get_shortlisted_internship_applications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ApplicationRead]:
    """Get all shortlisted internship applications for the employer's organization."""
    org_id = _require_employer(current_user)
    
    # Get all placement IDs for this organization
    placement_ids = [
        p.id for p in session.query(PlacementORM.id).filter(PlacementORM.org_id == org_id).all()
    ]
    
    if not placement_ids:
        return []
    
    # Get shortlisted applications for these placements
    apps = (
        session.query(ApplicationORM)
        .filter(ApplicationORM.placement_id.in_(placement_ids))
        .filter(ApplicationORM.shortlisted == True)
        .order_by(ApplicationORM.updated_at.desc())
        .all()
    )
    
    return [ApplicationRead.model_validate(app, from_attributes=True) for app in apps]


@router.get("/shortlisted/jobs", response_model=list[JobApplicationRead])
def get_shortlisted_job_applications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[JobApplicationRead]:
    """Get all shortlisted job applications for the employer's organization."""
    org_id = _require_employer(current_user)
    
    # Get all job IDs for this organization
    job_ids = [
        j.id for j in session.query(JobORM.id).filter(JobORM.org_id == org_id).all()
    ]
    
    if not job_ids:
        return []
    
    # Get shortlisted applications for these jobs
    apps = (
        session.query(JobApplicationORM)
        .filter(JobApplicationORM.job_id.in_(job_ids))
        .filter(JobApplicationORM.shortlisted == True)
        .order_by(JobApplicationORM.updated_at.desc())
        .all()
    )
    
    return [JobApplicationRead.model_validate(app, from_attributes=True) for app in apps]


# ---- Applicant Detail -------------------------------------------

@router.get("/applicants/{application_id}/detail", response_model=ApplicantDetailRead)
def get_applicant_detail(
    application_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ApplicantDetailRead:
    """Get comprehensive applicant detail for employer review."""
    org_id = _require_employer(current_user)
    
    # Try internship application first
    app = session.query(ApplicationORM).filter_by(id=application_id).first()
    application_type = "internship"
    
    if not app:
        # Try job application
        app = session.query(JobApplicationORM).filter_by(id=application_id).first()
        application_type = "job"
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Verify the application belongs to this organization
    if application_type == "internship":
        placement = session.query(PlacementORM).filter_by(id=app.placement_id).first()
        if not placement or placement.org_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this application")
        placement_title = placement.title
        placement_opportunity_type = placement.opportunity_type
        job_id = None
        job_title = None
    else:
        job = session.query(JobORM).filter_by(id=app.job_id).first()
        if not job or job.org_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this application")
        job_id = job.id
        job_title = job.title
        placement_id = None
        placement_title = None
        placement_opportunity_type = None
    
    # Get student profile
    student_profile = session.query(StudentProfileORM).filter_by(user_id=app.user_id).first()
    user = session.query(UserORM).filter_by(id=app.user_id).first()
    
    # Get documents
    from app.infrastructure.orm import StudentDocumentORM
    documents = session.query(StudentDocumentORM).filter_by(user_id=app.user_id).all()
    
    # Calculate match score if internship
    match_score = None
    if application_type == "internship" and placement and student_profile:
        from app.domain.matching import match_placement, required_skills_for
        from app.infrastructure.repositories import SqlAlchemyPlacementRepository
        repo = SqlAlchemyPlacementRepository(session)
        placement_domain = repo.get(placement.id)
        if placement_domain:
            match_result = match_placement(
                placement_domain,
                student_profile.skills or [],
                student_profile.course or "",
                student_profile.cgpa or 0.0,
            )
            required = required_skills_for(placement_domain)
            match_score = ApplicantMatchScore(
                score=match_result.score,
                matched_skills=match_result.matched,
                missing_skills=match_result.missing,
                course_fit=match_result.course_fit,
                grade_fit=match_result.grade_fit,
            )
    
    return ApplicantDetailRead(
        application_id=app.id,
        application_type=application_type,
        status=app.status,
        statement=app.statement or "",
        cover_letter=app.cover_letter or "",
        cv_url=app.cv_url,
        github_url=app.github_url,
        linkedin_url=app.linkedin_url,
        portfolio_url=app.portfolio_url,
        academic_papers=app.academic_papers or [],
        reference_1_name=app.reference_1_name or "",
        reference_1_email=app.reference_1_email or "",
        reference_1_phone=app.reference_1_phone or "",
        reference_1_relationship=app.reference_1_relationship or "",
        reference_2_name=app.reference_2_name or "",
        reference_2_email=app.reference_2_email or "",
        reference_2_phone=app.reference_2_phone or "",
        reference_2_relationship=app.reference_2_relationship or "",
        document_ids=app.document_ids or [],
        shortlisted=app.shortlisted,
        created_at=app.created_at,
        updated_at=app.updated_at,
        student_id=app.user_id,
        student_name=user.name if user else "",
        student_email=user.email if user else "",
        student_course=student_profile.course if student_profile else "",
        student_year=student_profile.year if student_profile else "",
        student_cgpa=student_profile.cgpa if student_profile else 0.0,
        student_university=student_profile.university if student_profile else "",
        student_skills=student_profile.skills if student_profile else [],
        talent_search_opt_in=student_profile.talent_search_opt_in if student_profile else False,
        placement_id=app.placement_id if application_type == "internship" else None,
        placement_title=placement_title,
        placement_opportunity_type=placement_opportunity_type,
        job_id=job_id,
        job_title=job_title,
        documents=[StudentDocumentRead.model_validate(d, from_attributes=True) for d in documents],
        match_score=match_score,
    )


# ---- Talent Search -------------------------------------------

class TalentSearchFilters(BaseModel):
    skills: list[str] = []
    course: Optional[str] = None
    location: Optional[str] = None
    university: Optional[str] = None
    limit: int = 20
    offset: int = 0


@router.post("/talent-search", response_model=list[StudentProfileRead])
def search_student_profiles(
    filters: TalentSearchFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[StudentProfileRead]:
    """Search verified student profiles who opted into talent search.
    
    Only returns students with talent_search_opt_in=True.
    Filters by skills (ALL must match), course, location, and university.
    """
    org_id = _require_employer(current_user)
    
    # Query student profiles that opted into talent search
    query = session.query(StudentProfileORM).filter(
        StudentProfileORM.talent_search_opt_in == True
    )
    
    # Join with users to get location/university info
    query = query.join(UserORM, StudentProfileORM.user_id == UserORM.id)
    
    # Filter by skills - ALL skills must match (AND logic)
    if filters.skills:
        for skill in filters.skills:
            query = query.filter(StudentProfileORM.skills.op("@>")([skill]))
    
    if filters.course:
        query = query.filter(StudentProfileORM.course.ilike(f"%{filters.course}%"))
    
    if filters.university:
        query = query.filter(StudentProfileORM.university.ilike(f"%{filters.university}%"))
    
    if filters.location:
        # Filter by user location (org location or student location)
        query = query.filter(UserORM.loc.ilike(f"%{filters.location}%"))
    
    query = query.offset(filters.offset).limit(filters.limit)
    
    profiles = query.all()
    return [StudentProfileRead.model_validate(p, from_attributes=True) for p in profiles]


@router.get("/talent-search/courses", response_model=list[str])
def get_talent_search_courses(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Get unique courses from students who opted into talent search."""
    _require_employer(current_user)
    
    courses = (
        session.query(StudentProfileORM.course)
        .filter(StudentProfileORM.talent_search_opt_in == True)
        .filter(StudentProfileORM.course != "")
        .distinct()
        .all()
    )
    return sorted([c[0] for c in courses if c[0]])


@router.get("/talent-search/locations", response_model=list[str])
def get_talent_search_locations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Get unique locations from students who opted into talent search."""
    _require_employer(current_user)
    
    locations = (
        session.query(UserORM.loc)
        .join(StudentProfileORM, UserORM.id == StudentProfileORM.user_id)
        .filter(StudentProfileORM.talent_search_opt_in == True)
        .filter(UserORM.loc != "")
        .distinct()
        .all()
    )
    return sorted([l[0] for l in locations if l[0]])


@router.get("/talent-search/universities", response_model=list[str])
def get_talent_search_universities(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Get unique universities from students who opted into talent search."""
    _require_employer(current_user)
    
    unis = (
        session.query(StudentProfileORM.university)
        .filter(StudentProfileORM.talent_search_opt_in == True)
        .filter(StudentProfileORM.university != "")
        .distinct()
        .all()
    )
    return sorted([u[0] for u in unis if u[0]])


# ---- Employer Hiring Funnel Analytics -------------------------------------------

@router.get("/analytics/hiring-funnel", response_model=EmployerHiringFunnelAnalytics)
def get_employer_hiring_funnel_analytics(
    period_start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    period_end: str = Query(..., description="End date (YYYY-MM-DD)"),
    placement_id: str = Query(None, description="Filter by specific placement ID"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> EmployerHiringFunnelAnalytics:
    """Get hiring funnel analytics for the employer's organization."""
    org_id = _require_employer(current_user)
    
    start = date.fromisoformat(period_start)
    end = date.fromisoformat(period_end)
    
    # Get all placements for this org
    placements_query = session.query(PlacementORM).filter(
        PlacementORM.org_id == org_id,
        PlacementORM.published_at >= start.isoformat(),
        PlacementORM.published_at <= end.isoformat()
    )
    
    # Get all jobs for this org
    jobs_query = session.query(JobORM).filter(
        JobORM.org_id == org_id,
        JobORM.published_at >= start.isoformat(),
        JobORM.published_at <= end.isoformat()
    )
    
    if placement_id:
        placements_query = placements_query.filter(PlacementORM.id == placement_id)
        jobs_query = jobs_query.filter(False)
    
    placements = placements_query.all()
    jobs = jobs_query.all()
    
    # Get applications
    placement_ids = [p.id for p in placements]
    job_ids = [j.id for j in jobs]
    
    internship_apps = []
    if placement_ids:
        internship_apps = session.query(ApplicationORM).filter(
            ApplicationORM.placement_id.in_(placement_ids),
            ApplicationORM.created_at >= start.isoformat(),
            ApplicationORM.created_at <= end.isoformat()
        ).all()
    
    job_apps = []
    if job_ids:
        job_apps = session.query(JobApplicationORM).filter(
            JobApplicationORM.job_id.in_(job_ids),
            JobApplicationORM.created_at >= start.isoformat(),
            JobApplicationORM.created_at <= end.isoformat()
        ).all()
    
    all_apps = internship_apps + job_apps
    
    # Applications by status
    apps_by_status = {}
    for app in all_apps:
        apps_by_status[app.status] = apps_by_status.get(app.status, 0) + 1
    
    # Applications by type
    apps_by_type = {
        "internship": len([a for a in internship_apps if a.placement_id and (session.query(PlacementORM).filter_by(id=a.placement_id).first().opportunity_type or "internship") == "internship"]),
        "job": len(job_apps),
        "gig": len([a for a in internship_apps if a.placement_id and session.query(PlacementORM).filter_by(id=a.placement_id).first().opportunity_type == "gig"]),
        "entry_level": len([a for a in internship_apps if a.placement_id and session.query(PlacementORM).filter_by(id=a.placement_id).first().opportunity_type == "entry_level"]),
    }
    
    # Funnel stages
    total_apps = len(all_apps)
    submitted = len([a for a in all_apps if a.status in ["Submitted", "Pending"]])
    in_review = len([a for a in all_apps if a.status == "In Review"])
    accepted = len([a for a in all_apps if a.status == "Accepted"])
    rejected = len([a for a in all_apps if a.status == "Rejected"])
    withdrawn = len([a for a in all_apps if a.status == "Withdrawn"])
    
    stages = []
    prev_count = total_apps
    for stage_name, count in [
        ("Submitted", submitted),
        ("In Review", in_review),
        ("Accepted", accepted),
    ]:
        rate = round((count / prev_count * 100) if prev_count > 0 else 0, 2)
        stages.append(FunnelStageMetrics(
            stage=stage_name,
            count=count,
            conversion_rate=rate,
            avg_days_in_stage=None
        ))
        prev_count = count
    
    # Conversion by posting
    conversion_by_posting = []
    for p in placements:
        p_apps = [a for a in internship_apps if a.placement_id == p.id]
        p_accepted = len([a for a in p_apps if a.status == "Accepted"])
        p_total = len(p_apps)
        conversion_by_posting.append({
            "placement_id": p.id,
            "placement_title": p.title,
            "opportunity_type": p.opportunity_type or "internship",
            "total_applications": p_total,
            "accepted": p_accepted,
            "conversion_rate": round((p_accepted / p_total * 100) if p_total > 0 else 0, 2)
        })
    
    for j in jobs:
        j_apps = [a for a in job_apps if a.job_id == j.id]
        j_accepted = len([a for a in j_apps if a.status == "Accepted"])
        j_total = len(j_apps)
        conversion_by_posting.append({
            "placement_id": j.id,
            "placement_title": j.title,
            "opportunity_type": "job",
            "total_applications": j_total,
            "accepted": j_accepted,
            "conversion_rate": round((j_accepted / j_total * 100) if j_total > 0 else 0, 2)
        })
    
    # Top skills in demand
    skill_counts = {}
    for p in placements:
        if p.skills_required:
            for skill in p.skills_required:
                skill_counts[skill] = skill_counts.get(skill, 0) + 1
    for j in jobs:
        if j.requirements:
            for skill in j.requirements:
                skill_counts[skill] = skill_counts.get(skill, 0) + 1
    
    top_skills = [{"skill": s, "count": c} for s, c in sorted(skill_counts.items(), key=lambda x: -x[1])[:15]]
    
    return EmployerHiringFunnelAnalytics(
        organization_id=org_id,
        period_start=period_start,
        period_end=period_end,
        total_postings=len(placements) + len(jobs),
        total_applications=len(all_apps),
        applications_by_status=apps_by_status,
        applications_by_type=apps_by_type,
        stages=stages,
        avg_time_to_hire_days=None,
        top_skills_in_demand=top_skills,
        conversion_by_posting=conversion_by_posting,
    )
