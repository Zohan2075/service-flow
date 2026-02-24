from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.service_type import ServiceType
from app.schemas.service_type import ServiceTypeCreate, ServiceTypeResponse, ServiceTypeUpdate

router = APIRouter(prefix="/service-types", tags=["service-types"])


@router.get("/", response_model=list[ServiceTypeResponse])
async def list_service_types(current_user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(ServiceType)
        .where(ServiceType.user_id == current_user.id)
        .order_by(ServiceType.sort_order, ServiceType.name)
    )
    return result.scalars().all()


@router.post("/", response_model=ServiceTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_service_type(
    payload: ServiceTypeCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service_type = ServiceType(**payload.model_dump(), user_id=current_user.id)
    db.add(service_type)
    await db.flush()
    await db.refresh(service_type)
    return service_type


@router.get("/{service_type_id}", response_model=ServiceTypeResponse)
async def get_service_type(
    service_type_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ServiceType).where(
            ServiceType.id == service_type_id,
            ServiceType.user_id == current_user.id,
        )
    )
    service_type = result.scalar_one_or_none()
    if not service_type:
        raise HTTPException(status_code=404, detail="Service type not found")
    return service_type


@router.patch("/{service_type_id}", response_model=ServiceTypeResponse)
async def update_service_type(
    service_type_id: uuid.UUID,
    payload: ServiceTypeUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ServiceType).where(
            ServiceType.id == service_type_id,
            ServiceType.user_id == current_user.id,
        )
    )
    service_type = result.scalar_one_or_none()
    if not service_type:
        raise HTTPException(status_code=404, detail="Service type not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service_type, field, value)
    await db.flush()
    await db.refresh(service_type)
    return service_type


@router.delete("/{service_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_type(
    service_type_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ServiceType).where(
            ServiceType.id == service_type_id,
            ServiceType.user_id == current_user.id,
        )
    )
    service_type = result.scalar_one_or_none()
    if not service_type:
        raise HTTPException(status_code=404, detail="Service type not found")
    await db.delete(service_type)
