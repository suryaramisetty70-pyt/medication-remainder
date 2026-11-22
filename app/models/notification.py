import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class NotificationType(str, enum.Enum):
    MEDICINE_DUE = "MEDICINE_DUE"
    MEDICINE_MISSED = "MEDICINE_MISSED"
    MEDICINE_CONFIRMED = "MEDICINE_CONFIRMED"
    PROOF_UPLOADED = "PROOF_UPLOADED"
    PARENT_VERIFIED = "PARENT_VERIFIED"
    CONNECTION_REQUEST = "CONNECTION_REQUEST"
    CONNECTION_ACCEPTED = "CONNECTION_ACCEPTED"
    RECONFIRMATION_REQUIRED = "RECONFIRMATION_REQUIRED"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")
