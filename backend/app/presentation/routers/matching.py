"""HTTP endpoints for skills matching and extraction."""
from fastapi import APIRouter, Depends

from app.application.services import MatchingService
from app.domain.matching import extract_skills
from app.presentation.deps import get_matching_service
from app.presentation.schemas import (
    ExtractRequest,
    ExtractResponse,
    MatchRead,
    MatchRequest,
    MatchResponse,
    PlacementRead,
    RankedPlacementRead,
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
