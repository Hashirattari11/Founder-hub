from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase
from app.schemas.profile import ProfileOut

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/{username}", response_model=ProfileOut)
async def get_profile_by_username(username: str):
    """Fetch a public profile by username."""
    result = (
        supabase.table("profiles")
        .select("*")
        .eq("username", username.lower())
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return result.data[0]
