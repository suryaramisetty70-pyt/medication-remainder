import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text
from app.database import Base


class EmailStatus(str, enum.Enum):
    SENT = "SENT"
    FAILED = "FAILED"
    SUPPRESSED = "SUPPRESSED"


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(255), nullable=False, index=True)
    email_type = Column(String(100), nullable=False)
    reference_id = Column(String(100), nullable=True, index=True)
    status = Column(Enum(EmailStatus), default=EmailStatus.SENT, nullable=False)
    error = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
