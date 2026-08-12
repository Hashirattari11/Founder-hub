import time

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.supabase import service_supabase
from app.core.users import user_email
from app.services.notification_service import notify, broadcast
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


def _frontend_url(path: str) -> str:
    return settings.frontend_url_for(path)


def _sender_username(user_id: str) -> str | None:
    try:
        row = (
            service_supabase.table("profiles")
            .select("username")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return (row.data[0] or {}).get("username") or None
    except Exception:
        return None


def _email_html(body: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="margin-bottom:4px">Hi there,</h2>
      <p style="color:#6b7280;margin-top:0">{body}</p>
      <p style="color:#6b7280">Log in to FounderHub to view and reply.</p>
      <p style="color:#6b7280">— FounderHub AI</p>
    </div>
    """


def _message_dedupe_key(chat_id: str, receiver_id: str) -> str:
    """Time-windowed dedupe: one email per chat per minute, so every new
    message burst still produces a fresh email without flooding the inbox."""
    bucket = int(time.time() // 60)
    return f"message:{chat_id}:{receiver_id}:{bucket}"


def _broadcast_startup_published(startup: dict, exclude_ids: set[str]) -> int:
    """Email + notify every other user about a newly published startup.

    Respects each user's notification preferences (marketing/email_enabled).
    Matched talent/investors are excluded so they don't get a second, less
    targeted email.
    """
    try:
        rows = (
            service_supabase.table("profiles")
            .select("id")
            .execute()
        )
        user_ids = [r["id"] for r in (rows.data or [])]
    except Exception as exc:
        print(f"[notify] failed to list users for startup broadcast: {exc}")
        return 0

    startup_id = startup.get("id")
    startup_name = startup.get("name") or "A new startup"
    exclude_ids = exclude_ids or set()

    count = 0
    for uid in user_ids:
        if uid in exclude_ids or str(uid) == str(startup.get("founder_id")):
            continue
        try:
            notify(
                uid,
                "startup_new",
                f"{startup_name} just launched",
                f"A new startup just launched on FounderHub: {startup_name}",
                {
                    "startup_id": startup_id,
                    "url": f"/startups/{startup_id}",
                },
                template="startup_new",
                template_data={
                    "startup_name": startup_name,
                    "tagline": startup.get("tagline") or "",
                    "industry": startup.get("industry") or "",
                    "action_url": _frontend_url(f"/startups/{startup_id}"),
                },
                dedupe_key=f"startup_new:{startup_id}:{uid}",
            )
            count += 1
        except Exception as exc:
            print(f"[notify] failed startup broadcast to {uid}: {exc}")
    return count


@router.post("/notify/message")
async def notify_message(
    payload: MessageNotifyIn,
    sender_id: str = Depends(get_user_id),
):
    """Best-effort email + push to the receiver when a message is sent (fire-and-forget from the client)."""
    if payload.receiver_id == sender_id:
        return {"sent": False}
    try:
        chat = (
            service_supabase.table("chats")
            .select("id, participant_1, participant_2")
            .eq("id", payload.chat_id)
            .limit(1)
            .execute()
        )
        row = (chat.data or [None])[0]
    except Exception:
        row = None
    if not row:
        raise HTTPException(status_code=404, detail="Chat not found")
    participants = {str(row.get("participant_1")), str(row.get("participant_2"))}
    if str(sender_id) not in participants or str(payload.receiver_id) not in participants:
        raise HTTPException(status_code=403, detail="Not a participant of this chat")
    email = _receiver_email(payload.receiver_id)
    if not email:
        return {"sent": False}
    name = _sender_name(sender_id)
    notify(
        payload.receiver_id,
        "message_received",
        f"New message from {name}",
        f"{name} sent you a message on FounderHub.",
        {
            "sender_id": sender_id,
            "chat_id": payload.chat_id,
            "url": f"/messages?user={sender_id}",
        },
        template="message_received",
        template_data={
            "from_name": name,
            "action_url": _frontend_url(f"/messages?user={sender_id}"),
            "action_label": "Open Chat",
        },
        dedupe_key=_message_dedupe_key(payload.chat_id, payload.receiver_id),
    )
    enqueue_push(
        payload.receiver_id,
        f"{name} sent you a message",
        "Tap to open the chat.",
        {"url": f"/messages?user={sender_id}"},
    )
    return {"sent": True}


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
    requester_username = _sender_username(requester_id)
    notify(
        payload.receiver_id,
        "connection_request",
        f"{name} wants to connect",
        f"{name} wants to connect with you on FounderHub.",
        {
            "requester_id": requester_id,
            "requester_username": requester_username,
            "url": f"/profile/{requester_username}" if requester_username else "/dashboard",
        },
        template="connection_request",
        template_data={
            "from_name": name,
            "action_url": _frontend_url(f"/profile/{requester_username}" if requester_username else "/dashboard"),
            "action_label": "View Profile",
        },
        dedupe_key=f"connection_request:{requester_id}:{payload.receiver_id}:{int(time.time() // 300)}",
    )
    enqueue_push(
        payload.receiver_id,
        f"{name} wants to connect",
        "Accept or decline the connection request.",
        {"url": f"/profile/{requester_username}" if requester_username else "/dashboard"},
    )
    return {"sent": True}


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

    talent_count, talent_ids = notify_matched_users(startup)
    investor_count, investor_ids = notify_investors(startup)

    already_notified = set(talent_ids + investor_ids)
    broadcast_count = _broadcast_startup_published(startup, exclude_ids=already_notified)

    return {
        "success": True,
        "startup": startup.get("name"),
        "notified": talent_count + investor_count + broadcast_count,
        "matched_talent": talent_count,
        "matched_investors": investor_count,
        "broadcast_all": broadcast_count,
    }
