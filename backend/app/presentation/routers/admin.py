"""Platform administrator internship review workflow."""
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.application.services import StudentDocumentService
from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.orm import (
    AdminActionLogORM,
    ApplicationORM,
    JobApplicationORM,
    OrganisationORM,
    PlacementORM,
    JobORM,
    StudentDocumentORM,
    UserORM,
)
from app.infrastructure.repositories import SqlAlchemyPlacementRepository
from app.presentation.deps import get_current_user, get_student_document_service, get_admin_action_log_repository
from app.presentation.schemas import (
    AdminActionLogRead,
    AdminActionLogListResponse,
    AdminActivityItem,
    AdminDashboardMetrics,
    AdminQueueItemRead,
    AdminQueueListResponse,
    AdminApplicationRead,
    AdminApplicationsResponse,
    AdminHiringFunnelAnalytics,
    FunnelStageMetrics,
    InternshipReviewListResponse,
    InternshipReviewRequest,
    InternshipPostingRead,
    JobPostingListResponse,
    JobReviewRequest,
    JobRead,
    OrganizationRead,
    OrganizationListResponse,
    OrganizationDetailResponse,
    OrganizationSanctionRequest,
    OrganizationSanctionResponse,
    UserRead,
    UserListResponse,
    UserDetailResponse,
    UserActionRequest,
    UserActionResponse,
    StudentDocumentRead,
    StudentDocumentVerifyRequest,
    StudentDocumentVerifyResponse,
    PlacementListResponse,
    ApplicationRead,
    ApplicationsResponse,
)
from fastapi.responses import StreamingResponse
import csv
import io

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
    
    # Additional KPIs
    total_users = session.query(UserORM).count()
    users_by_role = {}
    for role in ["student", "jobseeker", "employer", "admin", "employee"]:
        count = session.query(UserORM).filter(UserORM.role == role).count()
        users_by_role[role] = count
    
    total_organizations = session.query(OrganisationORM).count()
    total_applications = session.query(ApplicationORM).count()
    
    # Revenue from successful payments
    from app.infrastructure.orm import TransactionORM
    total_revenue_cents = session.query(func.sum(TransactionORM.amount_cents)).filter(
        TransactionORM.type == "payment",
        TransactionORM.status == "succeeded"
    ).scalar() or 0
    
    # Organisations by type
    org_types = {}
    for org_type in ["Company", "Government", "NGO", "University"]:
        count = session.query(OrganisationORM).filter(OrganisationORM.type == org_type).count()
        org_types[org_type] = count

    # Verification rate
    verified_docs = session.query(StudentDocumentORM).filter(StudentDocumentORM.status == "verified").count()
    total_docs = session.query(StudentDocumentORM).count()
    verification_rate = (verified_docs / total_docs * 100) if total_docs > 0 else 0.0
    
    return AdminDashboardMetrics(
        open_placements=open_placements,
        pending_documents=pending_documents,
        students_placed=students_placed,
        placement_record_complete=placement_record_complete,
        total_users=total_users,
        users_by_role=users_by_role,
        total_organizations=total_organizations,
        total_applications=total_applications,
        total_revenue_cents=total_revenue_cents,
        verification_rate=round(verification_rate, 1),
        org_types=org_types,
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
    role: str = Query(None, description="Filter by author role: student, employer, employee, admin"),
    service: StudentDocumentService = Depends(get_student_document_service),
    current_user: User = Depends(get_current_user),
) -> list[StudentDocumentRead]:
    """Get verified testimonials for the home page carousel.
    
    Public endpoint - no authentication required for the home page.
    Only returns verified testimonials with is_public=True.
    Supports optional role filter.
    """
    if current_user and current_user.role == "admin":
        # Admin can see all testimonials with any status
        documents = service.list_all(status=status if status != "all" else None)
    else:
        # Public endpoint - only verified and public testimonials
        if role:
            documents = service.list_public_testimonials_by_role(role=role, limit=limit)
        else:
            documents = service.list_public_testimonials(limit=limit)
    return [StudentDocumentRead.model_validate(d, from_attributes=True) for d in documents[:limit]]


# ---------------- Placement Management ------------------------------------

