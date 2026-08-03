from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class StartupOut(BaseModel):
    id: str
    founder_id: Optional[str] = None
    name: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    funding_needed: Optional[str] = None
    equity_offered: Optional[float] = None
    location: Optional[str] = None
    website_url: Optional[str] = None
    pitch_deck_url: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    team_roles_needed: Optional[List[str]] = None
    is_published: Optional[bool] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
