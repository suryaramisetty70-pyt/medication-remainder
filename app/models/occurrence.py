import enum
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class OccurrenceStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    DUE = "DUE"
    SNOOZED = "SNOOZED"
    TAKEN = "TAKEN"
    MISSED = "MISSED"
    TAKEN_LATE = "TAKEN_LATE"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    RECONFIRMATION_REQUIRED = "RECONFIRMATION_REQUIRED"


class MedicineOccurrence(Base):
    __tablename__ = "medicine_occurrences"
    __table_args__ = (
        Index("ix_occ_child_scheduled", "child_id", "scheduled_time"),
        Index("ix_occ_status_scheduled", "status", "scheduled_time"),
    )

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    scheduled_time = Column(DateTime, nullable=False, index=True)
    grace_until = Column(DateTime, nullable=False, index=True)
    status = Column(Enum(OccurrenceStatus), default=OccurrenceStatus.UPCOMING, nullable=False, index=True)
    snooze_count = Column(Integer, default=0, nullable=False)
    taken_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    medicine = relationship("Medicine", back_populates="occurrences")
    proof = relationship("MedicineProof", uselist=False, back_populates="occurrence", cascade="all, delete-orphan")
    child = relationship("User", foreign_keys=[child_id])
    parent = relationship("User", foreign_keys=[parent_id])
