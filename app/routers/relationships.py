from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db, require_child, require_parent
from app.core.security import create_access_token
from app.models.notification import Notification, NotificationType
from app.models.relationship import ParentChildRelationship, RelationshipStatus, generate_pairing_code
from app.models.user import User, UserRole
from app.schemas.relationship import (
    ConnectedUserSummary,
    ConnectionActionInput,
    ConnectionRequestInput,
    DirectChildCreateInput,
    JoinFamilyCodeInput,
)
from app.services.email_service import send_connection_request_email, log_and_send_email

router = APIRouter(prefix="/api/relationships", tags=["Parent-Child Connection"])


# ------------------------------------------------------------------
# 1. DIRECT CHILD CREATION (Parent adds child instantly)
# ------------------------------------------------------------------
@router.post("/parent/create-child", status_code=status.HTTP_201_CREATED)
def create_child_directly(
    payload: DirectChildCreateInput,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    """Parent creates a child profile instantly with just name & phone.
    No email/password needed. Generates a 6-digit pairing code."""

    child_name = payload.name.strip()
    if len(child_name) < 2:
        raise HTTPException(status_code=400, detail="Child name must be at least 2 characters.")

    child_phone = payload.phone.strip() if payload.phone else None
    child_email = payload.email.lower().strip() if payload.email else None

    # If email provided, check for existing user
    if child_email:
        existing = db.query(User).filter(User.email == child_email).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"An account with email '{child_email}' already exists. Use 'Connect Child' instead."
            )

    # Create child user profile (no password, email optional)
    child = User(
        name=child_name,
        email=child_email,
        hashed_password=None,
        role=UserRole.CHILD,
        phone=child_phone,
        timezone="Asia/Kolkata",
        is_verified=False,
        grace_period_minutes=30,
        require_photo_proof=True,
    )
    db.add(child)
    db.flush()  # Get child.id

    # Generate unique pairing code
    for _ in range(10):
        code = generate_pairing_code()
        exists = db.query(ParentChildRelationship).filter(
            ParentChildRelationship.pairing_code == code
        ).first()
        if not exists:
            break
    else:
        code = generate_pairing_code()  # Fallback

    # Create accepted relationship immediately
    rel = ParentChildRelationship(
        parent_id=parent.id,
        child_id=child.id,
        pairing_code=code,
        status=RelationshipStatus.ACCEPTED,
        accepted_at=datetime.utcnow(),
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    db.refresh(child)

    return {
        "message": f"Child profile '{child_name}' created successfully!",
        "child_id": child.id,
        "child_name": child.name,
        "pairing_code": code,
        "join_link": f"{settings.app_url}/?join={code}",
    }


# ------------------------------------------------------------------
# 2. JOIN BY FAMILY CODE (Child enters 6-digit code to get access)
# ------------------------------------------------------------------
@router.post("/join-code")
def join_by_family_code(
    payload: JoinFamilyCodeInput,
    db: Session = Depends(get_db),
):
    """Child enters a 6-digit family code to access their medicine dashboard.
    Returns a JWT access token for the child user."""

    code = payload.pairing_code.strip().upper()
    rel = db.query(ParentChildRelationship).filter(
        ParentChildRelationship.pairing_code == code,
        ParentChildRelationship.status == RelationshipStatus.ACCEPTED,
    ).first()

    if not rel:
        raise HTTPException(
            status_code=404,
            detail="Invalid family code. Please check with your parent and try again."
        )

    child = db.query(User).filter(User.id == rel.child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    # Issue access token for child
    access_token = create_access_token({"sub": str(child.id), "role": child.role.value})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": child.id,
            "name": child.name,
            "email": child.email,
            "role": child.role.value,
            "phone": child.phone,
        },
        "message": f"Welcome {child.name}! You're connected to your family.",
    }


# ------------------------------------------------------------------
# 3. EXISTING EMAIL-BASED CONNECTION REQUEST (Updated)
# ------------------------------------------------------------------
@router.post("/parent/request", status_code=status.HTTP_201_CREATED)
def send_child_connection_request(
    payload: ConnectionRequestInput,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    child_email = payload.child_email.lower().strip()
    if child_email == parent.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot connect your own account as a child.",
        )

    child = db.query(User).filter(User.email == child_email).first()
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with email '{child_email}'. Please make sure your child has registered their account.",
        )

    if child.role != UserRole.CHILD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User '{child_email}' is registered as a Parent, not a Child.",
        )

    # Check existing relationship
    existing = (
        db.query(ParentChildRelationship)
        .filter(
            ParentChildRelationship.parent_id == parent.id,
            ParentChildRelationship.child_id == child.id,
        )
        .first()
    )

    if existing:
        if existing.status == RelationshipStatus.ACCEPTED:
            return {"message": "You are already connected to this child."}
        elif existing.status == RelationshipStatus.PENDING:
            return {"message": "A connection request is already pending for this child."}
        else:
            # Re-open rejected request
            existing.status = RelationshipStatus.PENDING
            if not existing.pairing_code:
                existing.pairing_code = generate_pairing_code()
            db.commit()
    else:
        rel = ParentChildRelationship(
            parent_id=parent.id,
            child_id=child.id,
            pairing_code=generate_pairing_code(),
            status=RelationshipStatus.PENDING,
        )
        db.add(rel)
        db.commit()

    # Create in-app notification for child
    notif = Notification(
        user_id=child.id,
        type=NotificationType.CONNECTION_REQUEST,
        title="👨‍👩‍👧 Family Connection Request",
        message=f"{parent.name} ({parent.email}) sent you a connection request to help manage medication reminders.",
        link="/child/dashboard",
    )
    db.add(notif)
    db.commit()

    # Send email to child
    send_connection_request_email(db, child.email, child.name, parent.name)

    return {"message": f"Connection request successfully sent to {child.name} ({child.email})."}


