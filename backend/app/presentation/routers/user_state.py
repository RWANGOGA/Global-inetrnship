"""B4 user-state endpoints — saved, applications and subscription.

R1d: identity is derived from the caller's Bearer token, not from a
``user_id``/``org_id`` the client sends. This is the security fix the roadmap
called for — a token is the single source of "who is acting", so a client can
no longer read or mutate another account's shortlist, applications or billing.

Grouped in one module because they share the same shape: a thin HTTP handler
that resolves the actor, calls an application service, and maps a domain error
to an HTTP status.
"""
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, Body
from fastapi.responses import Response
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.application.services import (
    ApplicationService,
    BillingService,
    MatchingService,
    SavedService,
    StudentProfileService,
    ResumeService,
    StudentDocumentService,
    LearningService,
    ContactInfoService,
)
from app.core.errors import PlacementNotFound, PlacementNotOpen
from app.domain.entities import User
from app.infrastructure.db import get_session, SessionLocal
from app.infrastructure.orm import (
    ApplicationORM, 
    ApplicationPackORM, 
    PlacementORM, 
    OrganisationORM, 
    UserORM
)
from app.presentation.deps import (
    get_application_service,
    get_billing_service,
    get_current_user,
    get_matching_service,
    get_saved_service,
    get_student_profile_service,
    get_resume_service,
    get_student_document_service,
    get_learning_service,
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
    SkillSuggestionListResponse,
    SkillSuggestionRead,
    SubscriptionRead,
    StudentProfileRead,
    StudentProfileUpdate,
    ResumeRead,
    StudentDocumentRead,
    StudentDocumentsResponse,
    ToggleSavedRequest,
    ToggleSavedResponse,
    ContactInfoRead,
    FeaturedPlacementRead,
    HomeStatsRead,
    LearningProgressRead,
    StudentLearningProfileRead,
    MarkModuleCompleteRequest,
    MarkModuleCompleteResponse,
)

router = APIRouter(tags=["user-state"])

# ---- Helpers ----------------------------------------------------------------

def _org_for(user: User, org_id: Optional[str]) -> str:
    if org_id:
        return org_id
    if user.org_id:
        return user.org_id
    raise HTTPException(status_code=400, detail="No organisation bound to this account")

def _subscription_read(sub) -> SubscriptionRead:
    return SubscriptionRead(
        id=sub.id,
        org_id=sub.org_id,
        plan=sub.plan,
        billing=sub.billing,
        seats=sub.seats,
        status=sub.status,
        started_at=sub.started_at,
        renews_at=sub.renews_at,
        cancelled_at=sub.cancelled_at,
    )

# ---- Placement interactions -------------------------------------------------

@router.post("/placements/{placement_id}/save", response_model=ToggleSavedResponse)
@router.post("/saved/toggle", response_model=ToggleSavedResponse, include_in_schema=False)
def toggle_saved(
    placement_id: Optional[str] = None,
    payload: Optional[ToggleSavedRequest] = None,
    current_user: User = Depends(get_current_user),
    service: SavedService = Depends(get_saved_service),
) -> ToggleSavedResponse:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can save placements")
    
    # Support both path parameter and request body
    pid = placement_id or (payload.placement_id if payload else None)
    if not pid:
        raise HTTPException(status_code=422, detail="placement_id is required")
    
    res = service.toggle(current_user.id, pid)
    return ToggleSavedResponse(saved=res[0], saved_ids=res[1])

@router.get("/saved", response_model=SavedListResponse)
def list_saved(
    current_user: User = Depends(get_current_user),
    service: SavedService = Depends(get_saved_service),
) -> SavedListResponse:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have a shortlist")
    return SavedListResponse(saved_ids=service.list(current_user.id))

