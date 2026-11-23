import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, UniqueConstraint
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


class PendingMissedEmail(Base):
    __tablename__ = "pending_missed_emails"
    __table_args__ = (UniqueConstraint("occurrence_id", "recipient"),)

    key = Column(String(36), primary_key=True)
    occurrence_id = Column(Integer, nullable=False)
    recipient = Column(String(255), nullable=False)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    html = Column(Text, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    next_attempt = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
