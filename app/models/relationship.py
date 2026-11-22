import enum
import secrets
import string
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


def generate_pairing_code():
    """Generate a unique 6-character alphanumeric code like CARE-A7B2."""
    chars = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(chars) for _ in range(4))
    return f"CARE-{code}"


class RelationshipStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class ParentChildRelationship(Base):
    __tablename__ = "parent_child_relationships"
    __table_args__ = (
        UniqueConstraint("parent_id", "child_id", name="uq_parent_child"),
    )

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    pairing_code = Column(String(20), unique=True, index=True, nullable=True)
    status = Column(Enum(RelationshipStatus), default=RelationshipStatus.PENDING, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime, nullable=True)

    parent = relationship("User", foreign_keys=[parent_id], back_populates="parent_relations")
    child = relationship("User", foreign_keys=[child_id], back_populates="child_relations")

