from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_child, require_parent
from app.models.medicine import Medicine
from app.models.notification import Notification, NotificationType
from app.models.occurrence import MedicineOccurrence, OccurrenceStatus
from app.models.proof import MedicineProof
from app.models.relationship import ParentChildRelationship, RelationshipStatus
from app.models.user import User, UserRole
from app.schemas.occurrence import (
    ConfirmMedicineRequest,
    DashboardStatsResponse,
    OccurrenceResponse,
    ParentVerificationRequest,
    ProofResponse,
    SnoozeMedicineRequest,
)
from app.services.email_service import (
    log_and_send_email,
    send_proof_uploaded_email,
    send_snooze_alert_email,
)
from app.services.storage_service import save_proof_image

router = APIRouter(tags=["Medicine Occurrences & Workflow"])


def _format_occurrence(occ: MedicineOccurrence, db: Session) -> OccurrenceResponse:
    med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
    child = db.query(User).filter(User.id == occ.child_id).first()
    proof = db.query(MedicineProof).filter(MedicineProof.occurrence_id == occ.id).first()

    proof_resp = None
    if proof:
        proof_resp = ProofResponse(
            id=proof.id,
            occurrence_id=proof.occurrence_id,
            child_id=proof.child_id,
            file_name=proof.file_name,
            file_size=proof.file_size,
            mime_type=proof.mime_type,
            uploaded_at=proof.uploaded_at,
            verified_at=proof.verified_at,
            verified_by_id=proof.verified_by_id,
            notes=proof.notes,
        )

    return OccurrenceResponse(
        id=occ.id,
        medicine_id=occ.medicine_id,
        medicine_name=med.name if med else "Medicine",
        dosage=med.dosage if med else "",
        instructions=med.instructions if med else None,
        child_id=occ.child_id,
        child_name=child.name if child else "Child",
        child_phone=child.phone if child else None,
        scheduled_time=occ.scheduled_time,
        grace_until=occ.grace_until,
        status=occ.status,
        snooze_count=occ.snooze_count,
        taken_at=occ.taken_at,
        proof=proof_resp,
    )


# ---------------- CHILD ENDPOINTS ----------------

