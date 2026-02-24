import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func, Text, Interval
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Stored in seconds for simplicity; computed from start/end when both provided
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="time_entries")  # noqa: F821
    service_type: Mapped["ServiceType"] = relationship(  # noqa: F821
        "ServiceType", back_populates="time_entries"
    )

    @property
    def duration_display(self) -> str:
        seconds = self.duration_seconds or 0
        hours, remainder = divmod(seconds, 3600)
        minutes = remainder // 60
        if hours > 0:
            return f"{hours}h {minutes:02d}m"
        return f"{minutes}m"

    def __repr__(self) -> str:
        return f"<TimeEntry id={self.id} title={self.title}>"
