from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class MedicineProof(Base):
    __tablename__ = "medicine_proofs"

    id = Column(Integer, primary_key=True, index=True)
    occurrence_id = Column(Integer, ForeignKey("medicine_occurrences.id"), unique=True, nullable=False, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    occurrence = relationship("MedicineOccurrence", back_populates="proof")
    child = relationship("User", foreign_keys=[child_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])