@router.get("/placements", response_model=PlacementListResponse)
def list_placements(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    review_status: str = Query(None, description="Filter by review status: pending_review, approved, rejected"),
    status: str = Query(None, description="Filter by status: Open, Closing, Closed"),
    org_id: str = Query(None, description="Filter by organization ID"),
    search: str = Query(None, description="Search by title"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PlacementListResponse:
    _require_admin(current_user)

    query = session.query(PlacementORM)

    if review_status:
        query = query.filter(PlacementORM.review_status == review_status)

    if status:
        query = query.filter(PlacementORM.status == status)

    if org_id:
        query = query.filter(PlacementORM.org_id == org_id)

    if search:
        query = query.filter(PlacementORM.title.ilike(f"%{search}%"))

    total = query.count()

    offset = (page - 1) * page_size
    rows = query.order_by(PlacementORM.published_at.desc()).offset(offset).limit(page_size).all()

    repo = SqlAlchemyPlacementRepository(session)
    items = []
    for row in rows:
        placement = repo.get(row.id)
        if placement:
            items.append(placement)

    return PlacementListResponse(total=total, items=items)


@router.patch("/placements/{placement_id}/close", response_model=InternshipPostingRead)
def close_placement(
    placement_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InternshipPostingRead:
    """Admin manually closes a placement (e.g., closing date reached, filled, or cancelled)."""
    _require_admin(current_user)
    row = session.get(PlacementORM, placement_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Placement not found")
    if row.status == "Closed":
        raise HTTPException(status_code=409, detail="Placement is already closed")
    row.status = "Closed"
    session.commit()
    placement = SqlAlchemyPlacementRepository(session).get(placement_id)
    if placement is None:
        raise HTTPException(status_code=500, detail="Placement could not be loaded after close")
    return InternshipPostingRead.model_validate(placement)


@router.patch("/placements/{placement_id}/reopen", response_model=InternshipPostingRead)
def reopen_placement(
    placement_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InternshipPostingRead:
    """Admin reopens a closed placement (e.g., revisited, extended, or reopened for applications)."""
    _require_admin(current_user)
    row = session.get(PlacementORM, placement_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Placement not found")
    if row.status == "Open":
        raise HTTPException(status_code=409, detail="Placement is already open")
    # Only reopen if it was previously approved
    if row.review_status != "approved":
        raise HTTPException(status_code=409, detail="Only approved placements can be reopened")
    row.status = "Open"
    session.commit()
    placement = SqlAlchemyPlacementRepository(session).get(placement_id)
    if placement is None:
        raise HTTPException(status_code=500, detail="Placement could not be loaded after reopen")
    return InternshipPostingRead.model_validate(placement)


# ---------------- Organization Management ------------------------------------

@router.get("/organizations", response_model=OrganizationListResponse)
def list_organizations(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    status: str = Query("all", description="Filter by status: active, inactive, all"),
    org_type: str = Query(None, description="Filter by type: Company, Government, NGO, University"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> OrganizationListResponse:
    _require_admin(current_user)
    
    query = session.query(OrganisationORM)
    
    if status != "all":
        if status == "active":
            query = query.filter(OrganisationORM.is_active == True)
        elif status == "inactive":
            query = query.filter(OrganisationORM.is_active == False)
    
    if org_type:
        query = query.filter(OrganisationORM.type == org_type)
    
    total = query.count()
    
    offset = (page - 1) * page_size
    orgs = query.offset(offset).limit(page_size).all()
    
    items = []
    for org in orgs:
        # Calculate stats for each org
        active_placements = session.query(PlacementORM).filter(
            PlacementORM.org_id == org.id,
            PlacementORM.review_status == "approved",
            PlacementORM.status == "Open"
        ).count()
        
        total_hired = session.query(ApplicationORM).filter(
            ApplicationORM.placement_id.in_(
                session.query(PlacementORM.id).filter(PlacementORM.org_id == org.id)
            ),
            ApplicationORM.status == "Accepted"
        ).count()
        
        active_postings = session.query(PlacementORM).filter(
            PlacementORM.org_id == org.id,
            PlacementORM.review_status == "approved",
            PlacementORM.status == "Open"
        ).count()
        
        # Revenue from this org
        from app.infrastructure.orm import TransactionORM
        total_revenue = session.query(func.sum(TransactionORM.amount_cents)).filter(
            TransactionORM.org_id == org.id,
            TransactionORM.type == "payment",
            TransactionORM.status == "succeeded"
        ).scalar() or 0
        
        # Compliance score based on document verification rate
        total_docs = session.query(StudentDocumentORM).join(ApplicationORM, StudentDocumentORM.user_id == ApplicationORM.user_id).join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id).filter(
            PlacementORM.org_id == org.id
        ).count()
        verified_docs = session.query(StudentDocumentORM).join(ApplicationORM, StudentDocumentORM.user_id == ApplicationORM.user_id).join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id).filter(
            PlacementORM.org_id == org.id,
            StudentDocumentORM.status == "verified"
        ).count()
        compliance_score = int((verified_docs / total_docs * 100)) if total_docs > 0 else 100
        
        # Subscription info
        from app.infrastructure.orm import SubscriptionORM
        sub = session.query(SubscriptionORM).filter(SubscriptionORM.org_id == org.id).first()
        subscription = {
            "plan": sub.plan if sub else "Free",
            "billing": sub.billing if sub else "",
            "seats": sub.seats if sub else 1,
            "status": sub.status if sub else "active",
        }
        
        items.append(OrganizationRead(
            id=org.id,
            name=org.name,
            type=org.type,
            sector=org.sector,
            loc=org.loc,
            seal=org.seal,
            about=org.about,
            billing_email=org.billing_email,
            tax_id=org.tax_id,
            billing_address=org.billing_address or {},
            created_at=org.created_at if hasattr(org, 'created_at') else "",
            is_active=org.is_active,
        ))
    
    return OrganizationListResponse(total=total, items=items)


@router.get("/organizations/{org_id}", response_model=OrganizationDetailResponse)
def get_organization_detail(
    org_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> OrganizationDetailResponse:
    _require_admin(current_user)
    
    org = session.query(OrganisationORM).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Calculate stats
    active_placements = session.query(PlacementORM).filter(
        PlacementORM.org_id == org.id,
        PlacementORM.review_status == "approved",
        PlacementORM.status == "Open"
    ).count()
    
    total_hired = session.query(ApplicationORM).filter(
        ApplicationORM.placement_id.in_(
            session.query(PlacementORM.id).filter(PlacementORM.org_id == org.id)
        ),
        ApplicationORM.status == "Accepted"
    ).count()
    
    active_postings = session.query(PlacementORM).filter(
        PlacementORM.org_id == org.id,
        PlacementORM.review_status == "approved",
        PlacementORM.status == "Open"
    ).count()
    
    from app.infrastructure.orm import TransactionORM
    total_revenue = session.query(func.sum(TransactionORM.amount_cents)).filter(
        TransactionORM.org_id == org.id,
        TransactionORM.type == "payment",
        TransactionORM.status == "succeeded"
    ).scalar() or 0
    
    active_postings_count = session.query(PlacementORM).filter(
        PlacementORM.org_id == org.id,
        PlacementORM.review_status == "approved",
        PlacementORM.status == "Open"
    ).count()
    
    # Compliance score
    total_docs = session.query(StudentDocumentORM).join(ApplicationORM, StudentDocumentORM.user_id == ApplicationORM.user_id).join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id).filter(
        PlacementORM.org_id == org.id
    ).count()
    verified_docs = session.query(StudentDocumentORM).join(ApplicationORM, StudentDocumentORM.user_id == ApplicationORM.user_id).join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id).filter(
        PlacementORM.org_id == org.id,
        StudentDocumentORM.status == "verified"
    ).count()
    compliance_score = int((verified_docs / total_docs * 100)) if total_docs > 0 else 100
    
    # Subscription info
    from app.infrastructure.orm import SubscriptionORM
    sub = session.query(SubscriptionORM).filter(SubscriptionORM.org_id == org.id).first()
    subscription = {
        "plan": sub.plan if sub else "Free",
        "billing": sub.billing if sub else "",
        "seats": sub.seats if sub else 1,
        "status": sub.status if sub else "active",
    }
    
    total_revenue = session.query(func.sum(TransactionORM.amount_cents)).filter(
        TransactionORM.org_id == org.id,
        TransactionORM.type == "payment",
        TransactionORM.status == "succeeded"
    ).scalar() or 0
    
    # Compliance score
    total_docs = session.query(StudentDocumentORM).join(ApplicationORM, StudentDocumentORM.user_id == ApplicationORM.user_id).join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id).filter(
        PlacementORM.org_id == org.id
    ).count()
    verified_docs = session.query(StudentDocumentORM).join(ApplicationORM, StudentDocumentORM.user_id == ApplicationORM.user_id).join(PlacementORM, ApplicationORM.placement_id == PlacementORM.id).filter(
        PlacementORM.org_id == org.id,
        StudentDocumentORM.status == "verified"
    ).count()
    compliance_score = int((verified_docs / total_docs * 100)) if total_docs > 0 else 100
    
    org_read = OrganizationRead(
        id=org.id,
        name=org.name,
        type=org.type,
        sector=org.sector,
        loc=org.loc,
        seal=org.seal,
        about=org.about,
        billing_email=org.billing_email,
        tax_id=org.tax_id,
        billing_address=org.billing_address or {},
        created_at=org.created_at if hasattr(org, 'created_at') else "",
        is_active=org.is_active,
    )
    
    return OrganizationDetailResponse(
        organization=org_read,
        stats={},
        active_placements=active_placements,
        total_hired=total_hired,
        total_revenue_cents=total_revenue,
        compliance_score=compliance_score,
        active_postings=active_postings,
        subscription=subscription,
        billing_email=org.billing_email,
        tax_id=org.tax_id,
    )


@router.patch("/organizations/{org_id}/sanction", response_model=OrganizationSanctionResponse)
def sanction_organization(
    org_id: str,
    payload: OrganizationSanctionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> OrganizationSanctionResponse:
    _require_admin(current_user)
    
    org = session.query(OrganisationORM).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    action = payload.action.strip().lower()
    reason = payload.reason.strip()
    
    if not reason:
        raise HTTPException(status_code=422, detail="Reason is required")
    
    if action == "suspend":
        org.is_active = False
        message = f"Organization suspended: {reason}"
    elif action == "unsuspend":
        org.is_active = True
        message = f"Organization unsuspended"
    elif action == "sanction":
        org.is_active = False
        message = f"Organization sanctioned: {reason}"
    else:
        raise HTTPException(status_code=422, detail="Invalid action. Must be: suspend, unsuspend, or sanction")
    
    session.commit()
    session.refresh(org)
    
    org_read = OrganizationRead(
        id=org.id,
        name=org.name,
        type=org.type,
        sector=org.sector,
        loc=org.loc,
        seal=org.seal,
        about=org.about,
        billing_email=org.billing_email,
        tax_id=org.tax_id,
        billing_address=org.billing_address or {},
        created_at=org.created_at if hasattr(org, 'created_at') else "",
        is_active=org.is_active,
    )
    
    return OrganizationSanctionResponse(
        organization=org_read,
        action=action,
        reason=reason,
        message=message,
    )


# ---------------- User Management ------------------------------------

@router.get("/users", response_model=UserListResponse)
def list_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    role: str = Query(None, description="Filter by role: student, employer, employee, admin, jobseeker"),
    status: str = Query("all", description="Filter by status: active, inactive, all"),
    deleted: str = Query("false", description="Filter by deleted status: true, false, all"),
    search: str = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> UserListResponse:
    _require_admin(current_user)
    
    query = session.query(UserORM)
    
    # Filter out deleted users by default
    if deleted == "false":
        query = query.filter(UserORM.deleted == False)
    elif deleted == "true":
        query = query.filter(UserORM.deleted == True)
    # if deleted == "all", no filter
    
    if role:
        query = query.filter(UserORM.role == role)
    
    if status != "all":
        if status == "active":
            query = query.filter(UserORM.is_active == True)
        elif status == "inactive":
            query = query.filter(UserORM.is_active == False)
    
    if search:
        query = query.filter(
            (UserORM.name.ilike(f"%{search}%")) | (UserORM.email.ilike(f"%{search}%"))
        )
    
    total = query.count()
    
    offset = (page - 1) * page_size
    users = query.offset(offset).limit(page_size).all()
    
    items = []
    for u in users:
        items.append(UserRead(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            org_id=u.org_id,
            created_at=u.created_at,
            is_active=u.is_active,
        ))
    
    return UserListResponse(total=total, items=items)


@router.get("/users/{user_id}", response_model=UserDetailResponse)
def get_user_detail(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserDetailResponse:
    _require_admin(current_user)
    
    user = session.query(UserORM).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get applications
    from app.infrastructure.orm import ApplicationORM, PlacementORM, StudentDocumentORM
    applications = session.query(ApplicationORM).filter_by(user_id=user_id).all()
    
    # Get documents
    documents = session.query(StudentDocumentORM).filter_by(user_id=user_id).all()
    
    # Get testimonials
    testimonials = session.query(StudentDocumentORM).filter_by(
        user_id=user_id, document_type="testimonial", status="verified"
    ).all()
    
    # Get applications for detail
    app_items = []
    for app in applications:
        placement = session.query(PlacementORM).filter_by(id=app.placement_id).first()
        org = session.query(OrganisationORM).filter_by(id=placement.org_id).first() if placement else None
        app_items.append({
            "id": app.id,
            "placement_id": app.placement_id,
            "placement_title": placement.title if placement else "Unknown",
            "organization": org.name if org else "Unknown",
            "status": app.status,
            "created_at": app.created_at,
        })
    
    doc_items = []
    for doc in documents:
        doc_items.append({
            "id": doc.id,
            "document_type": doc.document_type,
            "filename": doc.filename,
            "status": doc.status,
            "uploaded_at": doc.uploaded_at,
        })
    
    testimonial_items = []
    for t in testimonials:
        testimonial_items.append({
            "id": t.id,
            "filename": t.filename,
            "status": t.status,
            "uploaded_at": t.uploaded_at,
        })
    
    # Subscription info
    from app.infrastructure.orm import SubscriptionORM
    sub = session.query(SubscriptionORM).filter(SubscriptionORM.org_id == user.org_id).first() if user.org_id else None
    subscription = {
        "plan": sub.plan if sub else "Free",
        "billing": sub.billing if sub else "",
        "seats": sub.seats if sub else 1,
        "status": sub.status if sub else "active",
    } if sub else None
    
    return UserDetailResponse(
        user=UserRead(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            org_id=user.org_id,
            created_at=user.created_at,
            is_active=user.is_active,
        ),
        stats={
            "applications": len(applications),
            "documents": len(documents),
            "testimonials": len(testimonials),
        },
        applications_count=len(applications),
        documents_count=len(documents),
        testimonials_count=len(testimonials),
        applications=app_items,
        documents=doc_items,
        testimonials=testimonial_items,
        subscription=subscription,
    )


@router.patch("/users/{user_id}/action", response_model=UserActionResponse)
def user_action(
    user_id: str,
    payload: UserActionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    admin_log_repo=Depends(get_admin_action_log_repository),
) -> UserActionResponse:
    _require_admin(current_user)
    
    user = session.query(UserORM).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    action = payload.action.strip().lower()
    reason = payload.reason.strip()
    
    if not reason:
        raise HTTPException(status_code=422, detail="Reason is required")
    
    if action == "suspend":
        if not user.is_active:
            raise HTTPException(status_code=409, detail="User already suspended")
        user.is_active = False
        message = f"User suspended: {reason}"
    elif action == "activate":
        if user.is_active:
            raise HTTPException(status_code=409, detail="User already active")
        user.is_active = True
        message = f"User activated"
    elif action == "change_role":
        new_role = payload.new_role
        if not new_role or new_role not in ("student", "employer", "employee", "admin", "jobseeker"):
            raise HTTPException(status_code=422, detail="Invalid role")
        user.role = new_role
        message = f"User role changed to {new_role}"
    elif action == "delete":
        if user.deleted:
            raise HTTPException(status_code=409, detail="User already deleted")
        user.deleted = True
        user.deleted_at = datetime.utcnow().isoformat()
        user.is_active = False
        message = f"User deleted: {reason}"
    else:
        raise HTTPException(status_code=422, detail="Invalid action. Must be: suspend, activate, change_role, or delete")
    
    session.commit()
    session.refresh(user)
    
    # Log the admin action
    log = AdminActionLogORM(
        id=f"aal-{uuid4().hex[:12]}",
        admin_id=current_user.id,
        admin_email=current_user.email,
        target_user_id=user.id,
        target_user_email=user.email,
        action=action,
        reason=reason,
        details=f"Role: {user.role}, Active: {user.is_active}, Deleted: {user.deleted}",
        created_at=datetime.utcnow().isoformat(),
    )
    admin_log_repo.add(AdminActionLog(
        id=log.id,
        admin_id=log.admin_id,
        admin_email=log.admin_email,
        target_user_id=log.target_user_id,
        target_user_email=log.target_user_email,
        action=log.action,
        reason=log.reason,
        details=log.details,
        created_at=log.created_at,
    ))
    
    user_read = UserRead(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        org_id=user.org_id,
        created_at=user.created_at,
        is_active=user.is_active,
    )
    
    return UserActionResponse(
        user=user_read,
        action=action,
        reason=reason,
        message=message,
    )


@router.get("/action-logs", response_model=AdminActionLogListResponse)
def list_admin_action_logs(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    admin_id: str = Query(None, description="Filter by admin ID"),
    target_user_id: str = Query(None, description="Filter by target user ID"),
    action: str = Query(None, description="Filter by action"),
    start_date: str = Query(None, description="Filter by start date (ISO format)"),
    end_date: str = Query(None, description="Filter by end date (ISO format)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> AdminActionLogListResponse:
    _require_admin(current_user)
    
    repo = get_admin_action_log_repository(session)
    
    total = repo.count(
        admin_id=admin_id,
        target_user_id=target_user_id,
        action=action,
        start_date=start_date,
        end_date=end_date,
    )
    
    items = repo.list(
        admin_id=admin_id,
        target_user_id=target_user_id,
        action=action,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    
    return AdminActionLogListResponse(
        total=total,
        items=[AdminActionLogRead.model_validate(log) for log in items]
    )


# ---------------- Applications Management ------------------------------------

@router.get("/applications", response_model=AdminApplicationsResponse)
def list_all_applications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    type: str = Query(None, description="Filter by type: internship, job"),
    status: str = Query(None, description="Filter by status"),
    placement_id: str = Query(None, description="Filter by placement ID"),
    job_id: str = Query(None, description="Filter by job ID"),
    search: str = Query(None, description="Search by user email or name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> AdminApplicationsResponse:
    _require_admin(current_user)
    
    # Build internship applications query
    internship_query = session.query(ApplicationORM).join(UserORM, ApplicationORM.user_id == UserORM.id)
    if status:
        internship_query = internship_query.filter(ApplicationORM.status == status)
    if placement_id:
        internship_query = internship_query.filter(ApplicationORM.placement_id == placement_id)
    if search:
        internship_query = internship_query.filter(
            (UserORM.email.ilike(f"%{search}%")) | (UserORM.name.ilike(f"%{search}%"))
        )
    
    # Build job applications query
    job_query = session.query(JobApplicationORM).join(UserORM, JobApplicationORM.user_id == UserORM.id)
    if status:
        job_query = job_query.filter(JobApplicationORM.status == status)
    if job_id:
        job_query = job_query.filter(JobApplicationORM.job_id == job_id)
    if search:
        job_query = job_query.filter(
            (UserORM.email.ilike(f"%{search}%")) | (UserORM.name.ilike(f"%{search}%"))
        )
    
    # Apply type filter
    if type == "internship":
        job_query = job_query.filter(False)  # No results
    elif type == "job":
        internship_query = internship_query.filter(False)  # No results
    
    # Get total counts
    internship_total = internship_query.count()
    job_total = job_query.count()
    total = internship_total + job_total
    
    # Apply pagination - we need to combine and sort
    # For simplicity, fetch all and paginate in memory (could be optimized)
    internship_rows = internship_query.order_by(ApplicationORM.created_at.desc()).all()
    job_rows = job_query.order_by(JobApplicationORM.created_at.desc()).all()
    
    # Combine and sort by created_at
    all_apps = []
    for row in internship_rows:
        user = session.query(UserORM).filter_by(id=row.user_id).first()
        placement = session.query(PlacementORM).filter_by(id=row.placement_id).first()
        org = session.query(OrganisationORM).filter_by(id=placement.org_id).first() if placement else None
        all_apps.append({
            "id": row.id,
            "type": "internship",
            "user_id": row.user_id,
            "user_name": user.name if user else "",
            "user_email": user.email if user else "",
            "placement_id": row.placement_id,
            "placement_title": placement.title if placement else "",
            "job_id": None,
            "job_title": None,
            "organization": org.name if org else "",
            "status": row.status,
            "statement": row.statement,
            "cover_letter": row.cover_letter,
            "cv_url": row.cv_url,
            "github_url": row.github_url,
            "linkedin_url": row.linkedin_url,
            "portfolio_url": row.portfolio_url,
            "academic_papers": row.academic_papers,
            "reference_1_name": row.reference_1_name,
            "reference_1_email": row.reference_1_email,
            "reference_1_phone": row.reference_1_phone,
            "reference_1_relationship": row.reference_1_relationship,
            "reference_2_name": row.reference_2_name,
            "reference_2_email": row.reference_2_email,
            "reference_2_phone": row.reference_2_phone,
            "reference_2_relationship": row.reference_2_relationship,
            "document_ids": row.document_ids,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "shortlisted": getattr(row, 'shortlisted', False),
        })
    
    for row in job_rows:
        user = session.query(UserORM).filter_by(id=row.user_id).first()
        job = session.query(JobORM).filter_by(id=row.job_id).first()
        org = session.query(OrganisationORM).filter_by(id=job.org_id).first() if job else None
        all_apps.append({
            "id": row.id,
            "type": "job",
            "user_id": row.user_id,
            "user_name": user.name if user else "",
            "user_email": user.email if user else "",
            "placement_id": None,
            "placement_title": None,
            "job_id": row.job_id,
            "job_title": job.title if job else "",
            "organization": org.name if org else "",
            "status": row.status,
            "statement": row.statement,
            "cover_letter": row.cover_letter,
            "cv_url": row.cv_url,
            "github_url": row.github_url,
            "linkedin_url": row.linkedin_url,
            "portfolio_url": row.portfolio_url,
            "academic_papers": row.academic_papers,
            "reference_1_name": row.reference_1_name,
            "reference_1_email": row.reference_1_email,
            "reference_1_phone": row.reference_1_phone,
            "reference_1_relationship": row.reference_1_relationship,
            "reference_2_name": row.reference_2_name,
            "reference_2_email": row.reference_2_email,
            "reference_2_phone": row.reference_2_phone,
            "reference_2_relationship": row.reference_2_relationship,
            "document_ids": row.document_ids,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "shortlisted": getattr(row, 'shortlisted', False),
        })
    
    # Sort by created_at desc
    all_apps.sort(key=lambda x: x["created_at"], reverse=True)
    
    # Apply pagination
    offset = (page - 1) * page_size
    paginated = all_apps[offset:offset + page_size]
    
    return AdminApplicationsResponse(
        total=total,
        items=[AdminApplicationRead.model_validate(a) for a in paginated]
    )


# ---------------- Reports ------------------------------------

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

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

@router.post("/reports/placements", response_model=PlacementReportResponse)
def get_placements_report(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PlacementReportResponse:
    _require_admin(current_user)
    
    query = session.query(PlacementORM).join(OrganisationORM, PlacementORM.org_id == OrganisationORM.id)
    
    if filters.start_date:
        query = query.filter(PlacementORM.published_at >= filters.start_date)
    if filters.end_date:
        query = query.filter(PlacementORM.published_at <= filters.end_date)
    if filters.org_id:
        query = query.filter(PlacementORM.org_id == filters.org_id)
    if filters.placement_id:
        query = query.filter(PlacementORM.id == filters.placement_id)
    
    rows = query.order_by(PlacementORM.published_at.desc()).all()
    
    items = []
    for p in rows:
        org = session.query(OrganisationORM).filter_by(id=p.org_id).first()
        filled = session.query(ApplicationORM).filter(
            ApplicationORM.placement_id == p.id,
            ApplicationORM.status == "Accepted"
        ).count()
        items.append(PlacementReportItem(
            placement_id=p.id,
            title=p.title,
            organization=org.name if org else "",
            org_type=org.type if org else "",
            status=p.status,
            review_status=p.review_status,
            published_at=p.published_at,
            closes_at=p.closes_at,
            starts_at=p.starts_at,
            slots=p.slots,
            applicants=p.applicants,
            filled=filled,
            stipend=p.stipend,
            location=p.loc,
            mode=p.mode,
        ))
    
    total_placements = len(items)
    open_placements = sum(1 for i in items if i.status == "Open")
    total_slots = sum(i.slots for i in items)
    total_applicants = sum(i.applicants for i in items)
    total_filled = sum(i.filled for i in items)
    fill_rate = round((total_filled / total_slots * 100) if total_slots > 0 else 0, 1)
    
    return PlacementReportResponse(
        total=total_placements,
        items=items,
        summary={
            "total_placements": total_placements,
            "open_placements": open_placements,
            "total_slots": total_slots,
            "total_applicants": total_applicants,
            "total_filled": total_filled,
            "fill_rate_percent": fill_rate,
        }
    )


@router.post("/reports/applications", response_model=ApplicationReportResponse)
def get_applications_report(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ApplicationReportResponse:
    _require_admin(current_user)
    
    # Internship applications
    internship_query = session.query(ApplicationORM).join(UserORM, ApplicationORM.user_id == UserORM.id)
    if filters.start_date:
        internship_query = internship_query.filter(ApplicationORM.created_at >= filters.start_date)
    if filters.end_date:
        internship_query = internship_query.filter(ApplicationORM.created_at <= filters.end_date)
    if filters.placement_id:
        internship_query = internship_query.filter(ApplicationORM.placement_id == filters.placement_id)
    
    internship_apps = internship_query.order_by(ApplicationORM.created_at.desc()).all()
    
    # Job applications
    job_query = session.query(JobApplicationORM).join(UserORM, JobApplicationORM.user_id == UserORM.id)
    if filters.start_date:
        job_query = job_query.filter(JobApplicationORM.created_at >= filters.start_date)
    if filters.end_date:
        job_query = job_query.filter(JobApplicationORM.created_at <= filters.end_date)
    if filters.placement_id:
        job_query = job_query.filter(JobApplicationORM.job_id == filters.placement_id)
    
    job_apps = job_query.order_by(JobApplicationORM.created_at.desc()).all()
    
    users = {u.id: u for u in session.query(UserORM).all()}
    
    items = []
    for app in internship_apps:
        user = users.get(app.user_id)
        placement = session.query(PlacementORM).filter_by(id=app.placement_id).first()
        org = session.query(OrganisationORM).filter_by(id=placement.org_id).first() if placement else None
        items.append(ApplicationReportItem(
            application_id=app.id,
            type="internship",
            user_id=app.user_id,
            user_name=user.name if user else "",
            user_email=user.email if user else "",
            user_role=user.role if user else "",
            placement_id=app.placement_id,
            placement_title=placement.title if placement else "",
            job_id=None,
            job_title=None,
            organization=org.name if org else "",
            status=app.status,
            created_at=app.created_at,
            updated_at=app.updated_at,
        ))
    
    for app in job_apps:
        user = users.get(app.user_id)
        job = session.query(JobORM).filter_by(id=app.job_id).first()
        org = session.query(OrganisationORM).filter_by(id=job.org_id).first() if job else None
        items.append(ApplicationReportItem(
            application_id=app.id,
            type="job",
            user_id=app.user_id,
            user_name=user.name if user else "",
            user_email=user.email if user else "",
            user_role=user.role if user else "",
            placement_id=None,
            placement_title=None,
            job_id=app.job_id,
            job_title=job.title if job else "",
            organization=org.name if org else "",
            status=app.status,
            created_at=app.created_at,
            updated_at=app.updated_at,
        ))
    
    items.sort(key=lambda x: x.created_at, reverse=True)
    
    total = len(items)
    by_status = {}
    for item in items:
        by_status[item.status] = by_status.get(item.status, 0) + 1
    by_type = {"internship": 0, "job": 0}
    for item in items:
        by_type[item.type] += 1
    
    return ApplicationReportResponse(
        total=total,
        items=items,
        summary={
            "total_applications": total,
            "by_status": by_status,
            "by_type": by_type,
        }
    )


@router.post("/reports/hires", response_model=HireReportResponse)
def get_hires_report(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> HireReportResponse:
    _require_admin(current_user)
    
    query = session.query(ApplicationORM).join(UserORM, ApplicationORM.user_id == UserORM.id).join(
        PlacementORM, ApplicationORM.placement_id == PlacementORM.id
    ).join(OrganisationORM, PlacementORM.org_id == OrganisationORM.id).filter(
        ApplicationORM.status == "Accepted"
    )
    
    if filters.start_date:
        query = query.filter(ApplicationORM.updated_at >= filters.start_date)
    if filters.end_date:
        query = query.filter(ApplicationORM.updated_at <= filters.end_date)
    if filters.org_id:
        query = query.filter(OrganisationORM.id == filters.org_id)
    if filters.placement_id:
        query = query.filter(PlacementORM.id == filters.placement_id)
    
    rows = query.order_by(ApplicationORM.updated_at.desc()).all()
    
    items = []
    for app in rows:
        user = session.query(UserORM).filter_by(id=app.user_id).first()
        placement = session.query(PlacementORM).filter_by(id=app.placement_id).first()
        org = session.query(OrganisationORM).filter_by(id=placement.org_id).first() if placement else None
        items.append(HireReportItem(
            application_id=app.id,
            user_id=app.user_id,
            user_name=user.name if user else "",
            user_email=user.email if user else "",
            placement_id=app.placement_id,
            placement_title=placement.title if placement else "",
            organization=org.name if org else "",
            org_type=org.type if org else "",
            hired_at=app.updated_at,
            stipend=placement.stipend if placement else "",
            duration=placement.duration if placement else "",
        ))
    
    total = len(items)
    by_org_type = {}
    for item in items:
        by_org_type[item.org_type] = by_org_type.get(item.org_type, 0) + 1
    
    return HireReportResponse(
        total=total,
        items=items,
        summary={
            "total_hires": total,
            "by_org_type": by_org_type,
        }
    )


@router.post("/reports/verification", response_model=VerificationReportResponse)
def get_verification_report(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> VerificationReportResponse:
    _require_admin(current_user)
    
    query = session.query(StudentDocumentORM).join(UserORM, StudentDocumentORM.user_id == UserORM.id)
    
    if filters.start_date:
        query = query.filter(StudentDocumentORM.uploaded_at >= filters.start_date)
    if filters.end_date:
        query = query.filter(StudentDocumentORM.uploaded_at <= filters.end_date)
    if filters.placement_id:
        # Filter documents for users who applied to this placement
        user_ids = session.query(ApplicationORM.user_id).filter(
            ApplicationORM.placement_id == filters.placement_id
        ).subquery()
        query = query.filter(StudentDocumentORM.user_id.in_(user_ids))
    
    rows = query.order_by(StudentDocumentORM.uploaded_at.desc()).all()
    
    items = []
    for doc in rows:
        user = session.query(UserORM).filter_by(id=doc.user_id).first()
        items.append(VerificationReportItem(
            document_id=doc.id,
            user_id=doc.user_id,
            user_name=user.name if user else "",
            user_email=user.email if user else "",
            document_type=doc.document_type,
            filename=doc.filename,
            status=doc.status,
            uploaded_at=doc.uploaded_at,
            verified_at=None,  # Not tracked in current schema
            verified_by=None,
            rejection_reason=doc.rejection_reason,
        ))
    
    total = len(items)
    by_status = {}
    by_type = {}
    for item in items:
        by_status[item.status] = by_status.get(item.status, 0) + 1
        by_type[item.document_type] = by_type.get(item.document_type, 0) + 1
    verification_rate = round((by_status.get("verified", 0) / total * 100) if total > 0 else 0, 1)
    
    return VerificationReportResponse(
        total=total,
        items=items,
        summary={
            "total_documents": total,
            "by_status": by_status,
            "by_type": by_type,
            "verification_rate_percent": verification_rate,
        }
    )


# ---------------- CSV Exports for Reports ------------------------------------

@router.post("/export/reports/placements.csv")
def export_placements_report_csv(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    query = session.query(PlacementORM).join(OrganisationORM, PlacementORM.org_id == OrganisationORM.id)
    
    if filters.start_date:
        query = query.filter(PlacementORM.published_at >= filters.start_date)
    if filters.end_date:
        query = query.filter(PlacementORM.published_at <= filters.end_date)
    if filters.org_id:
        query = query.filter(PlacementORM.org_id == filters.org_id)
    if filters.placement_id:
        query = query.filter(PlacementORM.id == filters.placement_id)
    
    rows = query.order_by(PlacementORM.published_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Placement ID", "Title", "Organization", "Organization Type", "Status",
        "Review Status", "Published At", "Closes At", "Starts At",
        "Slots", "Applicants", "Filled", "Stipend", "Location", "Mode"
    ])
    
    for p in rows:
        org = session.query(OrganisationORM).filter_by(id=p.org_id).first()
        filled = session.query(ApplicationORM).filter(
            ApplicationORM.placement_id == p.id,
            ApplicationORM.status == "Accepted"
        ).count()
        writer.writerow([
            p.id, p.title, org.name if org else "", org.type if org else "",
            p.status, p.review_status, p.published_at, p.closes_at, p.starts_at,
            p.slots, p.applicants, filled, p.stipend, p.loc, p.mode
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=placements_report.csv"}
    )


@router.post("/export/reports/applications.csv")
def export_applications_report_csv(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    internship_query = session.query(ApplicationORM).join(UserORM, ApplicationORM.user_id == UserORM.id)
    if filters.start_date:
        internship_query = internship_query.filter(ApplicationORM.created_at >= filters.start_date)
    if filters.end_date:
        internship_query = internship_query.filter(ApplicationORM.created_at <= filters.end_date)
    if filters.placement_id:
        internship_query = internship_query.filter(ApplicationORM.placement_id == filters.placement_id)
    
    job_query = session.query(JobApplicationORM).join(UserORM, JobApplicationORM.user_id == UserORM.id)
    if filters.start_date:
        job_query = job_query.filter(JobApplicationORM.created_at >= filters.start_date)
    if filters.end_date:
        job_query = job_query.filter(JobApplicationORM.created_at <= filters.end_date)
    if filters.placement_id:
        job_query = job_query.filter(JobApplicationORM.job_id == filters.placement_id)
    
    internship_apps = internship_query.order_by(ApplicationORM.created_at.desc()).all()
    job_apps = job_query.order_by(JobApplicationORM.created_at.desc()).all()
    
    users = {u.id: u for u in session.query(UserORM).all()}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Application ID", "Type", "User ID", "User Name", "User Email", "User Role",
        "Placement ID", "Placement Title", "Job ID", "Job Title", "Organization",
        "Status", "Created At", "Updated At"
    ])
    
    for app in internship_apps:
        user = users.get(app.user_id)
        placement = session.query(PlacementORM).filter_by(id=app.placement_id).first()
        org = session.query(OrganisationORM).filter_by(id=placement.org_id).first() if placement else None
        writer.writerow([
            app.id, "internship", app.user_id, user.name if user else "", user.email if user else "", user.role if user else "",
            app.placement_id, placement.title if placement else "", "", "", org.name if org else "",
            app.status, app.created_at, app.updated_at
        ])
    
    for app in job_apps:
        user = users.get(app.user_id)
        job = session.query(JobORM).filter_by(id=app.job_id).first()
        org = session.query(OrganisationORM).filter_by(id=job.org_id).first() if job else None
        writer.writerow([
            app.id, "job", app.user_id, user.name if user else "", user.email if user else "", user.role if user else "",
            "", "", app.job_id, job.title if job else "", org.name if org else "",
            app.status, app.created_at, app.updated_at
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=applications_report.csv"}
    )


@router.post("/export/reports/hires.csv")
def export_hires_report_csv(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    query = session.query(ApplicationORM).join(UserORM, ApplicationORM.user_id == UserORM.id).join(
        PlacementORM, ApplicationORM.placement_id == PlacementORM.id
    ).join(OrganisationORM, PlacementORM.org_id == OrganisationORM.id).filter(
        ApplicationORM.status == "Accepted"
    )
    
    if filters.start_date:
        query = query.filter(ApplicationORM.updated_at >= filters.start_date)
    if filters.end_date:
        query = query.filter(ApplicationORM.updated_at <= filters.end_date)
    if filters.org_id:
        query = query.filter(OrganisationORM.id == filters.org_id)
    if filters.placement_id:
        query = query.filter(PlacementORM.id == filters.placement_id)
    
    rows = query.order_by(ApplicationORM.updated_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Application ID", "User ID", "User Name", "User Email",
        "Placement ID", "Placement Title", "Organization", "Organization Type",
        "Hired At", "Stipend", "Duration"
    ])
    
    for app in rows:
        user = session.query(UserORM).filter_by(id=app.user_id).first()
        placement = session.query(PlacementORM).filter_by(id=app.placement_id).first()
        org = session.query(OrganisationORM).filter_by(id=placement.org_id).first() if placement else None
        writer.writerow([
            app.id, app.user_id, user.name if user else "", user.email if user else "",
            app.placement_id, placement.title if placement else "", org.name if org else "", org.type if org else "",
            app.updated_at, placement.stipend if placement else "", placement.duration if placement else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hires_report.csv"}
    )


@router.post("/export/reports/verification.csv")
def export_verification_report_csv(
    filters: ReportFilters,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    query = session.query(StudentDocumentORM).join(UserORM, StudentDocumentORM.user_id == UserORM.id)
    
    if filters.start_date:
        query = query.filter(StudentDocumentORM.uploaded_at >= filters.start_date)
    if filters.end_date:
        query = query.filter(StudentDocumentORM.uploaded_at <= filters.end_date)
    if filters.placement_id:
        user_ids = session.query(ApplicationORM.user_id).filter(
            ApplicationORM.placement_id == filters.placement_id
        ).subquery()
        query = query.filter(StudentDocumentORM.user_id.in_(user_ids))
    
    rows = query.order_by(StudentDocumentORM.uploaded_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Document ID", "User ID", "User Name", "User Email",
        "Document Type", "Filename", "Status", "Uploaded At",
        "Rejection Reason"
    ])
    
    for doc in rows:
        user = session.query(UserORM).filter_by(id=doc.user_id).first()
        writer.writerow([
            doc.id, doc.user_id, user.name if user else "", user.email if user else "",
            doc.document_type, doc.filename, doc.status, doc.uploaded_at,
            doc.rejection_reason
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=verification_report.csv"}
    )


# ---------------- CSV Exports ------------------------------------

@router.get("/export/placements.csv")
def export_placements_csv(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    rows = session.query(PlacementORM).order_by(PlacementORM.published_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Title", "Organization ID", "Organization Name", "Organization Type",
        "Location", "Mode", "Duration", "Stipend", "Deadline", "Slots", "Status",
        "Applicants", "Review Status", "Published At", "Closes At", "Starts At",
        "Grade", "Courses", "Requirements", "Documents Required", "About", "Duties",
        "Opportunity Type", "Created At"
    ])
    
    for p in rows:
        org = session.query(OrganisationORM).filter_by(id=p.org_id).first()
        writer.writerow([
            p.id, p.title, p.org_id, org.name if org else "", org.type if org else "",
            p.loc, p.mode, p.duration, p.stipend, p.deadline, p.slots, p.status,
            p.applicants, p.review_status, p.published_at, p.closes_at, p.starts_at,
            p.grade, "; ".join(p.courses) if p.courses else "",
            "; ".join(p.requirements) if p.requirements else "",
            "; ".join(p.docs) if p.docs else "",
            p.about, "; ".join(p.duties) if p.duties else "",
            p.opportunity_type, p.created_at
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=placements.csv"}
    )


@router.get("/export/jobs.csv")
def export_jobs_csv(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    rows = session.query(JobORM).order_by(JobORM.published_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Title", "Organization ID", "Organization Name", "Organization Type",
        "Location", "Mode", "Employment Type", "Salary", "Closes At", "Summary",
        "Requirements", "Status", "Review Status", "Published At", "Applicants"
    ])
    
    for j in rows:
        org = session.query(OrganisationORM).filter_by(id=j.org_id).first()
        writer.writerow([
            j.id, j.title, j.org_id, org.name if org else "", org.type if org else "",
            j.loc, j.mode, j.employment_type, j.salary, j.closes_at, j.summary,
            "; ".join(j.requirements) if j.requirements else "",
            j.status, j.review_status, j.published_at, j.applicants or 0
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=jobs.csv"}
    )


@router.get("/export/placement/{placement_id}/applicants.csv")
def export_placement_applicants_csv(
    placement_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    placement = session.query(PlacementORM).filter_by(id=placement_id).first()
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found")
    
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
def export_job_applicants_csv(
    job_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    job = session.query(JobORM).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
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


@router.get("/export/applications.csv")
def export_all_applications_csv(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    
    # Get all internship applications
    internship_apps = session.query(ApplicationORM).join(UserORM, ApplicationORM.user_id == UserORM.id).all()
    # Get all job applications
    job_apps = session.query(JobApplicationORM).join(UserORM, JobApplicationORM.user_id == UserORM.id).all()
    
    users = {u.id: u for u in session.query(UserORM).all()}
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Application ID", "Type", "User ID", "User Name", "User Email", "Status",
        "Placement ID", "Placement Title", "Job ID", "Job Title",
        "Statement", "Cover Letter", "CV URL", "GitHub", "LinkedIn", "Portfolio",
        "Academic Papers", "Reference 1 Name", "Reference 1 Email", "Reference 1 Phone", "Reference 1 Relationship",
        "Reference 2 Name", "Reference 2 Email", "Reference 2 Phone", "Reference 2 Relationship",
        "Document IDs", "Applied At", "Updated At"
    ])
    
    for app in internship_apps:
        user = users.get(app.user_id)
        placement = session.query(PlacementORM).filter_by(id=app.placement_id).first()
        writer.writerow([
            app.id, "internship", app.user_id, user.name if user else "", user.email if user else "",
            app.status, app.placement_id, placement.title if placement else "", "", "",
            app.statement, app.cover_letter, app.cv_url or "",
            app.github_url or "", app.linkedin_url or "", app.portfolio_url or "",
            "; ".join(app.academic_papers) if app.academic_papers else "",
            app.reference_1_name, app.reference_1_email, app.reference_1_phone, app.reference_1_relationship,
            app.reference_2_name, app.reference_2_email, app.reference_2_phone, app.reference_2_relationship,
            "; ".join(app.document_ids) if app.document_ids else "",
            app.created_at, app.updated_at
        ])
    
    for app in job_apps:
        user = users.get(app.user_id)
        job = session.query(JobORM).filter_by(id=app.job_id).first()
        writer.writerow([
            app.id, "job", app.user_id, user.name if user else "", user.email if user else "",
            app.status, "", "", app.job_id, job.title if job else "",
            app.statement, app.cover_letter, app.cv_url or "",
            app.github_url or "", app.linkedin_url or "", app.portfolio_url or "",
            "; ".join(app.academic_papers) if app.academic_papers else "",
            app.reference_1_name, app.reference_1_email, app.reference_1_phone, app.reference_1_relationship,
            app.reference_2_name, app.reference_2_email, app.reference_2_phone, app.reference_2_relationship,
            "; ".join(app.document_ids) if app.document_ids else "",
            app.created_at, app.updated_at
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=all_applications.csv"}
    )


# ---- Hiring Funnel Analytics (Admin) -------------------------------------------

@router.get("/analytics/hiring-funnel", response_model=AdminHiringFunnelAnalytics)
def get_admin_hiring_funnel_analytics(
    period_start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    period_end: str = Query(..., description="End date (YYYY-MM-DD)"),
    org_type: str = Query(None, description="Filter by organization type"),
    opportunity_type: str = Query(None, description="Filter by opportunity type: internship, job, gig, entry_level"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AdminHiringFunnelAnalytics:
    """Get platform-wide hiring funnel analytics."""
    _require_admin(current_user)
    
    start = date.fromisoformat(period_start)
    end = date.fromisoformat(period_end)
    
    # Base queries filtered by date range
    placements_query = session.query(PlacementORM).filter(
        PlacementORM.published_at >= start.isoformat(),
        PlacementORM.published_at <= end.isoformat()
    )
    jobs_query = session.query(JobORM).filter(
        JobORM.published_at >= start.isoformat(),
        JobORM.published_at <= end.isoformat()
    )
    internship_apps_query = session.query(ApplicationORM).filter(
        ApplicationORM.created_at >= start.isoformat(),
        ApplicationORM.created_at <= end.isoformat()
    )
    job_apps_query = session.query(JobApplicationORM).filter(
        JobApplicationORM.created_at >= start.isoformat(),
        JobApplicationORM.created_at <= end.isoformat()
    )
    
    if org_type:
        org_ids = [o.id for o in session.query(OrganisationORM.id).filter(OrganisationORM.type == org_type).all()]
        placements_query = placements_query.filter(PlacementORM.org_id.in_(org_ids))
        jobs_query = jobs_query.filter(JobORM.org_id.in_(org_ids))
        internship_apps_query = internship_apps_query.filter(ApplicationORM.placement_id.in_(
            session.query(PlacementORM.id).filter(PlacementORM.org_id.in_(org_ids))
        ))
        job_apps_query = job_apps_query.filter(JobApplicationORM.job_id.in_(
            session.query(JobORM.id).filter(JobORM.org_id.in_(org_ids))
        ))
    
    if opportunity_type:
        if opportunity_type == "internship":
            jobs_query = jobs_query.filter(False)
            job_apps_query = job_apps_query.filter(False)
        elif opportunity_type == "job":
            placements_query = placements_query.filter(False)
            internship_apps_query = internship_apps_query.filter(False)
        elif opportunity_type in ["gig", "entry_level"]:
            # Filter placements by opportunity_type
            placements_query = placements_query.filter(PlacementORM.opportunity_type == opportunity_type)
            internship_apps_query = internship_apps_query.filter(ApplicationORM.placement_id.in_(
                session.query(PlacementORM.id).filter(PlacementORM.opportunity_type == opportunity_type)
            ))
            jobs_query = jobs_query.filter(False)
            job_apps_query = job_apps_query.filter(False)
    
    placements = placements_query.all()
    jobs = jobs_query.all()
    internship_apps = internship_apps_query.all()
    job_apps = job_apps_query.all()
    
    # Count applications by type
    apps_by_type = {
        "internship": len(internship_apps),
        "job": len(job_apps),
    }
    # Count by opportunity type from placements
    for p in placements:
        ot = p.opportunity_type or "internship"
        if ot in ["gig", "entry_level"]:
            apps_by_type[ot] = apps_by_type.get(ot, 0)
    
    # Count applications by status
    all_apps = internship_apps + job_apps
    apps_by_status = {}
    for app in all_apps:
        apps_by_status[app.status] = apps_by_status.get(app.status, 0) + 1
    
    # Overall funnel stages
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
    
    overall_rate = round((accepted / total_apps * 100) if total_apps > 0 else 0, 2)
    
    # Top organizations by hires
    org_hires = {}
    for app in all_apps:
        if app.status == "Accepted":
            if hasattr(app, 'placement_id') and app.placement_id:
                p = session.query(PlacementORM).filter_by(id=app.placement_id).first()
                if p:
                    org_hires[p.org_id] = org_hires.get(p.org_id, 0) + 1
            elif hasattr(app, 'job_id') and app.job_id:
                j = session.query(JobORM).filter_by(id=app.job_id).first()
                if j:
                    org_hires[j.org_id] = org_hires.get(j.org_id, 0) + 1
    
    top_orgs = []
    for org_id, hires in sorted(org_hires.items(), key=lambda x: -x[1])[:10]:
        org = session.query(OrganisationORM).filter_by(id=org_id).first()
        if org:
            top_orgs.append({"organization_id": org_id, "organization_name": org.name, "hires": hires})
    
    # Top skills platform-wide
    skill_counts = {}
    for app in all_apps:
        if hasattr(app, 'placement_id') and app.placement_id:
            p = session.query(PlacementORM).filter_by(id=app.placement_id).first()
            if p and p.skills_required:
                for skill in p.skills_required:
                    skill_counts[skill] = skill_counts.get(skill, 0) + 1
        elif hasattr(app, 'job_id') and app.job_id:
            j = session.query(JobORM).filter_by(id=app.job_id).first()
            if j and j.requirements:
                for skill in j.requirements:
                    skill_counts[skill] = skill_counts.get(skill, 0) + 1
    
    top_skills = [{"skill": s, "count": c} for s, c in sorted(skill_counts.items(), key=lambda x: -x[1])[:15]]
    
    # Conversion by org type
    org_type_conversion = {}
    for org_type_key in ["Company", "Government", "NGO", "University"]:
        org_ids = [o.id for o in session.query(OrganisationORM.id).filter(OrganisationORM.type == org_type_key).all()]
        if not org_ids:
            continue
        type_apps = [a for a in all_apps if 
            (hasattr(a, 'placement_id') and a.placement_id and session.query(PlacementORM).filter_by(id=a.placement_id).first().org_id in org_ids) or
            (hasattr(a, 'job_id') and a.job_id and session.query(JobORM).filter_by(id=a.job_id).first().org_id in org_ids)]
        type_accepted = len([a for a in type_apps if a.status == "Accepted"])
        type_total = len(type_apps)
        org_type_conversion[org_type_key] = round((type_accepted / type_total * 100) if type_total > 0 else 0, 2)
    
    # Conversion by opportunity type
    opp_type_conversion = {}
    for opp in ["internship", "job", "gig", "entry_level"]:
        if opp in ["gig", "entry_level"]:
            opp_apps = [a for a in internship_apps if a.placement_id and session.query(PlacementORM).filter_by(id=a.placement_id).first().opportunity_type == opp]
        elif opp == "internship":
            opp_apps = [a for a in internship_apps if a.placement_id and (session.query(PlacementORM).filter_by(id=a.placement_id).first().opportunity_type or "internship") == "internship"]
        else:
            opp_apps = job_apps
        opp_accepted = len([a for a in opp_apps if a.status == "Accepted"])
        opp_total = len(opp_apps)
        opp_type_conversion[opp] = round((opp_accepted / opp_total * 100) if opp_total > 0 else 0, 2)
    
    return AdminHiringFunnelAnalytics(
        period_start=period_start,
        period_end=period_end,
        total_organizations=len(set(p.org_id for p in placements) | set(j.org_id for j in jobs)),
        total_postings=len(placements) + len(jobs),
        total_applications=total_apps,
        applications_by_type=apps_by_type,
        applications_by_status=apps_by_status,
        overall_stages=stages,
        avg_time_to_hire_days=None,
        top_organizations_by_hires=top_orgs,
        top_skills_platform=top_skills,
        conversion_by_org_type=org_type_conversion,
        conversion_by_opportunity_type=opp_type_conversion,
    )
