"""AI Enrichment endpoints — student profile enrichment from personal statements.

This module provides endpoints for AI-powered profile enrichment using Groq
to extract structured competency data from unstructured personal statements.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from app.ai.enrichment_service import GroqEnrichmentService
from app.application.services import StudentProfileService
from app.core.config import get_settings
from app.core.errors import LLMNotConfigured
from app.domain.entities import User
from app.presentation.deps import (
    get_current_user,
    get_student_profile_service,
)
from app.presentation.schemas import (
    EnrichmentRequest,
    EnrichmentResponse,
    AdvancedStudentProfileRead,
)

router = APIRouter(tags=["ai-enrichment"])


def get_enrichment_service() -> GroqEnrichmentService:
    return GroqEnrichmentService()


@router.post("/enrich", response_model=EnrichmentResponse)
async def enrich_profile(
    payload: EnrichmentRequest,
    current_user: User = Depends(get_current_user),
    profile_service: StudentProfileService = Depends(get_student_profile_service),
    enrichment_service: GroqEnrichmentService = Depends(get_enrichment_service),
) -> EnrichmentResponse:
    """Enrich student profile from personal statement using Groq AI.
    
    Takes a personal statement/bio and extracts:
    - Technical skills with proficiency levels and evidence
    - Soft skills with evidence
    - Career trajectory and aspirations
    - Cultural values and work preferences
    - Embeddings for semantic matching
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can enrich profiles")
    
    try:
        # Get existing skills from current profile
        existing_profile = profile_service.get(current_user.id)
        existing_skills = existing_profile.skills if existing_profile else []
        
        # Run enrichment
        enriched = await enrichment_service.enrich_from_statement(
            user_id=current_user.id,
            personal_statement=payload.personal_statement,
            existing_skills=payload.existing_skills,
        )
        
        return EnrichmentResponse(
            profile=AdvancedStudentProfileRead.model_validate(enriched, from_attributes=True),
            message="Profile enriched successfully"
        )
    except LLMNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")


@router.get("/enrich/status")
def enrichment_status() -> dict:
    """Check if AI enrichment is configured and available."""
    settings = get_settings()
    configured = bool(settings.groq_api_key and settings.groq_model)
    return {
        "configured": configured,
        "model": settings.groq_model if configured else None,
    }