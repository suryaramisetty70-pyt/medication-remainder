from datetime import datetime, date, time, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.medicine import Medicine, MedicineFrequency
from app.models.occurrence import MedicineOccurrence, OccurrenceStatus
from app.models.user import User


def parse_time_str(time_str: str) -> time:
    """Parses '08:00' or '8:00 AM' into a Python time object."""
    clean = time_str.strip().upper()
    for fmt in ["%H:%M", "%I:%M %p", "%I:%M%p", "%H:%M:%S"]:
        try:
            return datetime.strptime(clean, fmt).time()
        except ValueError:
            pass
    return time(8, 0)


def generate_occurrences_for_medicine(
    db: Session, medicine: Medicine, days_ahead: int = 14, from_date: Optional[date] = None
) -> List[MedicineOccurrence]:
    """Generates scheduled occurrences for a medicine."""
    parent = db.query(User).filter(User.id == medicine.parent_id).first()
    grace_minutes = parent.grace_period_minutes if parent else 30

    time_strings = [t.strip() for t in medicine.times_of_day.split(",") if t.strip()]
    if not time_strings:
        time_strings = ["08:00"]

    start_d = medicine.start_date
    if not start_d:
        start_d = date.today()

    horizon = date.today() + timedelta(days=days_ahead)
    max_d = min(medicine.end_date or horizon, horizon)
    if medicine.frequency == MedicineFrequency.ONCE:
        max_d = min(max_d, start_d)

    now = datetime.now()
    occurrences_created = []

    current_d = max(start_d, from_date or start_d)
    while current_d <= max_d:
        # Check specific days if set (e.g. MON,WED,FRI)
        if medicine.specific_days:
            day_name = current_d.strftime("%a").upper()
            if day_name not in medicine.specific_days.upper():
                current_d += timedelta(days=1)
                continue

        for t_str in time_strings:
            t_obj = parse_time_str(t_str)
            sched_dt = datetime.combine(current_d, t_obj)
            grace_dt = sched_dt + timedelta(minutes=grace_minutes)

            # Check if this occurrence already exists
            existing = (
                db.query(MedicineOccurrence)
                .filter(
                    MedicineOccurrence.medicine_id == medicine.id,
                    MedicineOccurrence.scheduled_time == sched_dt,
                )
                .first()
            )

            if not existing:
                # Determine initial status
                if sched_dt > now:
                    initial_status = OccurrenceStatus.UPCOMING
                elif now <= grace_dt:
                    initial_status = OccurrenceStatus.DUE
                else:
                    initial_status = OccurrenceStatus.MISSED

                occ = MedicineOccurrence(
                    medicine_id=medicine.id,
                    child_id=medicine.child_id,
                    parent_id=medicine.parent_id,
                    scheduled_time=sched_dt,
                    grace_until=grace_dt,
                    status=initial_status,
                )
                db.add(occ)
                occurrences_created.append(occ)

        current_d += timedelta(days=1)

    db.commit()
    return occurrences_created
