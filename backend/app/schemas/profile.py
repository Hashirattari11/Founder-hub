from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class ProfileOut(BaseModel):
    id: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: Optional[str] = None
    skills: Optional[List[str]] = None
    country: Optional[str] = None
    city: Optional[str] = None
    experience_years: Optional[int] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    twitter_url: Optional[str] = None
    is_open_to_work: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
