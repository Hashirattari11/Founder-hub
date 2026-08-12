"""Message notification batching — one email per chat per time window."""
import time
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.core.supabase import service_supabase

# Wait before sending so bursts collapse into one email.
MESSAGE_SEND_DELAY_SECONDS = 180
# Dedupe bucket — must be >= delay so only one queued row per burst.
MESSAGE_DEDUPE_WINDOW_SECONDS = 900


def message_dedupe_key(chat_id: str, receiver_id: str) -> str:
    bucket = int(time.time() // MESSAGE_DEDUPE_WINDOW_SECONDS)
    return f"message:{chat_id}:{receiver_id}:{bucket}"


def count_recent_messages(chat_id: str, receiver_id: str, sender_id: str) -> int:
    """Count messages from sender in this chat within the dedupe window."""
    if not service_supabase.available:
        return 1
    try:
        since = (
            datetime.now(timezone.utc) - timedelta(seconds=MESSAGE_DEDUPE_WINDOW_SECONDS)
        ).isoformat()
        rows = (
            service_supabase.table("messages")
            .select("id", count="exact")
            .eq("chat_id", chat_id)
            .eq("sender_id", sender_id)
            .gte("created_at", since)
            .execute()
        )
        return max(1, rows.count or 1)
    except Exception:
        return 1


def message_action_url(sender_id: str) -> str:
    return settings.frontend_url_for(f"/messages?user={sender_id}")


def message_notify_payload(
    *,
    chat_id: str,
    receiver_id: str,
    sender_id: str,
    sender_name: str,
    preview: str | None = None,
) -> dict:
    """Build template_data + dedupe_key for a batched message email."""
    count = count_recent_messages(chat_id, receiver_id, sender_id)
    safe_preview = (preview or "").strip()[:120]
    return {
        "dedupe_key": message_dedupe_key(chat_id, receiver_id),
        "send_delay_seconds": MESSAGE_SEND_DELAY_SECONDS,
        "template_data": {
            "user_name": None,  # filled by notify()
            "from_name": sender_name,
            "message_count": count,
            "message_preview": safe_preview,
            "action_url": message_action_url(sender_id),
            "action_label": "Open Message",
            "chat_id": chat_id,
            "sender_id": sender_id,
        },
        "title": (
            f"{count} new messages from {sender_name}"
            if count > 1
            else f"New message from {sender_name}"
        ),
        "body": (
            f"You have {count} new messages from {sender_name} on FounderHub."
            if count > 1
            else f"{sender_name} sent you a message on FounderHub."
        ),
    }
