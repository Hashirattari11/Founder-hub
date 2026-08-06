from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.email import send_email
from app.core.security import is_admin_user_full
from app.core.supabase import service_supabase
from app.core.users import user_email
from app.services.push_service import enqueue_push

router = APIRouter(prefix="/api", tags=["notifications"])


class MessageNotifyIn(BaseModel):
    receiver_id: str
    chat_id: str


class ConnectionNotifyIn(BaseModel):
    receiver_id: str


def _receiver_email(user_id: str) -> str | None:
    """Look up a user's email via the service role (auth.users is not readable by end users)."""
    return user_email(user_id)


def _sender_name(sender_id: str) -> str:
    try:
        row = (
            service_supabase.table("profiles")
            .select("full_name")
            .eq("id", sender_id)
            .limit(1)
            .execute()
        )
        return (row.data[0] or {}).get("full_name") or "Someone"
    except Exception:
        return "Someone"


def _email_html(body: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="margin-bottom:4px">Hi there,</h2>
      <p style="color:#6b7280;margin-top:0">{body}</p>
      <p style="color:#6b7280">Log in to FounderHub to view and reply.</p>
      <p style="color:#6b7280">— FounderHub AI</p>
    </div>
    """


@router.post("/notify/message")
async def notify_message(
    payload: MessageNotifyIn,
    sender_id: str = Depends(get_user_id),
):
    """Best-effort email + push to the receiver when a message is sent (fire-and-forget from the client)."""
    email = _receiver_email(payload.receiver_id)
    if not email:
        return {"sent": False}
    name = _sender_name(sender_id)
    ok = send_email(
        email,
        f"New message from {name} on FounderHub",
        _email_html(f"{name} sent you a message on FounderHub."),
    )
    enqueue_push(
        payload.receiver_id,
        f"{name} sent you a message",
        "Tap to open the chat.",
        {"url": f"/chat/{payload.chat_id}"},
    )
    return {"sent": ok}


@router.post("/notify/connection-request")
async def notify_connection_request(
    payload: ConnectionNotifyIn,
    requester_id: str = Depends(get_user_id),
):
    """Best-effort email + push to the receiver when a connection request is sent."""
    email = _receiver_email(payload.receiver_id)
    if not email:
        return {"sent": False}
    name = _sender_name(requester_id)
    ok = send_email(
        email,
        f"{name} sent you a connection request on FounderHub",
        _email_html(f"{name} wants to connect with you on FounderHub."),
    )
    enqueue_push(
        payload.receiver_id,
        f"{name} wants to connect",
        "Accept or decline the connection request.",
        {"url": f"/user/{requester_id}"},
    )
    return {"sent": ok}


@router.post("/notify-startup-published/{startup_id}")
async def notify_startup_published(
    startup_id: str,
    user_id: str = Depends(get_user_id),
):
    """Trigger the smart-email pipeline after a founder publishes a startup.

    Matched developers/designers/marketers and investors get a bell
    notification + a rich email (respecting their notification_preferences).
    Emails are recorded in email_logs.
    """
    from app.api.matching import notify_investors, notify_matched_users

    result = (
        service_supabase.table("startups")
        .select("*")
        .eq("id", startup_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Startup not found")

    startup = result.data[0]
    if str(startup.get("founder_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="Only the founder can trigger notifications")
    if not startup.get("is_published"):
        raise HTTPException(status_code=400, detail="Startup is not published")

    talent = notify_matched_users(startup)
    investors = notify_investors(startup)

    return {
        "success": True,
        "startup": startup.get("name"),
        "notified": talent + investors,
        "matched_talent": talent,
        "matched_investors": investors,
    }


@router.get("/admin/email-logs")
async def admin_email_logs(user_id: str = Depends(get_user_id)):
    """Recent email_logs rows (admins only)."""
    if not is_admin_user_full(user_id):
        raise HTTPException(status_code=403, detail="Admins only")

    rows = (
        service_supabase.table("email_logs")
        .select("*")
        .order("sent_at", desc=True)
        .limit(100)
        .execute()
    )
    return {"logs": rows.data or []}
