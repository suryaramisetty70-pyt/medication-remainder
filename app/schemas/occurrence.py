from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.occurrence import OccurrenceStatus


class ProofResponse(BaseModel):
    id: int
    occurrence_id: int
    child_id: int
    file_name: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
    verified_at: Optional[datetime] = None
    verified_by_id: Optional[int] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class OccurrenceResponse(BaseModel):
    id: int
    medicine_id: int
    medicine_name: str
    dosage: str
    instructions: Optional[str] = None
    child_id: int
    child_name: str
    child_phone: Optional[str] = None
    scheduled_time: datetime
    grace_until: datetime
    status: OccurrenceStatus
    snooze_count: int
    taken_at: Optional[datetime] = None
    proof: Optional[ProofResponse] = None

    class Config:
        from_attributes = True


class ConfirmMedicineRequest(BaseModel):
    notes: Optional[str] = None


class SnoozeMedicineRequest(BaseModel):
    minutes: int = 10


class ParentVerificationRequest(BaseModel):
    notes: Optional[str] = None


class DashboardStatsResponse(BaseModel):
    total_today: int
    taken_today: int
    pending_today: int
    missed_today: int
    adherence_rate: float
    child_name: Optional[str] = None
    child_status: str = "Active"
    next_medicine: Optional[OccurrenceResponse] = None
    last_confirmed: Optional[OccurrenceResponse] = None
