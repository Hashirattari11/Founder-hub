from fastapi import APIRouter, Depends

from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.email import send_email
from app.core.supabase import service_supabase

router = APIRouter(prefix="/api", tags=["notifications"])


class MessageNotifyIn(BaseModel):
    receiver_id: str
    chat_id: str


class ConnectionNotifyIn(BaseModel):
    receiver_id: str


def _receiver_email(user_id: str) -> str | None:
    """Look up a user's email via the service role (auth.users is not readable by end users)."""
    try:
        response = service_supabase.auth.admin.get_user_by_id(user_id)
        return response.user.email if response and response.user else None
    except Exception:
        return None


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
    """Best-effort email to the receiver when a message is sent (fire-and-forget from the client)."""
    email = _receiver_email(payload.receiver_id)
    if not email:
        return {"sent": False}
    name = _sender_name(sender_id)
    ok = send_email(
        email,
        f"New message from {name} on FounderHub",
        _email_html(f"{name} sent you a message on FounderHub."),
    )
    return {"sent": ok}


@router.post("/notify/connection-request")
async def notify_connection_request(
    payload: ConnectionNotifyIn,
    requester_id: str = Depends(get_user_id),
):
    """Best-effort email to the receiver when a connection request is sent."""
    email = _receiver_email(payload.receiver_id)
    if not email:
        return {"sent": False}
    name = _sender_name(requester_id)
    ok = send_email(
        email,
        f"{name} sent you a connection request on FounderHub",
        _email_html(f"{name} wants to connect with you on FounderHub."),
    )
    return {"sent": ok}
