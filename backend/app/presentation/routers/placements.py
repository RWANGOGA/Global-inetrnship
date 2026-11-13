"""HTTP endpoints for browsing placements.

The router is thin: it reads query params, calls the application service and
serialises the domain result. All logic lives below the presentation layer.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.application.services import PlacementService
from app.domain.entities import User
from app.infrastructure.db import get_session
from app.infrastructure.orm import PlacementORM
from app.presentation.deps import get_current_user, get_placement_service
from app.presentation.schemas import (
    CatalogMetaRead,
    InternshipPostingRead,
    PlacementListResponse,
    PlacementRead,
    PlacementRequirementsUpdate,
)

router = APIRouter(prefix="/placements", tags=["placements"])


@router.get("", response_model=PlacementListResponse)
def list_placements(
    q: Optional[str] = None,
    org_type: Optional[str] = None,
    location: Optional[str] = None,
    mode: Optional[str] = None,
    opportunity_type: Optional[str] = None,
    service: PlacementService = Depends(get_placement_service),
) -> PlacementListResponse:
    items = service.list_placements(
        q=q, org_type=org_type, location=location, mode=mode, opportunity_type=opportunity_type
    )
    return PlacementListResponse(
        total=len(items), items=[PlacementRead.model_validate(p) for p in items]
    )


@router.get("/meta", response_model=CatalogMetaRead)
def catalog_meta(
    service: PlacementService = Depends(get_placement_service),
) -> CatalogMetaRead:
    # Declared before /{placement_id} so the static path wins.
    return CatalogMetaRead(**service.catalog_meta())


@router.get("/{placement_id}", response_model=PlacementRead)
def get_placement(
    placement_id: str,
    service: PlacementService = Depends(get_placement_service),
) -> PlacementRead:
    placement = service.get_placement(placement_id)
    if placement is None or placement.review_status != "approved":
        raise HTTPException(status_code=404, detail="Placement not found")
    return PlacementRead.model_validate(placement)


@router.patch(
    "/{placement_id}/requirements",
    response_model=InternshipPostingRead,
    summary="Update a placement's requirement-related fields",
)
def update_placement_requirements(
    placement_id: str,
    payload: PlacementRequirementsUpdate,
    service: PlacementService = Depends(get_placement_service),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> InternshipPostingRead:
    """Update courses/grade/docs/testimonial/requirements on a placement.

    Allowed for administrators, or for the employer that owns the placement's
    organisation. Returns the full updated placement.
    """
    placement = service.get_placement(placement_id)
    if placement is None:
        raise HTTPException(status_code=404, detail="Placement not found")

    is_owner = (
        current_user.role == "employer"
        and current_user.org_id
        and current_user.org_id == placement.org_id
    )
    if current_user.role != "admin" and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Only administrators or the placement's owning organisation can edit requirements",
        )

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=422, detail="At least one requirement field must be provided"
        )

    updated = service.update_placement(placement_id, **updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Placement not found")

    return InternshipPostingRead.model_validate(updated)
