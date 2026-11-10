"""Public Jobs Portal catalogue and application endpoints."""
from typing import Optional
from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.application.ports import JobApplicationRepository, SavedJobsRepository
from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.orm import JobApplicationORM, JobORM
from app.infrastructure.repositories import SqlAlchemyJobRepository
from app.presentation.deps import get_current_user, get_job_application_repository, get_saved_jobs_repository
from app.presentation.schemas import (
    JobListResponse,
    JobRead,
    JobApplicationRead,
    JobApplicationCreate,
    JobApplicationListResponse,
    JobApplicationStatusUpdate,
)
from sqlalchemy.orm import Session

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=JobListResponse)
def list_jobs(
    q: Optional[str] = None,
    location: Optional[str] = None,
    mode: Optional[str] = None,
    session: Session = Depends(get_session),
) -> JobListResponse:
    items = SqlAlchemyJobRepository(session).list(q=q, location=location, mode=mode)
    return JobListResponse(total=len(items), items=[JobRead.model_validate(item) for item in items])


# ---- Saved Jobs (must come before /{job_id} to avoid route conflicts) ----

@router.get("/saved", response_model=list[str])
def list_saved_jobs(
    current_user: User = Depends(get_current_user),
    repo: SavedJobsRepository = Depends(get_saved_jobs_repository),
) -> list[str]:
    """Get list of saved job IDs for the current user."""
    return repo.list(current_user.id)


@router.get("/saved/{job_id}", response_model=bool)
def check_saved_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    repo: SavedJobsRepository = Depends(get_saved_jobs_repository),
) -> bool:
    """Check if a job is saved by the current user."""
    return repo.is_saved(current_user.id, job_id)


@router.post("/saved/{job_id}/toggle", response_model=bool)
def toggle_saved_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    repo: SavedJobsRepository = Depends(get_saved_jobs_repository),
) -> bool:
    """Toggle save/unsave for a job. Returns new saved state."""
    return repo.toggle(current_user.id, job_id)


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: str, session: Session = Depends(get_session)) -> JobRead:
    job = SqlAlchemyJobRepository(session).get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobRead.model_validate(job)


@router.post("/{job_id}/apply", response_model=JobApplicationRead, status_code=201)
def apply_to_job(
    job_id: str,
    payload: JobApplicationCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    repo: JobApplicationRepository = Depends(get_job_application_repository),
) -> JobApplicationRead:
    """Submit an application to a job posting."""
    # Check if job exists and is open
    job = session.query(JobORM).filter_by(id=job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "Open":
        raise HTTPException(status_code=409, detail="Job is not accepting applications")

    # Check if already applied
    existing = repo.find(current_user.id, job_id)
    if existing:
        raise HTTPException(status_code=409, detail="Already applied to this job")

    # Create application with all rich data
    now = datetime.utcnow().isoformat()
    application = repo.add(
        repo._to_domain(
            JobApplicationORM(
                id=f"ja-{uuid4().hex[:12]}",
                user_id=current_user.id,
                job_id=job_id,
                status="Submitted",
                statement=payload.statement,
                cover_letter=payload.cover_letter,
                cv_url=payload.cv_url,
                github_url=payload.github_url,
                linkedin_url=payload.linkedin_url,
                portfolio_url=payload.portfolio_url,
                academic_papers=payload.academic_papers,
                reference_1_name=payload.reference_1_name,
                reference_1_email=payload.reference_1_email,
                reference_1_phone=payload.reference_1_phone,
                reference_1_relationship=payload.reference_1_relationship,
                reference_2_name=payload.reference_2_name,
                reference_2_email=payload.reference_2_email,
                reference_2_phone=payload.reference_2_phone,
                reference_2_relationship=payload.reference_2_relationship,
                document_ids=payload.document_ids,
                shortlisted=False,
                created_at=now,
                updated_at=now,
            )
        )
    )

    # Increment applicant count
    job.applicants = (job.applicants or 0) + 1
    session.commit()

    return JobApplicationRead.model_validate(application)


@router.get("/my/applications", response_model=JobApplicationListResponse)
def list_my_job_applications(
    current_user: User = Depends(get_current_user),
    repo: JobApplicationRepository = Depends(get_job_application_repository),
) -> JobApplicationListResponse:
    """Get all job applications for the current user."""
    applications = repo.list_for_user(current_user.id)
    return JobApplicationListResponse(total=len(applications), items=applications)


@router.get("/{job_id}/applicants", response_model=JobApplicationListResponse)
def list_job_applicants(
    job_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    repo: JobApplicationRepository = Depends(get_job_application_repository),
) -> JobApplicationListResponse:
    """Get all applicants for a job (employer only)."""
    # Verify the user is an employer and owns this job
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can view applicants")

    job = session.query(JobORM).filter_by(id=job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not authorized to view applicants for this job")

    applications = repo.list_for_job(job_id)
    return JobApplicationListResponse(total=len(applications), items=applications)


@router.patch("/applications/{application_id}/status", response_model=JobApplicationRead)
def update_job_application_status(
    application_id: str,
    payload: JobApplicationStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    repo: JobApplicationRepository = Depends(get_job_application_repository),
) -> JobApplicationRead:
    """Update application status (employer only)."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can update application status")

    # Verify the application belongs to a job owned by this employer
    app_orm = session.query(JobApplicationORM).filter_by(id=application_id).first()
    if app_orm is None:
        raise HTTPException(status_code=404, detail="Application not found")

    job = session.query(JobORM).filter_by(id=app_orm.job_id).first()
    if job is None or job.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this application")

    valid_statuses = ["Submitted", "In Review", "Accepted", "Rejected", "Withdrawn"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    updated = repo.update_status(application_id, payload.status)
    if updated is None:
        raise HTTPException(status_code=404, detail="Application not found")

    return JobApplicationRead.model_validate(updated)


@router.patch("/applications/{application_id}/shortlist", response_model=JobApplicationRead)
def toggle_job_application_shortlist(
    application_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JobApplicationRead:
    """Toggle shortlist status for a job application (employer only)."""
    if current_user.role != "employer" or not current_user.org_id:
        raise HTTPException(status_code=403, detail="Only employers can shortlist applications")

    # Verify the application belongs to a job owned by this employer
    app_orm = session.query(JobApplicationORM).filter_by(id=application_id).first()
    if app_orm is None:
        raise HTTPException(status_code=404, detail="Application not found")

    job = session.query(JobORM).filter_by(id=app_orm.job_id).first()
    if job is None or job.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not authorized to shortlist this application")

    # Toggle shortlisted status
    app_orm.shortlisted = not app_orm.shortlisted
    app_orm.updated_at = datetime.utcnow().isoformat()
    session.commit()

    return JobApplicationRead.model_validate(app_orm)


@router.post("/applications/{application_id}/withdraw", response_model=JobApplicationRead)
def withdraw_job_application(
    application_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    repo: JobApplicationRepository = Depends(get_job_application_repository),
) -> JobApplicationRead:
    """Withdraw a job application (jobseeker only)."""
    app_orm = session.query(JobApplicationORM).filter_by(id=application_id).first()
    if app_orm is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_orm.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to withdraw this application")

    updated = repo.update_status(application_id, "Withdrawn")
    if updated is None:
        raise HTTPException(status_code=404, detail="Application not found")

    # Decrement applicant count
    job = session.query(JobORM).filter_by(id=app_orm.job_id).first()
    if job:
        job.applicants = max(0, (job.applicants or 0) - 1)
        session.commit()

    return JobApplicationRead.model_validate(updated)