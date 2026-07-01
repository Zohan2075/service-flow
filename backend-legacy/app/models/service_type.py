import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ServiceType(Base):
    __tablename__ = "service_types"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Hex color e.g. "#2094f3"
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#2094f3")
    # Material icon name e.g. "build", "groups"
    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="work")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="service_types")  # noqa: F821
    time_entries: Mapped[list["TimeEntry"]] = relationship(  # noqa: F821
        back_populates="service_type", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ServiceType id={self.id} name={self.name}>"