@router.post("/applications", response_model=ApplicationRead, include_in_schema=False, status_code=201)
@router.post("/apply/{placement_id}", response_model=ApplicationRead)
def apply_to_placement_legacy(
    payload: ApplyRequest,
    current_user: User = Depends(get_current_user),
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationRead:
    """Legacy endpoint for applying with placement_id in body."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can apply")
    if payload.user_id and payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot apply on behalf of another user")
    if not payload.placement_id:
        raise HTTPException(status_code=422, detail="placement_id is required")
    app = service.apply(
        user_id=current_user.id,
        placement_id=payload.placement_id,
        statement=payload.statement,
    )
    return ApplicationRead.model_validate(app, from_attributes=True)


@router.post("/applications", response_model=ApplicationRead, include_in_schema=False, status_code=201)
def apply_to_placement_legacy(
    payload: ApplyRequest,
    current_user: User = Depends(get_current_user),
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationRead:
    """Legacy endpoint for applying with placement_id in body."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can apply")
    if payload.user_id and payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot apply on behalf of another user")
    if not payload.placement_id:
        raise HTTPException(status_code=422, detail="placement_id is required")
    try:
        app = service.apply(
            user_id=current_user.id,
            placement_id=payload.placement_id,
            statement=payload.statement,
        )
    except PlacementNotFound:
        raise HTTPException(status_code=404, detail="Placement not found")
    except PlacementNotOpen:
        raise HTTPException(status_code=409, detail="Placement is not open for applications")
    return ApplicationRead.model_validate(app, from_attributes=True)


