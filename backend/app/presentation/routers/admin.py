"""Platform administrator internship review workflow."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.application.services import StudentDocumentService
from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.orm import (
    ApplicationORM,
    PlacementORM,
    JobORM,
    StudentDocumentORM,
    UserORM,
)
from app.infrastructure.repositories import SqlAlchemyPlacementRepository
from app.presentation.deps import get_current_user, get_student_document_service
from app.presentation.schemas import (
    AdminActivityItem,
    AdminDashboardMetrics,
    AdminQueueItemRead,
    AdminQueueListResponse,
    InternshipReviewListResponse,
    InternshipReviewRequest,
    InternshipPostingRead,
    JobPostingListResponse,
    JobReviewRequest,
    JobRead,
    StudentDocumentRead,
    StudentDocumentVerifyRequest,
    StudentDocumentVerifyResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only platform administrators can review internships")


@router.get("/metrics", response_model=AdminDashboardMetrics)
def get_admin_metrics(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AdminDashboardMetrics:
    _require_admin(current_user)
    open_placements = session.query(PlacementORM).filter(PlacementORM.review_status == "approved", PlacementORM.status == "Open").count()
    pending_documents = session.query(StudentDocumentORM).filter(StudentDocumentORM.status == "pending").count()
    students_placed = session.query(ApplicationORM).filter(ApplicationORM.status == "Accepted").count()
    total_students = session.query(UserORM).filter(UserORM.role == "student").count()
    placement_record_complete = int((students_placed / total_students * 100)) if total_students > 0 else 0
    return AdminDashboardMetrics(
        open_placements=open_placements,
        pending_documents=pending_documents,
        students_placed=students_placed,
        placement_record_complete=placement_record_complete,
    )


@router.get("/queue", response_model=AdminQueueListResponse)
def list_admin_queue(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AdminQueueListResponse:
    _require_admin(current_user)
    # Join applications with placements and users to build the queue
    rows = (
        session.query(ApplicationORM, PlacementORM, UserORM)
        .join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id)
        .join(UserORM, ApplicationORM.user_id == UserORM.id)
        .filter(ApplicationORM.status.in_(["Submitted", "In Review"]))
        .order_by(ApplicationORM.created_at.desc())
        .limit(50)
        .all()
    )
    items = []
    for app, placement, user in rows:
        # Count verified documents for this user
        verified_count = session.query(StudentDocumentORM).filter(
            StudentDocumentORM.user_id == user.id,
            StudentDocumentORM.status == "verified",
        ).count()
        required_count = len(placement.docs) if placement.docs else 0
        items.append(
            AdminQueueItemRead(
                n=user.name,
                i=user.id[:2].upper(),
                c=user.id[:8],  # placeholder - would need course from profile
                y="Year 3",  # placeholder
                p=placement.title,
                d=f"{verified_count} of {required_count}",
                st="Ready" if verified_count >= required_count else "Review",
            )
        )
    return AdminQueueListResponse(total=len(items), items=items)


@router.get("/activity", response_model=list[AdminActivityItem])
def list_admin_activity(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[AdminActivityItem]:
    _require_admin(current_user)
    # Recent activity: recent applications, document uploads, placement posts
    items = []

    # Recent applications
    recent_apps = (
        session.query(ApplicationORM, PlacementORM, UserORM)
        .join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id)
        .join(UserORM, ApplicationORM.user_id == UserORM.id)
        .order_by(ApplicationORM.created_at.desc())
        .limit(10)
        .all()
    )
    for app, placement, user in recent_apps:
        items.append(
            AdminActivityItem(
                who=user.name,
                action=f"applied to {placement.title}",
                time=app.created_at,
            )
        )

    # Recent document uploads
    recent_docs = (
        session.query(StudentDocumentORM, UserORM)
        .join(UserORM, StudentDocumentORM.user_id == UserORM.id)
        .order_by(StudentDocumentORM.uploaded_at.desc())
        .limit(10)
        .all()
    )
    for doc, user in recent_docs:
        items.append(
            AdminActivityItem(
                who=user.name,
                action=f"uploaded {doc.document_type}",
                time=doc.uploaded_at,
            )
        )

    # Recent placement posts
    recent_placements = (
        session.query(PlacementORM, UserORM)
        .join(UserORM, PlacementORM.org_id == UserORM.id)
        .order_by(PlacementORM.published_at.desc())
        .limit(5)
        .all()
    )
    for placement, org in recent_placements:
        items.append(
            AdminActivityItem(
                who=org.name,
                action=f"posted {placement.title}",
                time=placement.published_at,
            )
        )

    # Sort by time descending
    items.sort(key=lambda x: x.time, reverse=True)
    return items[:20]


@router.get("/internships/review", response_model=InternshipReviewListResponse)
def list_internship_review_queue(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InternshipReviewListResponse:
    _require_admin(current_user)
    rows = (
        session.query(PlacementORM)
        .filter(PlacementORM.review_status == "pending_review")
        .order_by(PlacementORM.published_at, PlacementORM.id)
        .all()
    )
    repo = SqlAlchemyPlacementRepository(session)
    items = [repo.get(row.id) for row in rows]
    resolved = [item for item in items if item is not None]
    return InternshipReviewListResponse(
        total=len(resolved),
        items=[InternshipPostingRead.model_validate(item) for item in resolved],
    )


@router.patch("/internships/{internship_id}/review", response_model=InternshipPostingRead)
def review_internship(
    internship_id: str,
    payload: InternshipReviewRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InternshipPostingRead:
    _require_admin(current_user)
    decision = payload.decision.strip().lower()
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="Decision must be approved or rejected")
    if decision == "rejected" and not payload.reason.strip():
        raise HTTPException(status_code=422, detail="A rejection reason is required")
    row = session.get(PlacementORM, internship_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Internship not found")
    if row.review_status != "pending_review":
        raise HTTPException(status_code=409, detail="Internship is not awaiting review")
    row.review_status = decision
    row.review_reason = payload.reason.strip() if decision == "rejected" else ""
    if decision == "approved":
        row.status = "Open"
        row.published_at = row.published_at or date.today().isoformat()
    else:
        row.status = "Closed"
    session.commit()
    placement = SqlAlchemyPlacementRepository(session).get(internship_id)
    if placement is None:
        raise HTTPException(status_code=500, detail="Reviewed internship could not be loaded")
    return InternshipPostingRead.model_validate(placement)


@router.get("/jobs/review", response_model=JobPostingListResponse)
def list_job_review_queue(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JobPostingListResponse:
    _require_admin(current_user)
    rows = session.query(JobORM).filter(JobORM.review_status == "pending_review").order_by(JobORM.published_at, JobORM.id).all()
    return JobPostingListResponse(
        total=len(rows),
        items=[JobRead.model_validate(row, from_attributes=True) for row in rows],
    )


@router.patch("/jobs/{job_id}/review", response_model=JobRead)
def review_job(
    job_id: str,
    payload: JobReviewRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> JobRead:
    _require_admin(current_user)
    decision = payload.decision.strip().lower()
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="Decision must be approved or rejected")
    if decision == "rejected" and not payload.reason.strip():
        raise HTTPException(status_code=422, detail="A rejection reason is required")
    row = session.get(JobORM, job_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if row.review_status != "pending_review":
        raise HTTPException(status_code=409, detail="Job is not awaiting review")
    row.review_status = decision
    row.review_reason = payload.reason.strip() if decision == "rejected" else ""
    row.status = "Open" if decision == "approved" else "Closed"
    session.commit()
    session.refresh(row)
    return JobRead.model_validate(row, from_attributes=True)


@router.get("/documents", response_model=list[StudentDocumentRead])
def list_all_documents(
    status: str = "pending",
    service: StudentDocumentService = Depends(get_student_document_service),
    current_user: User = Depends(get_current_user),
) -> list[StudentDocumentRead]:
    _require_admin(current_user)
    documents = service.list_all(status=status if status != "all" else None)
    return [StudentDocumentRead.model_validate(d, from_attributes=True) for d in documents]


@router.patch("/documents/{document_id}/verify", response_model=StudentDocumentVerifyResponse)
def verify_document(
    document_id: str,
    payload: StudentDocumentVerifyRequest,
    service: StudentDocumentService = Depends(get_student_document_service),
    current_user: User = Depends(get_current_user),
) -> StudentDocumentVerifyResponse:
    _require_admin(current_user)
    decision = payload.status.strip().lower()
    if decision not in ("verified", "rejected"):
        raise HTTPException(status_code=422, detail="Status must be 'verified' or 'rejected'")
    if decision == "rejected" and not payload.rejection_reason.strip():
        raise HTTPException(status_code=422, detail="A rejection reason is required")
    document = service.verify_document(
        document_id=document_id,
        status=decision,
        rejection_reason=payload.rejection_reason,
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return StudentDocumentVerifyResponse.model_validate(document, from_attributes=True)


@router.patch("/documents/{document_id}/public", response_model=StudentDocumentVerifyResponse)
def toggle_document_public(
    document_id: str,
    payload: dict,
    service: StudentDocumentService = Depends(get_student_document_service),
    current_user: User = Depends(get_current_user),
) -> StudentDocumentVerifyResponse:
    _require_admin(current_user)
    is_public = payload.get("is_public", False)
    document = service.set_document_public(document_id, is_public)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return StudentDocumentVerifyResponse.model_validate(document, from_attributes=True)


@router.get("/testimonials", response_model=list[StudentDocumentRead])
def list_testimonials(
    status: str = "verified",
    limit: int = 10,
    service: StudentDocumentService = Depends(get_student_document_service),
    current_user: User = Depends(get_current_user),
) -> list[StudentDocumentRead]:
    """Get verified testimonials for the home page carousel.
    
    Public endpoint - no authentication required for the home page.
    Only returns verified testimonials with is_public=True.
    """
    if current_user and current_user.role == "admin":
        # Admin can see all testimonials with any status
        documents = service.list_all(status=status if status != "all" else None)
    else:
        # Public endpoint - only verified and public testimonials
        documents = service.list_public_testimonials(limit=limit)
    return [StudentDocumentRead.model_validate(d, from_attributes=True) for d in documents[:limit]]
