import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ServiceTypeBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = Field(None, max_length=500)
    color: str = Field("#2094f3", pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str = Field("work", max_length=50)
    sort_order: int = 0


class ServiceTypeCreate(ServiceTypeBase):
    pass


class ServiceTypeUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=500)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str | None = Field(None, max_length=50)
    is_active: bool | None = None
    sort_order: int | None = None


class ServiceTypeResponse(ServiceTypeBase):
    id: uuid.UUID
    user_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
