from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel, Field

from app.core.auth import get_user_id
from app.core.security import is_super_admin_user
from app.core.supabase import service_supabase
from app.services.push_service import enqueue_push

router = APIRouter(prefix="/api", tags=["push"])

PLATFORMS = {"ios", "android", "web"}


class RegisterTokenIn(BaseModel):
    token: str = Field(min_length=5, max_length=400)
    platform: str = "ios"


class SendPushIn(BaseModel):
    user_id: str | None = None
    title: str = Field(min_length=1, max_length=180)
    body: str = Field(default="", max_length=400)
    data: dict | None = None


@router.post("/push/token")
async def register_push_token(
    payload: RegisterTokenIn,
    user_id: str = Depends(get_user_id),
):
    """Register a device push token for the authenticated user.

    Keeps a single active token per platform; older tokens for the same
    platform are replaced to avoid stale-device churn.
    """
    platform = (payload.platform or "").lower()
    if platform not in PLATFORMS:
        raise HTTPException(status_code=400, detail="Platform must be ios, android or web")

    if not service_supabase.available:
        raise HTTPException(status_code=503, detail="Push storage is unavailable")

    # Drop any existing token with this exact value (re-registration) and
    # older tokens for the same user+platform.
    service_supabase.table("push_tokens").delete().eq("token", payload.token).execute()
    service_supabase.table("push_tokens").delete().eq("user_id", user_id).eq(
        "platform", platform
    ).execute()

    row = (
        service_supabase.table("push_tokens")
        .insert({"user_id": user_id, "token": payload.token, "platform": platform})
        .execute()
    )
    return {"success": True, "token": row.data[0]["id"] if row.data else None}


@router.post("/push/send")
async def send_push(
    payload: SendPushIn,
    user_id: str = Depends(get_user_id),
):
    """Send a push notification to your own devices (super admins may target any user)."""
    target = payload.user_id or user_id
    if target != user_id and not is_super_admin_user(user_id):
        raise HTTPException(status_code=403, detail="You can only send pushes to your own devices")
    queued = enqueue_push(target, payload.title, payload.body, payload.data)
    return {"success": True, "target": target, "queued": queued}