@router.get("/api/child/medicines/today", response_model=List[OccurrenceResponse])
def get_child_today_medicines(
    child: User = Depends(require_child),
    db: Session = Depends(get_db),
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    occurrences = (
        db.query(MedicineOccurrence)
        .filter(
            MedicineOccurrence.child_id == child.id,
            MedicineOccurrence.scheduled_time >= today_start,
            MedicineOccurrence.scheduled_time <= today_end,
        )
        .order_by(MedicineOccurrence.scheduled_time.asc())
        .all()
    )

    return [_format_occurrence(o, db) for o in occurrences]


@router.post("/api/medicine-occurrences/{occurrence_id}/confirm", response_model=OccurrenceResponse)
def confirm_medicine(
    occurrence_id: int,
    payload: ConfirmMedicineRequest = None,
    child: User = Depends(require_child),
    db: Session = Depends(get_db),
):
    occ = (
        db.query(MedicineOccurrence)
        .filter(
            MedicineOccurrence.id == occurrence_id,
            MedicineOccurrence.child_id == child.id,
        )
        .first()
    )
    if not occ:
        raise HTTPException(status_code=404, detail="Scheduled medicine occurrence not found.")

    parent = db.query(User).filter(User.id == occ.parent_id).first()
    med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
    now = datetime.now()

    # Determine status transition
    if parent and parent.require_photo_proof:
        occ.status = OccurrenceStatus.PENDING_VERIFICATION
    else:
        if now > occ.grace_until:
            occ.status = OccurrenceStatus.TAKEN_LATE
        else:
            occ.status = OccurrenceStatus.TAKEN

    occ.taken_at = now
    db.commit()
    db.refresh(occ)

    # In-app notification for parent
    med_name = med.name if med else "Medicine"
    notif = Notification(
        user_id=occ.parent_id,
        type=NotificationType.MEDICINE_CONFIRMED,
        title=f"✓ Medicine Confirmed by {child.name}",
        message=f"{child.name} just confirmed taking {med_name} at {now.strftime('%I:%M %p')}.",
        link="/parent/dashboard",
    )
    db.add(notif)
    db.commit()

    return _format_occurrence(occ, db)


@router.post("/api/medicine-occurrences/{occurrence_id}/snooze", response_model=OccurrenceResponse)
def snooze_medicine(
    occurrence_id: int,
    payload: SnoozeMedicineRequest,
    child: User = Depends(require_child),
    db: Session = Depends(get_db),
):
    occ = (
        db.query(MedicineOccurrence)
        .filter(
            MedicineOccurrence.id == occurrence_id,
            MedicineOccurrence.child_id == child.id,
        )
        .first()
    )
    if not occ:
        raise HTTPException(status_code=404, detail="Scheduled medicine occurrence not found.")

    if occ.snooze_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum snooze limit reached. Please take your medicine.",
        )

    minutes = max(5, min(30, payload.minutes))
    occ.status = OccurrenceStatus.SNOOZED
    occ.snooze_count += 1
    occ.scheduled_time = datetime.now() + timedelta(minutes=minutes)
    occ.grace_until = occ.scheduled_time + timedelta(minutes=15)

    db.commit()
    db.refresh(occ)

    # In-app notification & immediate email alert to parent
    parent = db.query(User).filter(User.id == occ.parent_id).first()
    med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
    med_name = med.name if med else "Medicine"
    dosage = med.dosage if med else ""
    new_time_str = occ.scheduled_time.strftime("%I:%M %p")

    notif = Notification(
        user_id=occ.parent_id,
        type=NotificationType.MEDICINE_DUE,
        title=f"⏰ Medicine Snoozed by {child.name}",
        message=f"{child.name} snoozed {med_name} ({dosage}) by {minutes}m. New scheduled time: {new_time_str}.",
        link="/parent/dashboard",
    )
    db.add(notif)
    db.commit()

    if parent:
        alert_dest = parent.alert_email or parent.email
        if alert_dest:
            send_snooze_alert_email(
                db=db,
                parent_alert_email=alert_dest,
                parent_name=parent.name,
                child_name=child.name,
                medicine_name=med_name,
                dosage=dosage,
                snooze_minutes=minutes,
                new_time=new_time_str,
                occurrence_id=occ.id,
            )

    return _format_occurrence(occ, db)


@router.post("/api/medicine-occurrences/{occurrence_id}/proof", response_model=OccurrenceResponse)
async def upload_medicine_proof(
    occurrence_id: int,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    child: User = Depends(require_child),
    db: Session = Depends(get_db),
):
    occ = (
        db.query(MedicineOccurrence)
        .filter(
            MedicineOccurrence.id == occurrence_id,
            MedicineOccurrence.child_id == child.id,
        )
        .first()
    )
    if not occ:
        raise HTTPException(status_code=404, detail="Scheduled medicine occurrence not found.")

    file_path, file_name, file_size, mime_type = await save_proof_image(file, occ.id)

    # Check if proof already exists
    existing_proof = db.query(MedicineProof).filter(MedicineProof.occurrence_id == occ.id).first()
    if existing_proof:
        existing_proof.file_path = file_path
        existing_proof.file_name = file_name
        existing_proof.file_size = file_size
        existing_proof.mime_type = mime_type
        existing_proof.uploaded_at = datetime.now()
        existing_proof.notes = notes
    else:
        new_proof = MedicineProof(
            occurrence_id=occ.id,
            child_id=child.id,
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            notes=notes,
        )
        db.add(new_proof)

    occ.status = OccurrenceStatus.PENDING_VERIFICATION
    if not occ.taken_at:
        occ.taken_at = datetime.now()

    db.commit()
    db.refresh(occ)

    # In-app notification and email to parent
    parent = db.query(User).filter(User.id == occ.parent_id).first()
    med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
    med_name = med.name if med else "Medicine"

    notif = Notification(
        user_id=occ.parent_id,
        type=NotificationType.PROOF_UPLOADED,
        title=f"📸 Proof Uploaded by {child.name}",
        message=f"{child.name} uploaded photo proof for {med_name}. Ready for review.",
        link="/parent/dashboard",
    )
    db.add(notif)
    db.commit()

    if parent:
        alert_dest = parent.alert_email or parent.email
        if alert_dest:
            send_proof_uploaded_email(
                db=db,
                parent_email=alert_dest,
                parent_name=parent.name,
                child_name=child.name,
                medicine_name=med_name,
                occurrence_id=occ.id,
            )

    return _format_occurrence(occ, db)


