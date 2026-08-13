import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.auth import get_user_client, get_user_id
from app.core.supabase import service_supabase
from app.schemas.chat import ChatMessageIn, ChatMessageOut, ChatOut, ChatStartIn

router = APIRouter(prefix="/api", tags=["chat"])

CHAT_PROFILE_FIELDS = (
    "id, full_name, username, avatar_url, role, is_online, last_seen"
)


def _uuid_eq(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    return str(a).lower() == str(b).lower()


def _normalize_chat_profiles(user_client, chat: dict) -> dict:
    """Always fetch profiles by participant UUID — never trust PostgREST embeds."""
    p1 = chat.get("participant_1")
    p2 = chat.get("participant_2")
    if not p1 or not p2:
        return chat

    result = (
        user_client.table("profiles")
        .select(CHAT_PROFILE_FIELDS)
        .in_("id", [p1, p2])
        .execute()
    )
    by_id = {str(row["id"]).lower(): row for row in (result.data or [])}
    chat["participant_1_profile"] = by_id.get(str(p1).lower())
    chat["participant_2_profile"] = by_id.get(str(p2).lower())
    return chat


def _profile_from_embed(raw) -> dict | None:
    """PostgREST may return an embed as an object or a one-element array."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return raw[0] if raw else None
    return raw if isinstance(raw, dict) else None


def _enrich_chat_for_viewer(user_client, chat: dict, viewer_id: str) -> dict:
    """Attach canonical other-participant fields for the authenticated viewer."""
    p1_profile = _profile_from_embed(chat.get("participant_1_profile"))
    p2_profile = _profile_from_embed(chat.get("participant_2_profile"))
    if not p1_profile or not p2_profile:
        chat = _normalize_chat_profiles(user_client, chat)
        p1_profile = chat.get("participant_1_profile")
        p2_profile = chat.get("participant_2_profile")
    else:
        chat["participant_1_profile"] = p1_profile
        chat["participant_2_profile"] = p2_profile

    p1 = chat.get("participant_1")
    p2 = chat.get("participant_2")
    if _uuid_eq(viewer_id, p1):
        other_id = p2
        other_profile = p2_profile
    elif _uuid_eq(viewer_id, p2):
        other_id = p1
        other_profile = p1_profile
    else:
        other_id = None
        other_profile = None

    # Never attach the viewer's own profile as the "other" participant.
    if other_profile and _uuid_eq(other_profile.get("id"), viewer_id):
        other_profile = None

    chat["other_participant_id"] = other_id
    chat["other_participant_profile"] = other_profile
    return chat


def _fetch_chat_with_profiles(user_client, chat_id: str, viewer_id: str) -> dict:
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
    return _enrich_chat_for_viewer(user_client, rows[0], viewer_id)


def _norm_uuid(value: str | None) -> str:
    if not value:
        return ""
    return str(value).lower()


@router.post("/chats/start", response_model=ChatOut)
async def start_chat(
    payload: ChatStartIn,
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Get (or create) a chat between the current user and receiver_id."""
    viewer_id = _norm_uuid(user_id)
    receiver_id = _norm_uuid(payload.receiver_id)

    if not receiver_id:
        raise HTTPException(status_code=400, detail="Invalid recipient")
    if _uuid_eq(receiver_id, viewer_id):
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
    p1, p2 = sorted([viewer_id, receiver_id])
    if _uuid_eq(p1, p2):
        raise HTTPException(status_code=400, detail="You cannot start a chat with yourself")

    existing = (
        user_client.table("chats")
        .select("*")
        .eq("participant_1", p1)
        .eq("participant_2", p2)
        .limit(1)
        .execute()
    )
    if existing.data:
        return _fetch_chat_with_profiles(user_client, existing.data[0]["id"], user_id)

    inserted = (
        user_client.table("chats")
        .insert({"participant_1": p1, "participant_2": p2})
        .execute()
    )
    if not inserted.data:
        raise HTTPException(status_code=409, detail="Could not create chat")

    return _fetch_chat_with_profiles(user_client, inserted.data[0]["id"], user_id)


@router.get("/chats/unread", response_model=dict)
async def unread_counts(
    user_id: str = Depends(get_user_id),
    user_client=Depends(get_user_client),
):
    """Unread message counts for all of the current user's chats (one query)."""
    chats = (
        user_client.table("chats")
        .select("id")
        .or_(f"participant_1.eq.{user_id},participant_2.eq.{user_id}")
        .execute()
    )
    chat_ids = [row["id"] for row in (chats.data or [])]
    counts: dict[str, int] = {cid: 0 for cid in chat_ids}
    if not chat_ids:
        return counts

    unread = (
        user_client.table("messages")
        .select("chat_id")
        .in_("chat_id", chat_ids)
        .eq("is_read", False)
        .neq("sender_id", user_id)
        .execute()
    )
    for row in unread.data or []:
        cid = row.get("chat_id")
        if cid in counts:
            counts[cid] += 1
    return counts


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
    return [_enrich_chat_for_viewer(user_client, row, user_id) for row in (result.data or [])]


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
    updated = 0
    # Prefer service role — never silently fail because of RLS.
    if service_supabase.available:
        try:
            chat = (
                service_supabase.table("chats")
                .select("participant_1, participant_2")
                .eq("id", chat_id)
                .limit(1)
                .execute()
            )
            row = (chat.data or [None])[0]
            if row and (
                _uuid_eq(user_id, row.get("participant_1"))
                or _uuid_eq(user_id, row.get("participant_2"))
            ):
                res = (
                    service_supabase.table("messages")
                    .update({"is_read": True})
                    .eq("chat_id", chat_id)
                    .neq("sender_id", user_id)
                    .eq("is_read", False)
                    .execute()
                )
                updated = len(res.data or [])
        except Exception as exc:
            print(f"[chat.read] service update failed: {exc}")

    if updated == 0:
        try:
            result = user_client.rpc(
                "mark_chat_messages_read",
                {"p_chat_id": chat_id, "p_user_id": user_id},
            ).execute()
            if result.data is not None:
                if isinstance(result.data, list):
                    updated = int(result.data[0] or 0) if result.data else 0
                elif isinstance(result.data, dict):
                    updated = int(result.data.get("mark_chat_messages_read") or 0)
                else:
                    updated = int(result.data)
        except Exception as exc:
            print(f"[chat.read] rpc failed: {exc}")

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
    if not (_uuid_eq(user_id, row["participant_1"]) or _uuid_eq(user_id, row["participant_2"])):
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")

    receiver_id = (
        row["participant_2"]
        if _uuid_eq(row["participant_1"], user_id)
        else row["participant_1"]
    )

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
        from app.services.message_email import message_notify_payload
        from app.core.users import user_full_name

        sender_name = user_full_name(user_id) or "Someone"
        preview = (content or "").strip()[:120]
        batch = message_notify_payload(
            chat_id=chat_id,
            receiver_id=str(receiver_id),
            sender_id=user_id,
            sender_name=sender_name,
            preview=preview,
        )
        notify(
            receiver_id,
            "message_received",
            batch["title"],
            batch["body"],
            {"chat_id": chat_id, "sender_id": user_id, "message_id": msg.get("id")},
            email=True,
            template="message_received",
            template_data=batch["template_data"],
            dedupe_key=batch["dedupe_key"],
            send_delay_seconds=batch["send_delay_seconds"],
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
