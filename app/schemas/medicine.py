from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from app.models.medicine import MedicineFrequency


class MedicineCreate(BaseModel):
    child_id: int
    name: str
    dosage: str
    instructions: Optional[str] = None
    frequency: MedicineFrequency = MedicineFrequency.DAILY
    times_of_day: str  # e.g., "08:00,20:00"
    specific_days: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    instructions: Optional[str] = None
    frequency: Optional[MedicineFrequency] = None
    times_of_day: Optional[str] = None
    specific_days: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class MedicineResponse(BaseModel):
    id: int
    parent_id: int
    child_id: int
    name: str
    dosage: str
    instructions: Optional[str] = None
    frequency: MedicineFrequency
    times_of_day: str
    specific_days: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
