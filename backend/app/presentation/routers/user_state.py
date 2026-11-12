"""B4 user-state endpoints — saved, applications and subscription.

R1d: identity is derived from the caller's Bearer token, not from a
``user_id``/``org_id`` the client sends. This is the security fix the roadmap
called for — a token is the single source of "who is acting", so a client can
no longer read or mutate another account's shortlist, applications or billing.

Grouped in one module because they share the same shape: a thin HTTP handler
that resolves the actor, calls an application service, and maps a domain error
to an HTTP status.
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.application.services import (
    ApplicationService,
    BillingService,
    SavedService,
    StudentProfileService,
    ResumeService,
    StudentDocumentService,
)
from app.core.errors import PlacementNotFound, PlacementNotOpen
from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.orm import ApplicationORM, ApplicationPackORM, PlacementORM
from app.presentation.deps import (
    get_application_service,
    get_billing_service,
    get_current_user,
    get_saved_service,
    get_student_profile_service,
    get_resume_service,
    get_student_document_service,
)
from app.presentation.schemas import (
    ActivatePlanRequest,
    ApplicationRead,
    ApplicationPackRead,
    ApplicationPackUpdate,
    ApplicationsResponse,
    ApplyRequest,
    CancelPlanRequest,
    SavedListResponse,
    SubscriptionRead,
    StudentProfileRead,
    StudentProfileUpdate,
    ResumeRead,
    StudentDocumentRead,
    StudentDocumentsResponse,
    ToggleSavedRequest,
    ToggleSavedResponse,
)

router = APIRouter(tags=["user-state"])


@router.get("/application-pack", response_model=ApplicationPackRead)
def get_application_pack(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ApplicationPackRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have application packs")
    pack = session.get(ApplicationPackORM, current_user.id)
    if pack is None:
        pack = ApplicationPackORM(user_id=current_user.id, statement="", targets=[])
        session.add(pack)
        session.commit()
        session.refresh(pack)
    return ApplicationPackRead.model_validate(pack, from_attributes=True)


@router.put("/application-pack", response_model=ApplicationPackRead)
def update_application_pack(
    payload: ApplicationPackUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ApplicationPackRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have application packs")
    pack = session.get(ApplicationPackORM, current_user.id)
    if pack is None:
        pack = ApplicationPackORM(user_id=current_user.id)
        session.add(pack)
    pack.statement = payload.statement.strip()[:600]
    pack.targets = list(dict.fromkeys(target.strip() for target in payload.targets if target.strip()))
    session.commit()
    session.refresh(pack)
    return ApplicationPackRead.model_validate(pack, from_attributes=True)


def _org_for(user: User, explicit: Optional[str]) -> str:
    """Resolve the organisation a subscription call acts on from the token.

    An employer is bound to the org linked on their account. An admin (who has
    no org of their own) may target one explicitly. Everyone else is refused —
    placement-fee billing is an employer concern, never a student one.
    """
    if user.role == "employer":
        if not user.org_id:
            raise HTTPException(
                status_code=403,
                detail="Employer account is not linked to an organisation",
            )
        return user.org_id
    if user.role == "admin":
        if explicit:
            return explicit
        raise HTTPException(status_code=400, detail="org_id is required for admin")
    raise HTTPException(status_code=403, detail="Not permitted for this role")


def _subscription_read(sub) -> SubscriptionRead:
    return SubscriptionRead(
        org_id=sub.org_id,
        plan=sub.plan,
        billing=sub.billing,
        seats=sub.seats,
        since=sub.since,
        is_premium=sub.is_premium,
    )


# ---- Saved -----------------------------------------------------------------

@router.get("/saved", response_model=SavedListResponse)
def list_saved(
    service: SavedService = Depends(get_saved_service),
    current_user: User = Depends(get_current_user),
) -> SavedListResponse:
    return SavedListResponse(saved_ids=service.list(current_user.id))


@router.post("/saved/toggle", response_model=ToggleSavedResponse)
def toggle_saved(
    payload: ToggleSavedRequest,
    service: SavedService = Depends(get_saved_service),
    current_user: User = Depends(get_current_user),
) -> ToggleSavedResponse:
    now_saved, ids = service.toggle(current_user.id, payload.placement_id)
    return ToggleSavedResponse(saved=now_saved, saved_ids=ids)


# ---- Applications ----------------------------------------------------------

@router.post("/applications", response_model=ApplicationRead, status_code=201)
def apply(
    payload: ApplyRequest,
    service: ApplicationService = Depends(get_application_service),
    current_user: User = Depends(get_current_user),
) -> ApplicationRead:
    try:
        app = service.apply(
            user_id=current_user.id,
            placement_id=payload.placement_id,
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
        )
    except PlacementNotFound as exc:
        raise HTTPException(status_code=404, detail=f"Placement {exc} not found")
    except PlacementNotOpen as exc:
        raise HTTPException(
            status_code=409, detail=f"Placement {exc} is closed to new applications"
        )
    return ApplicationRead.model_validate(app)


@router.get("/applications", response_model=ApplicationsResponse)
def list_my_applications(
    service: ApplicationService = Depends(get_application_service),
    current_user: User = Depends(get_current_user),
) -> ApplicationsResponse:
    items = service.list_for_user(current_user.id)
    return ApplicationsResponse(
        total=len(items), items=[ApplicationRead.model_validate(a) for a in items]
    )


@router.post("/applications/{application_id}/withdraw", response_model=ApplicationRead)
def withdraw_application(
    application_id: str,
    service: ApplicationService = Depends(get_application_service),
    current_user: User = Depends(get_current_user),
) -> ApplicationRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can withdraw applications")
    application = service.withdraw(
        user_id=current_user.id, application_id=application_id
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.status in ("Accepted", "Rejected"):
        raise HTTPException(status_code=409, detail="This application can no longer be withdrawn")
    return ApplicationRead.model_validate(application)


@router.patch("/applications/{application_id}/shortlist", response_model=ApplicationRead)
def toggle_application_shortlist(
    application_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ApplicationRead:
    """Toggle shortlist status for an internship application (employer only)."""
    if current_user.role not in ("employer", "admin"):
        raise HTTPException(status_code=403, detail="Only employers can shortlist applications")

    app_orm = session.query(ApplicationORM).filter_by(id=application_id).first()
    if app_orm is None:
        raise HTTPException(status_code=404, detail="Application not found")

    # Verify the employer owns this placement
    if current_user.role == "employer":
        placement = session.query(PlacementORM).filter_by(id=app_orm.placement_id).first()
        if placement is None or placement.org_id != current_user.org_id:
            raise HTTPException(status_code=403, detail="Not authorized to shortlist this application")

    # Toggle shortlisted status
    app_orm.shortlisted = not app_orm.shortlisted
    app_orm.updated_at = datetime.utcnow().isoformat()
    session.commit()

    return ApplicationRead.model_validate(app_orm)


@router.get(
    "/placements/{placement_id}/applicants", response_model=ApplicationsResponse
)
def list_applicants(
    placement_id: str,
    service: ApplicationService = Depends(get_application_service),
    current_user: User = Depends(get_current_user),
) -> ApplicationsResponse:
    # Only the hiring side (employer/admin) may see who applied to a placement.
    if current_user.role not in ("employer", "admin"):
        raise HTTPException(status_code=403, detail="Not permitted for this role")
    items = service.list_for_placement(placement_id)
    return ApplicationsResponse(
        total=len(items), items=[ApplicationRead.model_validate(a) for a in items]
    )


# ---- Student profile -------------------------------------------------------

@router.get("/profile", response_model=StudentProfileRead)
def get_profile(
    service: StudentProfileService = Depends(get_student_profile_service),
    current_user: User = Depends(get_current_user),
) -> StudentProfileRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have profiles")
    return StudentProfileRead.model_validate(
        service.get(current_user.id), from_attributes=True
    )


@router.put("/profile", response_model=StudentProfileRead)
def update_profile(
    payload: StudentProfileUpdate,
    service: StudentProfileService = Depends(get_student_profile_service),
    current_user: User = Depends(get_current_user),
) -> StudentProfileRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have profiles")
    profile = service.save(
        user_id=current_user.id,
        course=payload.course,
        year=payload.year,
        cgpa=payload.cgpa,
        university=payload.university,
        skills=payload.skills,
        skills_confidence=payload.skills_confidence,
        skills_source=payload.skills_source,
    )
    return StudentProfileRead.model_validate(profile, from_attributes=True)


# ---- Resume ----------------------------------------------------------------

@router.get("/resume", response_model=Optional[ResumeRead])
def get_resume(
    service: ResumeService = Depends(get_resume_service),
    current_user: User = Depends(get_current_user),
) -> Optional[ResumeRead]:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have resumes")
    resume = service.get(current_user.id)
    return (
        ResumeRead.model_validate(resume, from_attributes=True)
        if resume is not None
        else None
    )


@router.put("/resume", response_model=ResumeRead)
async def upload_resume(
    file: UploadFile = File(...),
    service: ResumeService = Depends(get_resume_service),
    current_user: User = Depends(get_current_user),
) -> ResumeRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have resumes")
    if file.content_type not in ("application/pdf", "application/msword",
                                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
        raise HTTPException(status_code=415, detail="Resume must be a PDF or Word document")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Resume file is empty")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Resume must be 10 MB or smaller")
    resume = service.save(
        user_id=current_user.id,
        filename=file.filename or "resume",
        content_type=file.content_type,
        content=content,
    )
    return ResumeRead.model_validate(resume, from_attributes=True)


@router.get("/resume/download")
def download_resume(
    service: ResumeService = Depends(get_resume_service),
    current_user: User = Depends(get_current_user),
) -> Response:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have resumes")
    resume = service.get(current_user.id)
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return Response(
        content=resume.content,
        media_type=resume.content_type,
        headers={"Content-Disposition": f'attachment; filename="{resume.filename}"'},
    )


# ---- Student documents -----------------------------------------------------

@router.get("/documents", response_model=StudentDocumentsResponse)
def list_documents(
    service: StudentDocumentService = Depends(get_student_document_service),
    current_user: User = Depends(get_current_user),
) -> StudentDocumentsResponse:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have documents")
    return StudentDocumentsResponse(
        items=[StudentDocumentRead.model_validate(d, from_attributes=True) for d in service.list(current_user.id)]
    )


@router.put("/documents/{document_type}", response_model=StudentDocumentRead)
async def upload_document(
    document_type: str,
    file: UploadFile = File(None),
    testimonial_text: str = Form(None),
    service: StudentDocumentService = Depends(get_student_document_service),
    current_user: User = Depends(get_current_user),
) -> StudentDocumentRead:
    # Allow all roles to upload testimonials, but only students for other document types
    if document_type == "testimonial":
        if current_user.role not in ("student", "employer", "employee", "admin"):
            raise HTTPException(status_code=403, detail="Only students, employers, employees, and admins can submit testimonials")
        # For testimonials, accept either file or text content
        if testimonial_text:
            content = testimonial_text.encode('utf-8')
            content_type = "text/plain"
            filename = "testimonial.txt"
        elif file:
            if file.content_type not in (
                "application/pdf",
                "image/jpeg",
                "image/png",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "text/plain",
            ):
                raise HTTPException(status_code=415, detail="Document must be PDF, JPG, PNG, Word, or plain text")
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Document file is empty")
            content_type = file.content_type
            filename = file.filename or "testimonial.txt"
        else:
            raise HTTPException(status_code=400, detail="Testimonial content is required (file or text)")
    else:
        if current_user.role != "student":
            raise HTTPException(status_code=403, detail="Only students have documents")
        if not file:
            raise HTTPException(status_code=400, detail="File is required")
        if file.content_type not in (
            "application/pdf",
            "image/jpeg",
            "image/png",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ):
            raise HTTPException(status_code=415, detail="Document must be PDF, JPG, PNG, or Word")
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Document file is empty")
        content_type = file.content_type
        filename = file.filename or document_type
    
    if document_type not in StudentDocumentService.ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Document must be 10 MB or smaller")
    try:
        document = service.save(
            user_id=current_user.id,
            document_type=document_type,
            filename=filename,
            content_type=content_type,
            content=content,
            author_role=current_user.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return StudentDocumentRead.model_validate(document, from_attributes=True)


# ---- Subscription ----------------------------------------------------------

@router.get("/subscription", response_model=SubscriptionRead)
def get_subscription(
    org_id: Optional[str] = Query(default=None),
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    return _subscription_read(service.get(_org_for(current_user, org_id)))


@router.post("/subscription/activate", response_model=SubscriptionRead)
def activate_plan(
    payload: ActivatePlanRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    org = _org_for(current_user, payload.org_id)
    s = service.activate(org, payload.plan, payload.billing, payload.seats)
    return _subscription_read(s)


@router.post("/subscription/cancel", response_model=SubscriptionRead)
def cancel_plan(
    payload: CancelPlanRequest,
    service: BillingService = Depends(get_billing_service),
    current_user: User = Depends(get_current_user),
) -> SubscriptionRead:
    org = _org_for(current_user, payload.org_id)
    return _subscription_read(service.cancel(org))