@router.post("/apply/{placement_id}", response_model=ApplicationRead)
def apply_to_placement(
    placement_id: str,
    payload: ApplyRequest,
    current_user: User = Depends(get_current_user),
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can apply")
    if payload.user_id and payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot apply on behalf of another user")
    try:
        app = service.apply(
            user_id=current_user.id,
            placement_id=placement_id,
            statement=payload.statement,
        )
    except PlacementNotFound:
        raise HTTPException(status_code=404, detail="Placement not found")
    except PlacementNotOpen:
        raise HTTPException(status_code=409, detail="Placement is not open for applications")
    return ApplicationRead.model_validate(app, from_attributes=True)

@router.get("/applications", response_model=ApplicationsResponse)
def list_my_applications(
    current_user: User = Depends(get_current_user),
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationsResponse:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have applications")
    apps = service.list_for_user(current_user.id)
    return ApplicationsResponse(
        total=len(apps),
        items=[ApplicationRead.model_validate(a, from_attributes=True) for a in apps]
    )

@router.get("/saved", response_model=dict[str, list[str]])
def list_saved_placements(
    current_user: User = Depends(get_current_user),
    service: ApplicationService = Depends(get_application_service),
) -> dict[str, list[str]]:
    if current_user.role not in ("student", "jobseeker"):
        raise HTTPException(status_code=403, detail="Only students and jobseekers have saved placements")
    apps = service.list_for_user(current_user.id)
    return {"saved_ids": [a.placement_id for a in apps]}


@router.post("/applications/{application_id}/withdraw", response_model=ApplicationRead)
def withdraw_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    service: ApplicationService = Depends(get_application_service),
) -> ApplicationRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can withdraw applications")
    app = service.withdraw(user_id=current_user.id, application_id=application_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found or already processed")
    return ApplicationRead.model_validate(app, from_attributes=True)


# ---- Application Pack -------------------------------------------------------

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

# ---- Skill Suggestions ------------------------------------------------------

@router.get("/skills/suggestions", response_model=SkillSuggestionListResponse)
def get_skill_suggestions(
    course: str = Query(""),
    current_user: User = Depends(get_current_user),
) -> SkillSuggestionListResponse:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can request skill suggestions")
    from app.domain.matching import SKILLS, extract_skills
    # Extract skills from the course name
    course_skills = extract_skills(course)
    # Return all skills not in user's profile
    user_skills = set(current_user.skills if hasattr(current_user, 'skills') else [])
    suggestions = [s for s in SKILLS if s.name not in user_skills]
    # Sort by relevance (course skills first)
    suggestions.sort(key=lambda s: 0 if s.name in course_skills else 1)
    return SkillSuggestionListResponse(items=[SkillSuggestionRead.model_validate(s) for s in suggestions[:10]])

# ---- Resume -----------------------------------------------------------------

@router.get("/resume", response_model=ResumeRead)
def get_resume(
    current_user: User = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
) -> ResumeRead:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have resumes")
    resume = service.get(current_user.id)
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return ResumeRead.model_validate(resume, from_attributes=True)

@router.post("/resume", response_model=ResumeRead)
@router.put("/resume", response_model=ResumeRead, include_in_schema=False)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
) -> ResumeRead:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Resume file is empty")
    if file.content_type not in ("application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
        raise HTTPException(status_code=415, detail="Resume must be PDF or Word document")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Resume must be 5 MB or smaller")
    resume = service.save(user_id=current_user.id, filename=file.filename, content_type=file.content_type, content=content)
    return ResumeRead.model_validate(resume, from_attributes=True)

@router.get("/resume/download")
def download_resume(
    current_user: User = Depends(get_current_user),
    service: ResumeService = Depends(get_resume_service),
) -> Response:
    resume = service.get(current_user.id)
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return Response(
        content=resume.content,
        media_type=resume.content_type,
        headers={"Content-Disposition": f'attachment; filename="{resume.filename}"'},
    )

# ---- Student documents ------------------------------------------------------

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
            filename = file.filename or document_type
        else:
            raise HTTPException(status_code=400, detail="Testimonial requires either file or text")
    else:
        if current_user.role != "student":
            raise HTTPException(status_code=403, detail="Only students can upload documents")
        if not file:
            raise HTTPException(status_code=400, detail="Document file is required")
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


# ---- Contact Info ----------------------------------------------------------

@router.get("/contact/info", response_model=ContactInfoRead)
def get_contact_info(
    service: ContactInfoService = Depends(lambda: ContactInfoService()),
) -> ContactInfoRead:
    """Get public contact information (email, WhatsApp)."""
    return ContactInfoRead(**service.get_contact_info())


# ---- Home Stats ------------------------------------------------------------

@router.get("/home/stats", response_model=HomeStatsRead)
def get_home_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> HomeStatsRead:
    """Get home page statistics and featured placements."""
    from app.infrastructure.orm import PlacementORM, OrganisationORM, UserORM
    
    # Total counts
    total_placements = session.query(PlacementORM).filter(PlacementORM.review_status == "approved", PlacementORM.status == "Open").count()
    total_organizations = session.query(OrganisationORM).count()
    total_students = session.query(UserORM).filter(UserORM.role == "student").count()
    total_applications = session.query(ApplicationORM).count()
    
    # Recent placements
    recent_placements_q = session.query(PlacementORM, OrganisationORM).join(
        OrganisationORM, PlacementORM.org_id == OrganisationORM.id
    ).filter(
        PlacementORM.review_status == "approved",
        PlacementORM.status == "Open"
    ).order_by(PlacementORM.published_at.desc()).limit(6).all()
    
    recent_placements = []
    for p, org in recent_placements_q:
        recent_placements.append({
            "id": p.id,
            "title": p.title,
            "organization": org.name,
            "organization_type": org.type,
            "opportunity_type": p.opportunity_type or "internship",
            "deadline": p.deadline,
        })
    
    # Organization counts by type
    org_counts_q = session.query(OrganisationORM.type, func.count(OrganisationORM.id)).group_by(OrganisationORM.type).all()
    org_counts = {org_type: count for org_type, count in org_counts_q}
    
    return HomeStatsRead(
        total_placements=total_placements,
        total_organizations=total_organizations,
        total_students=total_students,
        total_applications=total_applications,
        recent_placements=recent_placements,
        org_counts=org_counts,
    )


# ---- Student Learning Tracking ---------------------------------------------

@router.get("/student/learning/profile", response_model=StudentLearningProfileRead)
def get_student_learning_profile(
    service: LearningService = Depends(lambda: LearningService(SessionLocal())),
    current_user: User = Depends(get_current_user),
) -> StudentLearningProfileRead:
    """Get the student's learning profile with courses, progress, achievements, and badges."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can access learning profile")
    
    profile_data = service.get_student_learning_profile(current_user.id)
    return StudentLearningProfileRead.model_validate(profile_data)


# ---- Profile alias (backward compatibility) ---------------------------------

@router.get("/profile", response_model=StudentProfileRead, include_in_schema=False)
def get_profile_alias(
    service: StudentProfileService = Depends(get_student_profile_service),
    current_user: User = Depends(get_current_user),
) -> StudentProfileRead:
    """Alias for student profile for backward compatibility."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can access profile")
    
    profile = service.get(current_user.id)
    if profile is None:
        # Return empty profile for new students
        return StudentProfileRead(
            user_id=current_user.id,
            course="",
            year="",
            cgpa=0.0,
            university="",
            skills=[],
            talent_search_opt_in=False,
            skills_confidence={},
            skills_source={},
        )
    return StudentProfileRead.model_validate(profile, from_attributes=True)


@router.put("/profile", response_model=StudentProfileRead, include_in_schema=False)
def update_profile_alias(
    payload: Optional[dict] = Body(None),
    service: StudentProfileService = Depends(get_student_profile_service),
    current_user: User = Depends(get_current_user),
) -> StudentProfileRead:
    """Alias for updating profile - delegates to student profile service."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can update profile")
    
    # Update the profile
    if payload and isinstance(payload, dict) and len(payload) > 0:
        # Validate and return the payload using StudentProfileUpdate (partial update)
        try:
            update_data = StudentProfileUpdate.model_validate(payload)
            # Get current profile
            profile = service.get(current_user.id)
            if profile is None:
                # Create new profile with the update data
                profile = service.save(
                    user_id=current_user.id,
                    course=update_data.course or "",
                    year=update_data.year or "",
                    cgpa=update_data.cgpa or 0.0,
                    university=update_data.university or "",
                    skills=update_data.skills or [],
                    talent_search_opt_in=update_data.talent_search_opt_in,
                    skills_confidence=update_data.skills_confidence or {},
                    skills_source=update_data.skills_source or {},
                )
            else:
                # Update existing profile with non-empty values
                course = update_data.course if update_data.course else profile.course
                year = update_data.year if update_data.year else profile.year
                cgpa = update_data.cgpa if update_data.cgpa != 0.0 else profile.cgpa
                university = update_data.university if update_data.university else profile.university
                skills = update_data.skills if update_data.skills else profile.skills
                talent_search_opt_in = update_data.talent_search_opt_in if update_data.talent_search_opt_in else profile.talent_search_opt_in
                skills_confidence = update_data.skills_confidence if update_data.skills_confidence else profile.skills_confidence
                skills_source = update_data.skills_source if update_data.skills_source else profile.skills_source
                
                profile = service.save(
                    user_id=current_user.id,
                    course=course,
                    year=year,
                    cgpa=cgpa,
                    university=university,
                    skills=skills,
                    talent_search_opt_in=talent_search_opt_in,
                    skills_confidence=skills_confidence,
                    skills_source=skills_source,
                )
            return StudentProfileRead.model_validate(profile, from_attributes=True)
        except Exception:
            # If validation fails, return current profile
            pass
    
    # If no payload provided or validation fails, return current profile
    profile = service.get(current_user.id)
    if profile is None:
        return StudentProfileRead(
            user_id=current_user.id,
            course="",
            year="",
            cgpa=0.0,
            university="",
            skills=[],
            talent_search_opt_in=False,
            skills_confidence={},
            skills_source={},
        )
    return StudentProfileRead.model_validate(profile, from_attributes=True)


@router.post("/student/learning/complete-module", response_model=MarkModuleCompleteResponse)
def mark_module_complete(
    payload: MarkModuleCompleteRequest,
    service: LearningService = Depends(lambda: LearningService(SessionLocal())),
    current_user: User = Depends(get_current_user),
) -> MarkModuleCompleteResponse:
    """Mark a course module as complete and check for badge earning."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can mark modules complete")
    
    result = service.mark_module_complete(current_user.id, payload.course_id, payload.module_id)
    return MarkModuleCompleteResponse(**result)