import asyncio
import sys
from datetime import date, datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.occurrence import MedicineOccurrence, OccurrenceStatus
from app.models.notification import Notification, NotificationType
from app.models.medicine import Medicine
from app.models.user import User
from app.services.occurrence_service import generate_occurrences_for_medicine
from app.services.email_service import send_missed_medicine_alert


def check_and_update_occurrences(db: Session) -> dict:
    """
    Core missed dose detection and status transition job.
    1. UPCOMING -> DUE (when scheduled_time <= now)
    2. DUE/SNOOZED -> MISSED (when grace_until <= now) + send parent alert email
    """
    now = datetime.now()
    results = {"due_count": 0, "missed_count": 0}

    # 1. UPCOMING -> DUE
    upcoming_to_due = (
        db.query(MedicineOccurrence).join(Medicine).filter(Medicine.is_active.is_(True))
        .filter(
            MedicineOccurrence.status == OccurrenceStatus.UPCOMING,
            MedicineOccurrence.scheduled_time <= now,
        )
        .all()
    )

    for occ in upcoming_to_due:
        occ.status = OccurrenceStatus.DUE
        results["due_count"] += 1

        # In-app notification for child
        med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
        med_name = med.name if med else "Medicine"
        dosage = med.dosage if med else ""

        notif = Notification(
            user_id=occ.child_id,
            type=NotificationType.MEDICINE_DUE,
            title=f"🔔 Medicine Reminder: {med_name}",
            message=f"It's time to take your {med_name} ({dosage}). Please take it now.",
            link="/child/dashboard",
        )
        db.add(notif)

    if upcoming_to_due:
        db.commit()

    # 2. DUE / SNOOZED -> MISSED
    overdue_occurrences = (
        db.query(MedicineOccurrence).join(Medicine).filter(Medicine.is_active.is_(True))
        .filter(
            MedicineOccurrence.status.in_([OccurrenceStatus.DUE, OccurrenceStatus.SNOOZED]),
            MedicineOccurrence.grace_until <= now,
        )
        .all()
    )

    for occ in overdue_occurrences:
        occ.status = OccurrenceStatus.MISSED
        results["missed_count"] += 1

        med = db.query(Medicine).filter(Medicine.id == occ.medicine_id).first()
        child = db.query(User).filter(User.id == occ.child_id).first()
        parent = db.query(User).filter(User.id == occ.parent_id).first()

        med_name = med.name if med else "Medicine"
        dosage = med.dosage if med else ""
        child_name = child.name if child else "Child"
        child_phone = child.phone if child else None
        parent_name = parent.name if parent else "Parent"
        alert_email = (parent.alert_email or parent.email) if parent else None
        time_str = occ.scheduled_time.strftime("%I:%M %p")

        # In-app notification for parent
        notif = Notification(
            user_id=occ.parent_id,
            type=NotificationType.MEDICINE_MISSED,
            title=f"⚠️ Missed Medicine: {child_name} missed {med_name}",
            message=f"{child_name} did not confirm {med_name} ({dosage}) scheduled for {time_str}.",
            link="/parent/dashboard",
        )
        db.add(notif)

        # Send Real Warning Email to Parent
        if alert_email:
            send_missed_medicine_alert(
                db=db,
                parent_alert_email=alert_email,
                parent_name=parent_name,
                child_name=child_name,
                child_phone=child_phone,
                medicine_name=med_name,
                dosage=dosage,
                scheduled_time=time_str,
                occurrence_id=occ.id,
            )

    if overdue_occurrences:
        db.commit()

    return results


async def scheduler_loop(interval_seconds: int = 30):
    """Async background task that runs the scheduler periodically."""
    print("[SCHEDULER] CareSync Missed Dose Background Worker Started.")
    last_extended = None
    while True:
        try:
            db = SessionLocal()
            try:
                today = date.today()
                if last_extended != today:
                    latest_dates = dict(db.query(
                        MedicineOccurrence.medicine_id, func.max(MedicineOccurrence.scheduled_time)
                    ).group_by(MedicineOccurrence.medicine_id).all())
                    for medicine in db.query(Medicine).filter_by(is_active=True):
                        latest = latest_dates.get(medicine.id)
                        first_day = max(today, latest.date() + timedelta(days=1)) if latest else today
                        generate_occurrences_for_medicine(db, medicine, from_date=first_day)
                    last_extended = today
                check_and_update_occurrences(db)
            finally:
                db.close()
        except Exception as e:
            print(f"[SCHEDULER ERROR] Error in worker loop: {e}", file=sys.stderr)

        await asyncio.sleep(interval_seconds)
