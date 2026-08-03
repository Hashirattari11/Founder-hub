import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.auth import get_user_client, get_user_id
from app.schemas.chat import ChatMessageOut, ChatOut, ChatStartIn

router = APIRouter(prefix="/api", tags=["chat"])

CHAT_PROFILE_FIELDS = (
    "id, full_name, avatar_url, role, is_online, last_seen"
)


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
        return existing.data[0]

    inserted = (
        user_client.table("chats")
        .insert({"participant_1": p1, "participant_2": p2})
        .execute()
    )
    if not inserted.data:
        raise HTTPException(status_code=409, detail="Could not create chat")

    return inserted.data[0]


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
    """Mark every message in a chat as read for the current user."""
    result = (
        user_client.table("messages")
        .update({"is_read": True})
        .eq("chat_id", chat_id)
        .neq("sender_id", user_id)
        .execute()
    )
    return {"updated": len(result.data or [])}


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
