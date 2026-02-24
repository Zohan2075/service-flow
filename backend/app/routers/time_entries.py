from typing import Annotated
from datetime import date, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.time_entry import TimeEntry
from app.models.service_type import ServiceType
from app.schemas.time_entry import (
    CalendarDayResponse,
    TimeEntryCreate,
    TimeEntryResponse,
    TimeEntryUpdate,
)

router = APIRouter(prefix="/time-entries", tags=["time-entries"])


def _duration_display(seconds: int) -> str:
    hours, remainder = divmod(seconds, 3600)
    minutes = remainder // 60
    if hours > 0:
        return f"{hours}h {minutes:02d}m"
    return f"{minutes}m"


@router.get("/", response_model=list[TimeEntryResponse])
async def list_time_entries(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    service_type_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    q = select(TimeEntry).where(TimeEntry.user_id == current_user.id)
    if month and year:
        q = q.where(
            and_(
                extract("month", TimeEntry.start_time) == month,
                extract("year", TimeEntry.start_time) == year,
            )
        )
    if service_type_id:
        q = q.where(TimeEntry.service_type_id == service_type_id)
    q = q.order_by(TimeEntry.start_time.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/calendar", response_model=list[CalendarDayResponse])
async def get_calendar_month(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
):
    """Returns all entries grouped by day for a given month/year."""
    q = (
        select(TimeEntry)
        .where(
            TimeEntry.user_id == current_user.id,
            extract("month", TimeEntry.start_time) == month,
            extract("year", TimeEntry.start_time) == year,
        )
        .order_by(TimeEntry.start_time)
    )
    result = await db.execute(q)
    entries = result.scalars().all()

    # Group by date
    grouped: dict[str, list[TimeEntry]] = {}
    for entry in entries:
        day_key = entry.start_time.date().isoformat()
        grouped.setdefault(day_key, []).append(entry)

    calendar_days = []
    for day_key, day_entries in sorted(grouped.items()):
        total = sum(e.duration_seconds or 0 for e in day_entries)
        calendar_days.append(
            CalendarDayResponse(
                date=day_key,
                entries=[TimeEntryResponse.model_validate(e) for e in day_entries],
                total_duration_seconds=total,
                total_duration_display=_duration_display(total),
            )
        )
    return calendar_days


@router.post("/", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_time_entry(
    payload: TimeEntryCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify service type belongs to user
    st_result = await db.execute(
        select(ServiceType).where(
            ServiceType.id == payload.service_type_id,
            ServiceType.user_id == current_user.id,
        )
    )
    if not st_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Service type not found")

    entry = TimeEntry(**payload.model_dump(), user_id=current_user.id)
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=TimeEntryResponse)
async def get_time_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.id == entry_id, TimeEntry.user_id == current_user.id
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return entry


@router.patch("/{entry_id}", response_model=TimeEntryResponse)
async def update_time_entry(
    entry_id: uuid.UUID,
    payload: TimeEntryUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.id == entry_id, TimeEntry.user_id == current_user.id
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    # Recompute duration if times changed
    if entry.start_time and entry.end_time:
        delta = entry.end_time - entry.start_time
        entry.duration_seconds = max(0, int(delta.total_seconds()))

    await db.flush()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.id == entry_id, TimeEntry.user_id == current_user.id
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    await db.delete(entry)
