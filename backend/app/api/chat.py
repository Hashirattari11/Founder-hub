import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.auth import get_user_client, get_user_id
from app.schemas.chat import ChatMessageIn, ChatMessageOut, ChatOut, ChatStartIn

router = APIRouter(prefix="/api", tags=["chat"])

CHAT_PROFILE_FIELDS = (
    "id, full_name, username, avatar_url, role, is_online, last_seen"
)


def _fetch_chat_with_profiles(user_client, chat_id: str) -> dict:
    """Reload a chat row with both participant profile embeds."""
    result = (
        user_client.table("chats")
        .select(
            f"*, "
            f"participant_1_profile:profiles!chats_participant_1_fkey({CHAT_PROFILE_FIELDS}), "
            f"participant_2_profile:profiles!chats_participant_2_fkey({CHAT_PROFILE_FIELDS})"
        )
        .eq("id", chat_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Chat not found")
    return rows[0]


@router.post("/chats/start", response_model=ChatOut)
async def start_chat(
    payload: ChatStartIn,
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Get (or create) a chat between the current user and receiver_id."""
    if payload.receiver_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot start a chat with yourself")

    receiver = (
        user_client.table("profiles")
        .select("id")
        .eq("id", payload.receiver_id)
        .limit(1)
        .execute()
    )
    if not receiver.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Normalize participant order so the unique constraint finds existing chats.
    p1, p2 = sorted([user_id, payload.receiver_id])

    existing = (
        user_client.table("chats")
        .select("*")
        .eq("participant_1", p1)
        .eq("participant_2", p2)
        .limit(1)
        .execute()
    )
    if existing.data:
        return _fetch_chat_with_profiles(user_client, existing.data[0]["id"])

    inserted = (
        user_client.table("chats")
        .insert({"participant_1": p1, "participant_2": p2})
        .execute()
    )
    if not inserted.data:
        raise HTTPException(status_code=409, detail="Could not create chat")

    return _fetch_chat_with_profiles(user_client, inserted.data[0]["id"])


@router.get("/chats", response_model=list[ChatOut])
async def list_chats(
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """All chats for the current user, newest first."""
    result = (
        user_client.table("chats")
        .select(
            f"*, "
            f"participant_1_profile:profiles!chats_participant_1_fkey({CHAT_PROFILE_FIELDS}), "
            f"participant_2_profile:profiles!chats_participant_2_fkey({CHAT_PROFILE_FIELDS})"
        )
        .or_(f"participant_1.eq.{user_id},participant_2.eq.{user_id}")
        .order("last_message_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/chats/{chat_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(
    chat_id: str,
    before: Optional[str] = Query(default=None),
    user_client=Depends(get_user_client),
):
    """Messages for a chat, 50 at a time, newest-first pages returned ascending."""
    query = (
        user_client.table("messages")
        .select("*")
        .eq("chat_id", chat_id)
        .order("created_at", desc=True)
        .limit(50)
    )

    if before:
        anchor = (
            user_client.table("messages")
            .select("created_at")
            .eq("id", before)
            .limit(1)
            .execute()
        )
        if anchor.data:
            query = query.lt("created_at", anchor.data[0]["created_at"])

    result = query.execute()
    rows = list(result.data or [])
    rows.reverse()
    return rows


@router.post("/messages/{chat_id}/read", response_model=dict)
async def mark_chat_read(
    chat_id: str,
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Mark every message in a chat as read for the current user.

    Uses the SECURITY DEFINER RPC `mark_chat_messages_read` (runs as the
    service role) because the plain RLS-scoped update silently failed and
    left messages unread even after the user opened the chat.
    """
    result = (
        user_client.rpc(
            "mark_chat_messages_read",
            {"p_chat_id": chat_id, "p_user_id": user_id},
        )
        .execute()
    )
    updated = 0
    if result.data is not None:
        if isinstance(result.data, list):
            updated = int((result.data[0] or {}).get("mark_chat_messages_read") or 0) if result.data else 0
        else:
            updated = int(result.data)
    return {"updated": updated}


@router.post("/messages/{chat_id}/send", response_model=ChatMessageOut)
async def send_chat_message(
    chat_id: str,
    payload: ChatMessageIn,
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Send a message in a chat you belong to.

    Inserting happens here (not the browser) so we can notify the other
    participant (bell + email + push) and stamp `last_message_at` on the chat.
    """
    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chat = (
        user_client.table("chats")
        .select("participant_1, participant_2")
        .eq("id", chat_id)
        .limit(1)
        .execute()
    )
    row = (chat.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="Chat not found")
    if user_id not in (row["participant_1"], row["participant_2"]):
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")

    receiver_id = row["participant_2"] if row["participant_1"] == user_id else row["participant_1"]

    inserted = (
        user_client.table("messages")
        .insert({
            "chat_id": chat_id,
            "sender_id": user_id,
            "content": content,
        })
        .execute()
    )
    msg = (inserted.data or [None])[0]
    if not msg:
        raise HTTPException(status_code=500, detail="Could not save message")

    # Keep the chat list ordering fresh.
    try:
        user_client.table("chats").update({"last_message_at": msg.get("created_at")}).eq("id", chat_id).execute()
    except Exception:
        pass

    # Notify the other participant without blocking the send path.
    try:
        from app.services.notification_service import notify
        from app.core.users import user_full_name

        sender_name = user_full_name(user_id) or "Someone"
        notify(
            receiver_id,
            "message_received",
            "New message",
            f"{sender_name} sent you a message.",
            {"chat_id": chat_id, "sender_id": user_id, "message_id": msg.get("id")},
            email=True,
            template="message_received",
            template_data={
                "from_name": sender_name,
                "action_url": f"{_frontend_base()}/messages",
                "action_label": "Open Chat",
            },
            dedupe_key=f"message:{chat_id}:{user_id}:{msg.get('id')}",
        )
    except Exception as exc:  # pragma: no cover
        print(f"[chat.send] notify failed: {exc}")

    return msg


def _frontend_base() -> str:
    from app.core.config import settings
    return settings.frontend_url_for("")


@router.post("/upload/chat-file", response_model=dict)
async def upload_chat_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Upload a chat attachment to the public 'chat-files' bucket."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    suffix = Path(file.filename or "").suffix or ""
    path = f"{user_id}/{uuid.uuid4()}{suffix}"

    try:
        user_client.storage.from_("chat-files").upload(
            path,
            content,
            {"content-type": file.content_type or "application/octet-stream"},
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Upload failed: {exc}") from exc

    url = user_client.storage.from_("chat-files").get_public_url(path)
    return {
        "url": url,
        "path": path,
        "name": file.filename,
        "size": len(content),
        "content_type": file.content_type,
    }
