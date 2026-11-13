"""HTTP endpoint for the AI career advisor."""
from fastapi import APIRouter, Depends, HTTPException

from app.application.advisor import AdvisorService
from app.core.errors import LLMNotConfigured
from app.domain.entities import User
from app.presentation.deps import get_advisor_service, get_current_user
from app.presentation.schemas import AdvisorRequest, AdvisorResponse

router = APIRouter(tags=["advisor"])


@router.post("/advisor", response_model=AdvisorResponse)
def advise(
    payload: AdvisorRequest,
    service: AdvisorService = Depends(get_advisor_service),
    current_user: User | None = Depends(get_current_user),
) -> AdvisorResponse:
    try:
        reply = service.answer(
            message=payload.message,
            skills=payload.skills,
            course=payload.course,
            cgpa=payload.cgpa,
            role=current_user.role if current_user else "student",
            history=payload.history,
            is_first_message=payload.is_first_message,
        )
    except LLMNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return AdvisorResponse(reply=reply)
