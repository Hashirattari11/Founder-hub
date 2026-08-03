from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class ApplicationIn(BaseModel):
    startup_id: str
    role_applying_for: str
    cover_message: Optional[str] = None


class StatusUpdateIn(BaseModel):
    status: str


class ApplicationOut(BaseModel):
    id: str
    startup_id: str
    applicant_id: str
    role_applying_for: Optional[str] = None
    cover_message: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
