from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.supabase import supabase
from app.schemas.startup import StartupOut

router = APIRouter(prefix="/api/startups", tags=["startups"])


@router.get("", response_model=list[StartupOut])
async def list_startups(
    industry: Optional[str] = Query(default=None),
    stage: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    """List published startups, optionally filtered by industry / stage / search."""
    query = (
        supabase.table("startups")
        .select("*")
        .eq("is_published", True)
        .order("created_at", desc=True)
    )

    if industry:
        query = query.eq("industry", industry)
    if stage:
        query = query.eq("stage", stage)
    if search:
        query = query.ilike("name", f"%{search}%")

    result = query.execute()
    if not result.data:
        return []

    return result.data


@router.get("/{startup_id}", response_model=StartupOut)
async def get_startup(startup_id: str):
    """Get a single published startup by id."""
    result = (
        supabase.table("startups")
        .select("*")
        .eq("id", startup_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Startup not found")

    startup = result.data[0]
    if not startup.get("is_published"):
        raise HTTPException(status_code=404, detail="Startup not found")

    return startup