# ------------------------------------------------------------------
# 4. LIST PARENT'S CHILDREN
# ------------------------------------------------------------------
@router.get("/parent/children", response_model=List[ConnectedUserSummary])
def get_parent_children(
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    relationships = (
        db.query(ParentChildRelationship)
        .filter(ParentChildRelationship.parent_id == parent.id)
        .all()
    )

    results = []
    for rel in relationships:
        child = db.query(User).filter(User.id == rel.child_id).first()
        if child:
            results.append(
                ConnectedUserSummary(
                    relationship_id=rel.id,
                    user_id=child.id,
                    name=child.name,
                    email=child.email,
                    phone=child.phone,
                    role=child.role,
                    status=rel.status,
                    pairing_code=rel.pairing_code,
                    created_at=rel.created_at,
                    accepted_at=rel.accepted_at,
                )
            )
    return results


# ------------------------------------------------------------------
# 5. LIST CHILD'S CONNECTIONS
# ------------------------------------------------------------------
@router.get("/child/connections", response_model=List[ConnectedUserSummary])
def get_child_connections(
    child: User = Depends(require_child),
    db: Session = Depends(get_db),
):
    relationships = (
        db.query(ParentChildRelationship)
        .filter(ParentChildRelationship.child_id == child.id)
        .all()
    )

    results = []
    for rel in relationships:
        parent = db.query(User).filter(User.id == rel.parent_id).first()
        if parent:
            results.append(
                ConnectedUserSummary(
                    relationship_id=rel.id,
                    user_id=parent.id,
                    name=parent.name,
                    email=parent.email,
                    phone=parent.phone,
                    role=parent.role,
                    status=rel.status,
                    pairing_code=rel.pairing_code,
                    created_at=rel.created_at,
                    accepted_at=rel.accepted_at,
                )
            )
    return results


# ------------------------------------------------------------------
# 6. CHILD RESPONDS TO CONNECTION REQUEST
# ------------------------------------------------------------------
@router.post("/child/respond")
def respond_to_connection_request(
    payload: ConnectionActionInput,
    child: User = Depends(require_child),
    db: Session = Depends(get_db),
):
    rel = (
        db.query(ParentChildRelationship)
        .filter(
            ParentChildRelationship.id == payload.relationship_id,
            ParentChildRelationship.child_id == child.id,
        )
        .first()
    )

    if not rel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection request not found.",
        )

    parent = db.query(User).filter(User.id == rel.parent_id).first()
    action = payload.action.upper().strip()

    if action == "ACCEPT":
        rel.status = RelationshipStatus.ACCEPTED
        rel.accepted_at = datetime.utcnow()
        db.commit()

        # Notify parent
        notif = Notification(
            user_id=parent.id,
            type=NotificationType.CONNECTION_ACCEPTED,
            title="🎉 Connection Request Accepted",
            message=f"{child.name} accepted your family connection request. You can now schedule medicines.",
            link="/parent/medicines",
        )
        db.add(notif)
        db.commit()

        # Email parent
        subj = f"🎉 {child.name} Accepted Your CareSync Connection"
        txt = f"Hello {parent.name},\n\n{child.name} has accepted your CareSync connection request. You can now create medicine schedules and receive missed dose alerts."
        html = f"<div style='font-family: Arial; padding: 20px;'><h2>Connection Accepted!</h2><p><strong>{child.name}</strong> accepted your request. You can now manage their prescriptions in CareSync.</p></div>"
        log_and_send_email(db, parent.email, subj, txt, html, "CONNECTION_ACCEPTED")

        return {"message": f"You are now connected with {parent.name}."}

    elif action == "REJECT":
        rel.status = RelationshipStatus.REJECTED
        db.commit()

        # Notify parent
        notif = Notification(
            user_id=parent.id,
            type=NotificationType.CONNECTION_REQUEST,
            title="Connection Request Declined",
            message=f"{child.name} declined your family connection request.",
            link="/parent/children",
        )
        db.add(notif)
        db.commit()

        return {"message": "Connection request declined."}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'ACCEPT' or 'REJECT'.")
