"""HTTP endpoints for skills matching and extraction."""
from fastapi import APIRouter, Depends

from app.application.ports import LLMClient
from app.application.services import MatchingService, StudentProfileService
from app.application.skill_intake import SkillIntakeService
from app.domain.entities import User
from app.domain.matching import extract_skills
from app.presentation.deps import (
    get_current_user,
    get_llm_client,
    get_matching_service,
    get_student_profile_service,
    rate_limit,
)
from app.presentation.schemas import (
    ExtractRequest,
    ExtractResponse,
    MatchRead,
    MatchRequest,
    MatchResponse,
    PlacementRead,
    RankedPlacementRead,
    SkillMatchRead,
    SkillMatchRequest,
    SkillMatchResponse,
)

router = APIRouter(tags=["matching"])


@router.post("/match", response_model=MatchResponse)
def match(
    payload: MatchRequest,
    service: MatchingService = Depends(get_matching_service),
) -> MatchResponse:
    ranked = service.rank(
        student_skills=payload.skills,
        student_course=payload.course,
        student_cgpa=payload.cgpa,
        student_confidence=payload.skills_confidence,
        q=payload.q,
        org_type=payload.org_type,
        location=payload.location,
        mode=payload.mode,
        opportunity_type=payload.opportunity_type,
        limit=payload.limit,
    )
    items = [
        RankedPlacementRead(
            placement=PlacementRead.model_validate(r.placement),
            match=MatchRead(
                score=r.match.score,
                matched=r.match.matched,
                missing=r.match.missing,
                course_fit=r.match.course_fit,
                grade_fit=r.match.grade_fit,
            ),
        )
        for r in ranked
    ]
    return MatchResponse(total=len(items), items=items)


@router.post("/skills/extract", response_model=ExtractResponse)
def extract(payload: ExtractRequest) -> ExtractResponse:
    return ExtractResponse(skills=extract_skills(payload.text))


@router.post(
    "/skills/match",
    response_model=SkillMatchResponse,
    dependencies=[Depends(rate_limit)],
)
def match_skills_to_bio(
    payload: SkillMatchRequest,
    current_user: User = Depends(get_current_user),
    profile_service: StudentProfileService = Depends(get_student_profile_service),
    llm: LLMClient = Depends(get_llm_client),
) -> SkillMatchResponse:
    """Read a free-text introduction and name the taxonomy skills it evidences.

    Authenticated and rate limited because it spends a model call per request.
    Answers with ``source="keywords"`` (plus a ``note`` explaining why) whenever
    the model is unconfigured or unavailable, so the client renders an honest
    result instead of an error page.
    """
    profile = profile_service.get(current_user.id)
    owned = set(profile.skills if profile else [])
    # The client also reports its in-session skills: the profile on the server
    # lags behind an optimistic add, and re-offering a skill just accepted reads
    # as if the button did nothing.
    owned.update(name for name in payload.skills if name)

    result = SkillIntakeService(llm).suggest(payload.text, owned)
    items = [
        SkillMatchRead(
            name=item.name,
            category=item.category,
            level=item.level,
            reason=item.reason,
            owned=item.owned,
        )
        for item in result.items
    ]
    return SkillMatchResponse(
        total=len(items), items=items, source=result.source, note=result.note
    )
