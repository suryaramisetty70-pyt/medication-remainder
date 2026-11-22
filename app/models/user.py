import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    PARENT = "PARENT"
    CHILD = "CHILD"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.PARENT)
    phone = Column(String(50), nullable=True)
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    alert_email = Column(String(255), nullable=True)
    grace_period_minutes = Column(Integer, default=30, nullable=False)
    require_photo_proof = Column(Boolean, default=True, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    parent_relations = relationship("ParentChildRelationship", foreign_keys="[ParentChildRelationship.parent_id]", back_populates="parent")
    child_relations = relationship("ParentChildRelationship", foreign_keys="[ParentChildRelationship.child_id]", back_populates="child")
    created_medicines = relationship("Medicine", foreign_keys="[Medicine.parent_id]", back_populates="parent")
    prescribed_medicines = relationship("Medicine", foreign_keys="[Medicine.child_id]", back_populates="child")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    auth_tokens = relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")