@router.get("/api/child/history", response_model=List[OccurrenceResponse])
def get_child_history(
    days: int = 7,
    child: User = Depends(require_child),
    db: Session = Depends(get_db),
):
    since_date = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
    occurrences = (
        db.query(MedicineOccurrence)
        .filter(
            MedicineOccurrence.child_id == child.id,
            MedicineOccurrence.scheduled_time >= since_date,
        )
        .order_by(MedicineOccurrence.scheduled_time.desc())
        .all()
    )
    return [_format_occurrence(o, db) for o in occurrences]


# ---------------- PARENT ENDPOINTS ----------------

@router.get("/api/parent/dashboard/stats", response_model=DashboardStatsResponse)
def get_parent_dashboard_stats(
    child_id: Optional[int] = None,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    query = db.query(MedicineOccurrence).filter(
        MedicineOccurrence.parent_id == parent.id,
        MedicineOccurrence.scheduled_time >= today_start,
        MedicineOccurrence.scheduled_time <= today_end,
    )

    connections = db.query(ParentChildRelationship).filter_by(
        parent_id=parent.id, status=RelationshipStatus.ACCEPTED
    )
    if child_id:
        connections = connections.filter_by(child_id=child_id)
        query = query.filter(MedicineOccurrence.child_id == child_id)
    connection = connections.first()
    if child_id and connection is None:
        raise HTTPException(status_code=404, detail="Child connection not found.")
    target_child = db.get(User, connection.child_id) if connection else None

    today_occurrences = query.order_by(MedicineOccurrence.scheduled_time.asc()).all()

    total_today = len(today_occurrences)
    taken_today = sum(1 for o in today_occurrences if o.status in [OccurrenceStatus.TAKEN, OccurrenceStatus.TAKEN_LATE, OccurrenceStatus.VERIFIED, OccurrenceStatus.PENDING_VERIFICATION])
    missed_today = sum(1 for o in today_occurrences if o.status == OccurrenceStatus.MISSED)
    pending_today = total_today - taken_today - missed_today

    adherence_rate = round((taken_today / total_today * 100), 1) if total_today > 0 else 100.0

    now = datetime.now()
    next_med = next((o for o in today_occurrences if o.scheduled_time >= now and o.status in [OccurrenceStatus.UPCOMING, OccurrenceStatus.DUE, OccurrenceStatus.SNOOZED]), None)
    last_conf = next((o for o in reversed(today_occurrences) if o.status in [OccurrenceStatus.TAKEN, OccurrenceStatus.VERIFIED, OccurrenceStatus.PENDING_VERIFICATION]), None)

    latest_missed = next((o for o in reversed(today_occurrences) if o.status == OccurrenceStatus.MISSED), None)
    return DashboardStatsResponse(
        latest_missed=_format_occurrence(latest_missed, db) if latest_missed else None,
        total_today=total_today,
        taken_today=taken_today,
        pending_today=max(0, pending_today),
        missed_today=missed_today,
        adherence_rate=adherence_rate,
        child_name=target_child.name if target_child else None,
        child_status="Active" if target_child else "No Child Connected",
        next_medicine=_format_occurrence(next_med, db) if next_med else None,
        last_confirmed=_format_occurrence(last_conf, db) if last_conf else None,
    )


@router.get("/api/parent/schedule", response_model=List[OccurrenceResponse])
def get_parent_schedule(
    range_type: str = "today",  # "today", "tomorrow", "week"
    child_id: Optional[int] = None,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    today = date.today()
    if range_type == "tomorrow":
        start_d = datetime.combine(today + timedelta(days=1), datetime.min.time())
        end_d = datetime.combine(today + timedelta(days=1), datetime.max.time())
    elif range_type == "week":
        start_d = datetime.combine(today, datetime.min.time())
        end_d = datetime.combine(today + timedelta(days=7), datetime.max.time())
    else:  # today
        start_d = datetime.combine(today, datetime.min.time())
        end_d = datetime.combine(today, datetime.max.time())

    query = db.query(MedicineOccurrence).filter(
        MedicineOccurrence.parent_id == parent.id,
        MedicineOccurrence.scheduled_time >= start_d,
        MedicineOccurrence.scheduled_time <= end_d,
    )
    if child_id:
        query = query.filter(MedicineOccurrence.child_id == child_id)

    occurrences = query.order_by(MedicineOccurrence.scheduled_time.asc()).all()
    return [_format_occurrence(o, db) for o in occurrences]


@router.get("/api/parent/history", response_model=List[OccurrenceResponse])
def get_parent_history(
    days: int = 7,
    status_filter: Optional[str] = None,
    child_id: Optional[int] = None,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    since_date = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
    query = db.query(MedicineOccurrence).filter(
        MedicineOccurrence.parent_id == parent.id,
        MedicineOccurrence.scheduled_time >= since_date,
    )

    if child_id:
        query = query.filter(MedicineOccurrence.child_id == child_id)

    if status_filter:
        query = query.filter(MedicineOccurrence.status == status_filter.upper())

    occurrences = query.order_by(MedicineOccurrence.scheduled_time.desc()).all()
    return [_format_occurrence(o, db) for o in occurrences]


@router.post("/api/parent/confirmations/{occurrence_id}/verify", response_model=OccurrenceResponse)
def verify_medicine_proof(
    occurrence_id: int,
    payload: Optional[ParentVerificationRequest] = None,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    occ = (
        db.query(MedicineOccurrence)
        .filter(
            MedicineOccurrence.id == occurrence_id,
            MedicineOccurrence.parent_id == parent.id,
        )
        .first()
    )
    if not occ:
        raise HTTPException(status_code=404, detail="Occurrence not found.")

    occ.status = OccurrenceStatus.VERIFIED

    proof = db.query(MedicineProof).filter(MedicineProof.occurrence_id == occ.id).first()
    if proof:
        proof.verified_at = datetime.now()
        proof.verified_by_id = parent.id
        if payload and payload.notes:
            proof.notes = payload.notes

    db.commit()
    db.refresh(occ)

    # In-app notification for child
    med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
    med_name = med.name if med else "Medicine"

    notif = Notification(
        user_id=occ.child_id,
        type=NotificationType.PARENT_VERIFIED,
        title="🌟 Medicine Verified by Parent",
        message=f"{parent.name} reviewed and verified your {med_name} proof!",
        link="/child/history",
    )
    db.add(notif)
    db.commit()

    return _format_occurrence(occ, db)


@router.post("/api/parent/confirmations/{occurrence_id}/request-reconfirmation", response_model=OccurrenceResponse)
def request_reconfirmation(
    occurrence_id: int,
    payload: Optional[ParentVerificationRequest] = None,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    occ = (
        db.query(MedicineOccurrence)
        .filter(
            MedicineOccurrence.id == occurrence_id,
            MedicineOccurrence.parent_id == parent.id,
        )
        .first()
    )
    if not occ:
        raise HTTPException(status_code=404, detail="Occurrence not found.")

    occ.status = OccurrenceStatus.RECONFIRMATION_REQUIRED
    db.commit()
    db.refresh(occ)

    med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
    med_name = med.name if med else "Medicine"

    reason = payload.notes if (payload and payload.notes) else "Please upload a clearer photo."

    notif = Notification(
        user_id=occ.child_id,
        type=NotificationType.RECONFIRMATION_REQUIRED,
        title="⚠️ Reconfirmation Requested",
        message=f"{parent.name} requested reconfirmation for {med_name}: {reason}",
        link="/child/dashboard",
    )
    db.add(notif)
    db.commit()

    return _format_occurrence(occ, db)
