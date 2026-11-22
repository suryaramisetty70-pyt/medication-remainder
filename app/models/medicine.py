import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class MedicineFrequency(str, enum.Enum):
    ONCE = "ONCE"
    DAILY = "DAILY"
    TWICE_DAILY = "TWICE_DAILY"
    THREE_TIMES_DAILY = "THREE_TIMES_DAILY"
    CUSTOM = "CUSTOM"
    SPECIFIC_DAYS = "SPECIFIC_DAYS"


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    dosage = Column(String(100), nullable=False)  # e.g., "500 mg", "1 Tablet"
    instructions = Column(Text, nullable=True)   # e.g., "Take after breakfast with water"
    frequency = Column(Enum(MedicineFrequency), default=MedicineFrequency.DAILY, nullable=False)
    times_of_day = Column(String(255), nullable=False)  # e.g., "08:00" or "08:00,20:00"
    specific_days = Column(String(100), nullable=True)  # e.g., "MON,WED,FRI"
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    parent = relationship("User", foreign_keys=[parent_id], back_populates="created_medicines")
    child = relationship("User", foreign_keys=[child_id], back_populates="prescribed_medicines")
    occurrences = relationship("MedicineOccurrence", back_populates="medicine", cascade="all, delete-orphan")
