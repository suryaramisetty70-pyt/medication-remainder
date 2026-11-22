from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.relationship import RelationshipStatus
from app.models.user import UserRole


class ConnectionRequestInput(BaseModel):
    child_email: EmailStr


class ConnectionActionInput(BaseModel):
    relationship_id: int
    action: str  # "ACCEPT" or "REJECT"


class DirectChildCreateInput(BaseModel):
    """Parent creates a child profile directly — no email/password needed."""
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class JoinFamilyCodeInput(BaseModel):
    """Child enters 6-digit family code to access their dashboard."""
    pairing_code: str


class ConnectedUserSummary(BaseModel):
    relationship_id: int
    user_id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    status: RelationshipStatus
    pairing_code: Optional[str] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
