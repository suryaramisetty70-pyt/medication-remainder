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
    """Child needs no personal email or password; parent chooses a login email."""
    name: str
    parent_email: Optional[EmailStr] = None
    phone: Optional[str] = None


class JoinFamilyCodeInput(BaseModel):
    """Child authenticates using the parent-selected email and private code."""
    parent_email: EmailStr
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
    pairing_email: Optional[str] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
