import uuid
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class TimeEntryBase(BaseModel):
    title: str = Field(..., max_length=200)
    notes: str | None = None
    location: str | None = Field(None, max_length=255)
    start_time: datetime
    end_time: datetime | None = None
    duration_seconds: int | None = None
    service_type_id: uuid.UUID


class TimeEntryCreate(TimeEntryBase):
    @model_validator(mode="after")
    def compute_duration(self) -> "TimeEntryCreate":
        if self.start_time and self.end_time and not self.duration_seconds:
            delta = self.end_time - self.start_time
            self.duration_seconds = max(0, int(delta.total_seconds()))
        return self


class TimeEntryUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    notes: str | None = None
    location: str | None = Field(None, max_length=255)
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_seconds: int | None = None
    service_type_id: uuid.UUID | None = None


class TimeEntryResponse(TimeEntryBase):
    id: uuid.UUID
    user_id: uuid.UUID
    duration_display: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CalendarDayResponse(BaseModel):
    date: str  # ISO date string YYYY-MM-DD
    entries: list[TimeEntryResponse]
    total_duration_seconds: int
    total_duration_display: str
