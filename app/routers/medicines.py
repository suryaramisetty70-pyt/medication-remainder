from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_parent
from app.models.medicine import Medicine
from app.models.occurrence import MedicineOccurrence, OccurrenceStatus
from app.models.relationship import ParentChildRelationship, RelationshipStatus
from app.models.user import User
from app.schemas.medicine import MedicineCreate, MedicineResponse, MedicineUpdate
from app.services.occurrence_service import generate_occurrences_for_medicine

router = APIRouter(prefix="/api/parent/medicines", tags=["Medicine Management"])


def _assert_can_manage_child(db: Session, parent_id: int, child_id: int):
    rel = (
        db.query(ParentChildRelationship)
        .filter(
            ParentChildRelationship.parent_id == parent_id,
            ParentChildRelationship.child_id == child_id,
            ParentChildRelationship.status == RelationshipStatus.ACCEPTED,
        )
        .first()
    )
    if not rel:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage medicines for connected children who have accepted your request.",
        )


@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
def create_medicine(
    payload: MedicineCreate,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    _assert_can_manage_child(db, parent.id, payload.child_id)

    med = Medicine(
        parent_id=parent.id,
        child_id=payload.child_id,
        name=payload.name.strip(),
        dosage=payload.dosage.strip(),
        instructions=payload.instructions.strip() if payload.instructions else None,
        frequency=payload.frequency,
        times_of_day=payload.times_of_day.strip(),
        specific_days=payload.specific_days.strip() if payload.specific_days else None,
        start_date=payload.start_date or date.today(),
        end_date=payload.end_date,
        is_active=True,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    # Generate scheduled occurrences
    generate_occurrences_for_medicine(db, med, days_ahead=14)

    return MedicineResponse.model_validate(med)


@router.get("", response_model=List[MedicineResponse])
def list_parent_medicines(
    child_id: Optional[int] = None,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    query = db.query(Medicine).filter(Medicine.parent_id == parent.id)
    if child_id:
        query = query.filter(Medicine.child_id == child_id)
    medicines = query.order_by(Medicine.created_at.desc()).all()
    return [MedicineResponse.model_validate(m) for m in medicines]


@router.get("/{medicine_id}", response_model=MedicineResponse)
def get_medicine(
    medicine_id: int,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    med = (
        db.query(Medicine)
        .filter(Medicine.id == medicine_id, Medicine.parent_id == parent.id)
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found.")
    return MedicineResponse.model_validate(med)


@router.put("/{medicine_id}", response_model=MedicineResponse)
def update_medicine(
    medicine_id: int,
    payload: MedicineUpdate,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    med = (
        db.query(Medicine)
        .filter(Medicine.id == medicine_id, Medicine.parent_id == parent.id)
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    if payload.name is not None:
        med.name = payload.name.strip()
    if payload.dosage is not None:
        med.dosage = payload.dosage.strip()
    if payload.instructions is not None:
        med.instructions = payload.instructions.strip()
    if payload.frequency is not None:
        med.frequency = payload.frequency
    if payload.times_of_day is not None:
        med.times_of_day = payload.times_of_day.strip()
    if payload.specific_days is not None:
        med.specific_days = payload.specific_days.strip()
    if payload.start_date is not None:
        med.start_date = payload.start_date
    if payload.end_date is not None:
        med.end_date = payload.end_date
    if payload.is_active is not None:
        med.is_active = payload.is_active
    if payload.notes is not None:
        med.notes = payload.notes.strip()

    db.commit()
    db.refresh(med)

    # Regenerate future occurrences
    generate_occurrences_for_medicine(db, med, days_ahead=14)

    return MedicineResponse.model_validate(med)


@router.post("/{medicine_id}/toggle-active", response_model=MedicineResponse)
def toggle_medicine_active(
    medicine_id: int,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    med = (
        db.query(Medicine)
        .filter(Medicine.id == medicine_id, Medicine.parent_id == parent.id)
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    med.is_active = not med.is_active
    db.commit()
    db.refresh(med)
    return MedicineResponse.model_validate(med)


@router.delete("/{medicine_id}")
def delete_medicine(
    medicine_id: int,
    parent: User = Depends(require_parent),
    db: Session = Depends(get_db),
):
    med = (
        db.query(Medicine)
        .filter(Medicine.id == medicine_id, Medicine.parent_id == parent.id)
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    db.delete(med)
    db.commit()
    return {"message": "Medicine deleted successfully."}
