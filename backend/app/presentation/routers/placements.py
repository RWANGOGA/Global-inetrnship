"""HTTP endpoints for browsing placements.

The router is thin: it reads query params, calls the application service and
serialises the domain result. All logic lives below the presentation layer.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.application.services import PlacementService
from app.presentation.deps import get_placement_service
from app.presentation.schemas import (
    CatalogMetaRead,
    PlacementListResponse,
    PlacementRead,
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
