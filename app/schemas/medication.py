from datetime import time, datetime

from pydantic import BaseModel, ConfigDict


class MedicationCreate(BaseModel):
    child_id: str
    name: str
    dosage: str
    scheduled_time: time
    notes: str | None = None


class MedicationUpdate(BaseModel):
    name: str | None = None
    dosage: str | None = None
    scheduled_time: time | None = None
    notes: str | None = None
    active: bool | None = None


class MedicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    child_id: str
    name: str
    dosage: str
    scheduled_time: time
    notes: str | None
    active: bool
    created_at: datetime
