"""Learning resources linked to skills and placements.

Students read the catalogue; administrators curate it. Resources are the
bridge between a missing skill on a match card and something a student can do
about it.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.application.services import LearningResourceService
from app.core.errors import LearningResourceNotFound
from app.domain.entities import User
from app.presentation.deps import get_current_user, get_learning_resource_service
from app.presentation.schemas import (
    LearningResourceListResponse,
    LearningResourceRead,
    LearningResourceWrite,
)

router = APIRouter(prefix="/learning-resources", tags=["learning"])


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Only administrators can curate learning resources"
        )


@router.get("", response_model=LearningResourceListResponse)
def list_learning_resources(
    skill: str | None = Query(default=None),
    placement_id: str | None = Query(default=None),
    service: LearningResourceService = Depends(get_learning_resource_service),
) -> LearningResourceListResponse:
    items = service.list(skill=skill, placement_id=placement_id)
    return LearningResourceListResponse(
        total=len(items),
        items=[LearningResourceRead.model_validate(item) for item in items],
    )


@router.post("", response_model=LearningResourceRead, status_code=201)
def create_learning_resource(
    payload: LearningResourceWrite,
    service: LearningResourceService = Depends(get_learning_resource_service),
    current_user: User = Depends(get_current_user),
) -> LearningResourceRead:
    _require_admin(current_user)
    try:
        resource = service.create(**payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return LearningResourceRead.model_validate(resource)


@router.put("/{resource_id}", response_model=LearningResourceRead)
def update_learning_resource(
    resource_id: str,
    payload: LearningResourceWrite,
    service: LearningResourceService = Depends(get_learning_resource_service),
    current_user: User = Depends(get_current_user),
) -> LearningResourceRead:
    _require_admin(current_user)
    try:
        resource = service.update(resource_id, **payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LearningResourceNotFound as exc:
        raise HTTPException(status_code=404, detail="Learning resource not found") from exc
    return LearningResourceRead.model_validate(resource)


@router.delete("/{resource_id}", status_code=204)
def delete_learning_resource(
    resource_id: str,
    service: LearningResourceService = Depends(get_learning_resource_service),
    current_user: User = Depends(get_current_user),
) -> Response:
    _require_admin(current_user)
    try:
        service.delete(resource_id)
    except LearningResourceNotFound as exc:
        raise HTTPException(status_code=404, detail="Learning resource not found") from exc
    return Response(status_code=204)
