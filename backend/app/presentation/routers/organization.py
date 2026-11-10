"""Organization-scoped internship posting workflow."""
from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.orm import OrganisationORM, PlacementORM, JobORM
from app.presentation.deps import get_current_user
from app.presentation.schemas import (
    InternshipPostingCreate,
    InternshipPostingListResponse,
    InternshipPostingRead,
    JobPostingCreate,
    JobPostingListResponse,
    JobRead,
)
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
