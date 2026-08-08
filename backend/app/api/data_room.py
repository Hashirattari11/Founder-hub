"""Startup Data Room: docs, access requests, NDA signing, activity logs."""
import re
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.supabase import service_supabase
from app.services.notification_service import notify

router = APIRouter(prefix="/api/data-room", tags=["data-room"])

BUCKET = "data-room-files"
MAX_FILE_BYTES = 25 * 1024 * 1024

CATEGORIES = {
    "pitch_deck": "Pitch Deck",
    "financials": "Financials",
    "legal": "Legal Documents",
    "cap_table": "Cap Table",
    "product": "Product",
    "team": "Team",
    "market_research": "Market Research",
    "contracts": "Contracts",
    "other": "Other",
}

ALLOWED_MIME = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
}

ACCESS_LEVELS = {"view", "download", "full"}
REQUEST_STATUSES = {"pending", "approved", "rejected"}


class CreateRoomIn(BaseModel):
    startup_id: str
    name: Optional[str] = None
    description: Optional[str] = None
    require_nda: bool = False
    nda_text: Optional[str] = None


class UpdateRoomIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    require_nda: Optional[bool] = None
    nda_text: Optional[str] = None


class RequestAccessIn(BaseModel):
    message: Optional[str] = None


class RespondRequestIn(BaseModel):
    status: str
    access_level: Optional[str] = "view"
    expires_at: Optional[str] = None


class GrantAccessIn(BaseModel):
    user_id: str
    access_level: str = "view"
    expires_at: Optional[str] = None


class LogActionIn(BaseModel):
    action: str  # viewed | downloaded | shared


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _notify_user(user_id: str, ntype: str, title: str, body: str, data: Optional[dict] = None) -> bool:
    try:
        result = (
            service_supabase.table("notifications")
            .insert({"user_id": user_id, "type": ntype, "title": title, "body": body, "data": data or {}})
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        print(f"[data-room] failed to notify {user_id}: {exc}")
        return False


def _get_profile(user_id: str) -> dict:
    try:
        result = (
            service_supabase.table("profiles")
            .select("id, full_name, username, avatar_url, role, notification_preferences")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return result.data or {}
    except Exception:
        return {}


def _get_startup(startup_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("startups")
            .select("id, name, founder_id, tagline, industry")
            .eq("id", startup_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _get_data_room(data_room_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("data_rooms")
            .select("*")
            .eq("id", data_room_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _get_data_room_by_startup(startup_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("data_rooms")
            .select("*")
            .eq("startup_id", startup_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _is_founder(user_id: str, startup_id: str) -> bool:
    startup = _get_startup(startup_id)
    return bool(startup and startup.get("founder_id") == user_id)


def _get_access(data_room_id: str, user_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("data_room_access")
            .select("*")
            .eq("data_room_id", data_room_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _access_valid(data_room: dict, access: dict | None) -> bool:
    if not access or not access.get("is_active"):
        return False
    if access.get("expires_at"):
        try:
            expires = datetime.fromisoformat(str(access["expires_at"]).replace("Z", "+00:00"))
            if expires <= datetime.now(timezone.utc):
                return False
        except Exception:
            pass
    if data_room.get("require_nda") and not access.get("nda_signed"):
        return False
    return True


def _sanitize_name(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", name or "file")


def _signed_url(path: str) -> str | None:
    try:
        res = service_supabase.storage.from_(BUCKET).create_signed_url(path, 3600)
        return (res or {}).get("signedURL")
    except Exception as exc:
        print(f"[data-room] signed url failed: {exc}")
        return None


def _delete_storage(path: str) -> None:
    if not path:
        return
    try:
        service_supabase.storage.from_(BUCKET).remove([path])
    except Exception as exc:
        print(f"[data-room] storage remove failed: {exc}")


def _documents(data_room_id: str) -> list[dict]:
    try:
        result = (
            service_supabase.table("data_room_documents")
            .select("*")
            .eq("data_room_id", data_room_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception:
        return []


def _granted_by_name(profile: dict) -> str:
    return profile.get("full_name") or "Someone"


# ---------------------------------------------------------------------------
# Data room CRUD
# ---------------------------------------------------------------------------


@router.post("/create")
async def create_data_room(payload: CreateRoomIn, user_id: str = Depends(get_user_id)):
    if not _is_founder(user_id, payload.startup_id):
        raise HTTPException(status_code=403, detail="Only the startup founder can create a data room")
    existing = _get_data_room_by_startup(payload.startup_id)
    data = {
        "startup_id": payload.startup_id,
        "founder_id": user_id,
        "name": payload.name or "Data Room",
        "description": payload.description,
        "require_nda": payload.require_nda,
        "nda_text": payload.nda_text,
    }
    if existing:
        result = (
            service_supabase.table("data_rooms")
            .update({k: v for k, v in data.items() if k not in ("startup_id", "founder_id")})
            .eq("id", existing["id"])
            .execute()
        )
        return result.data[0]
    result = service_supabase.table("data_rooms").insert(data).execute()
    return result.data[0]


@router.patch("/{data_room_id}")
async def update_data_room(data_room_id: str, payload: UpdateRoomIn, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can update this data room")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        return room
    result = service_supabase.table("data_rooms").update(updates).eq("id", data_room_id).execute()
    return result.data[0]


@router.get("/{startup_id}")
async def get_data_room(startup_id: str, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")

    can_manage = startup.get("founder_id") == user_id
    room = _get_data_room_by_startup(startup_id)
    access = _get_access(room["id"], user_id) if room else None

    effective = None
    if room and _access_valid(room, access):
        effective = access

    documents = []
    if room and (can_manage or effective):
        documents = _documents(room["id"])

    request_status = None
    if room and not can_manage and not effective:
        try:
            req = (
                service_supabase.table("data_room_access_requests")
                .select("status")
                .eq("data_room_id", room["id"])
                .eq("requester_id", user_id)
                .maybe_single()
                .execute()
            )
            request_status = (req.data or {}).get("status")
        except Exception:
            pass

    response = {
        "startup": startup,
        "can_manage": can_manage,
        "data_room": room,
        "documents": documents,
        "request_status": request_status,
        "categories": CATEGORIES,
    }
    if access:
        response["access"] = access
    response["nda_required"] = bool(room and room.get("require_nda"))
    response["nda_pending"] = bool(
        room and room.get("require_nda") and access and not access.get("nda_signed")
    )
    return response


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


@router.post("/{data_room_id}/upload")
async def upload_document(
    data_room_id: str,
    user_id: str = Depends(get_user_id),
    file: UploadFile = File(...),
    name: str = Form(""),
    category: str = Form("other"),
    description: str = Form(""),
    is_confidential: bool = Form(True),
):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can upload documents")

    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File must be under 25MB")

    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    startup_id = room["startup_id"]
    path = f"{startup_id}/{int(time.time() * 1000)}_{_sanitize_name(file.filename)}"
    try:
        service_supabase.storage.from_(BUCKET).upload(
            path,
            content,
            {"content-type": mime},
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Upload failed: {exc}") from exc

    doc = {
        "data_room_id": data_room_id,
        "uploaded_by": user_id,
        "category": category,
        "name": name or file.filename or "Untitled",
        "file_url": path,
        "file_size": len(content),
        "file_type": mime,
        "description": description or None,
        "is_confidential": is_confidential,
    }
    result = service_supabase.table("data_room_documents").insert(doc).execute()
    return result.data[0]


@router.delete("/document/{document_id}")
async def delete_document(document_id: str, user_id: str = Depends(get_user_id)):
    try:
        doc = (
            service_supabase.table("data_room_documents")
            .select("id, data_room_id, file_url")
            .eq("id", document_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    room = _get_data_room(doc["data_room_id"])
    if not room or room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can delete documents")
    service_supabase.table("data_room_documents").delete().eq("id", document_id).execute()
    _delete_storage(doc.get("file_url"))
    return {"success": True}


@router.get("/{data_room_id}/document/{document_id}/signed-url")
async def get_document_signed_url(data_room_id: str, document_id: str, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    is_owner = room.get("founder_id") == user_id
    access = _get_access(data_room_id, user_id)
    if not is_owner and not _access_valid(room, access):
        raise HTTPException(status_code=403, detail="You do not have access to this data room")

    try:
        doc = (
            service_supabase.table("data_room_documents")
            .select("id, file_url")
            .eq("id", document_id)
            .eq("data_room_id", data_room_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    url = _signed_url(doc["file_url"])
    if not url:
        raise HTTPException(status_code=500, detail="Could not generate a signed URL")
    return {"signed_url": url, "expires_in": 3600}


@router.post("/document/{document_id}/log")
async def log_document_action(document_id: str, payload: LogActionIn, user_id: str = Depends(get_user_id)):
    if payload.action not in ("viewed", "downloaded", "shared"):
        raise HTTPException(status_code=400, detail="Invalid action")

    try:
        doc = (
            service_supabase.table("data_room_documents")
            .select("id, data_room_id, name, views_count, downloads_count")
            .eq("id", document_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    room = _get_data_room(doc["data_room_id"])
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")

    is_owner = room.get("founder_id") == user_id
    access = _get_access(doc["data_room_id"], user_id)
    if not is_owner and not _access_valid(room, access):
        raise HTTPException(status_code=403, detail="You do not have access to this data room")
    if payload.action == "downloaded" and not is_owner:
        if not access or access.get("access_level") not in ("download", "full"):
            raise HTTPException(status_code=403, detail="Your access level does not allow downloads")

    if payload.action == "viewed":
        counter = {"views_count": (doc.get("views_count") or 0) + 1}
    elif payload.action == "downloaded":
        counter = {"downloads_count": (doc.get("downloads_count") or 0) + 1}
    else:
        counter = {}

    service_supabase.table("data_room_documents").update(counter).eq("id", document_id).execute()
    service_supabase.table("document_activity_logs").insert(
        {"document_id": document_id, "user_id": user_id, "action": payload.action}
    ).execute()

    if payload.action == "viewed" and not is_owner:
        viewer = _get_profile(user_id)
        founder = _get_profile(room["founder_id"])
        viewer_name = _granted_by_name(viewer)
        _notify_user(
            room["founder_id"],
            "data_room_document_viewed",
            "Document viewed",
            f"{viewer_name} viewed your {doc.get('name') or 'document'}",
            {"document_id": document_id, "startup_id": room["startup_id"]},
        )
        notify(
            room["founder_id"],
            "data_room_document_viewed",
            "Document viewed",
            f"{viewer_name} viewed your {doc.get('name') or 'document'}",
            {"document_id": document_id, "startup_id": room["startup_id"]},
            email=True,
            template="data_room_viewed",
            template_data={
                "user_name": _granted_by_name(founder),
                "from_name": viewer_name,
                "document_name": doc.get("name") or "document",
            },
            dedupe_key=f"data_room_viewed:{room['founder_id']}:{document_id}",
        )

    return {"success": True}


@router.get("/{data_room_id}/activity")
async def get_activity(data_room_id: str, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can view activity logs")

    rows = (
        service_supabase.table("document_activity_logs")
        .select("*, document:data_room_documents!inner(name, data_room_id), user:profiles!document_activity_logs_user_id_fkey(full_name, avatar_url)")
        .eq("document.data_room_id", data_room_id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return {"activity": rows.data or []}


@router.get("/{data_room_id}/access-requests")
async def get_access_requests(data_room_id: str, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can view access requests")

    rows = (
        service_supabase.table("data_room_access_requests")
        .select("*, requester:profiles!data_room_access_requests_requester_id_fkey(full_name, avatar_url, role)")
        .eq("data_room_id", data_room_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"requests": rows.data or []}


@router.get("/{data_room_id}/access-list")
async def get_access_list(data_room_id: str, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can view access")

    rows = (
        service_supabase.table("data_room_access")
        .select("*, user:profiles!data_room_access_user_id_fkey(full_name, avatar_url, role)")
        .eq("data_room_id", data_room_id)
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return {"access": rows.data or []}


# ---------------------------------------------------------------------------
# Access requests & grants
# ---------------------------------------------------------------------------


@router.post("/{data_room_id}/request-access")
async def request_access(data_room_id: str, payload: RequestAccessIn, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") == user_id:
        raise HTTPException(status_code=400, detail="You already own this data room")
    access = _get_access(data_room_id, user_id)
    if access and _access_valid(room, access):
        raise HTTPException(status_code=400, detail="You already have access to this data room")

    existing = (
        service_supabase.table("data_room_access_requests")
        .select("id, status")
        .eq("data_room_id", data_room_id)
        .eq("requester_id", user_id)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        if existing.data["status"] == "pending":
            raise HTTPException(status_code=409, detail="Access request already pending")
        service_supabase.table("data_room_access_requests").update(
            {"status": "pending", "message": payload.message}
        ).eq("id", existing.data["id"]).execute()
    else:
        service_supabase.table("data_room_access_requests").insert(
            {"data_room_id": data_room_id, "requester_id": user_id, "message": payload.message}
        ).execute()

    requester = _get_profile(user_id)
    founder = _get_profile(room["founder_id"])
    requester_name = _granted_by_name(requester)
    startup = _get_startup(room["startup_id"])
    startup_name = (startup or {}).get("name") or "your startup"

    _notify_user(
        room["founder_id"],
        "data_room_access_requested",
        "Data room access requested",
        f"{requester_name} requested access to your {startup_name} data room",
        {"data_room_id": data_room_id, "startup_id": room["startup_id"]},
    )
    notify(
        room["founder_id"],
        "data_room_access_requested",
        "Data room access requested",
        f"{requester_name} requested access to your {startup_name} data room",
        {"data_room_id": data_room_id, "startup_id": room["startup_id"]},
        email=True,
        template="data_room_access_requested",
        template_data={
            "user_name": _granted_by_name(founder),
            "from_name": requester_name,
            "startup_name": startup_name,
            "action_url": settings.frontend_url_for(f"/startups/{room['startup_id']}/data-room"),
        },
        dedupe_key=f"data_room_access_requested:{room['founder_id']}:{requester_name}:{startup_name}",
    )
    return {"success": True}


@router.patch("/access-request/{request_id}")
async def respond_to_request(request_id: str, payload: RespondRequestIn, user_id: str = Depends(get_user_id)):
    if payload.status not in REQUEST_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if payload.access_level not in ACCESS_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid access level")

    try:
        req = (
            service_supabase.table("data_room_access_requests")
            .select("*")
            .eq("id", request_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        req = None
    if not req:
        raise HTTPException(status_code=404, detail="Access request not found")

    room = _get_data_room(req["data_room_id"])
    if not room or room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can respond to this request")

    service_supabase.table("data_room_access_requests").update(
        {"status": payload.status}
    ).eq("id", request_id).execute()

    if payload.status == "approved":
        access_data = {
            "data_room_id": req["data_room_id"],
            "user_id": req["requester_id"],
            "granted_by": user_id,
            "access_level": payload.access_level,
            "expires_at": payload.expires_at or None,
            "is_active": True,
        }
        existing_access = _get_access(req["data_room_id"], req["requester_id"])
        if existing_access:
            service_supabase.table("data_room_access").update(
                {k: v for k, v in access_data.items() if k not in ("data_room_id", "user_id")}
            ).eq("id", existing_access["id"]).execute()
        else:
            service_supabase.table("data_room_access").insert(access_data).execute()

        requester = _get_profile(req["requester_id"])
        startup = _get_startup(room["startup_id"])
        startup_name = (startup or {}).get("name") or "this startup"
        _notify_user(
            req["requester_id"],
            "data_room_access_approved",
            "Data room access granted",
            f"You now have access to the {startup_name} data room",
            {"data_room_id": req["data_room_id"], "startup_id": room["startup_id"]},
        )
        notify(
            req["requester_id"],
            "data_room_access_approved",
            "Data room access granted",
            f"You now have access to the {startup_name} data room",
            {"data_room_id": req["data_room_id"], "startup_id": room["startup_id"]},
            email=True,
            template="data_room_access_approved",
            template_data={
                "user_name": _granted_by_name(requester),
                "startup_name": startup_name,
                "action_url": settings.frontend_url_for(f"/startups/{room['startup_id']}/data-room"),
            },
            dedupe_key=f"data_room_access_approved:{req['requester_id']}:{room['startup_id']}",
        )
    else:
        _notify_user(
            req["requester_id"],
            "data_room_access_rejected",
            "Data room access request declined",
            "A founder declined your data room access request",
            {"data_room_id": req["data_room_id"]},
        )

    return {"success": True}


@router.post("/{data_room_id}/grant-access")
async def grant_access(data_room_id: str, payload: GrantAccessIn, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can grant access")
    if payload.access_level not in ACCESS_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid access level")

    access_data = {
        "data_room_id": data_room_id,
        "user_id": payload.user_id,
        "granted_by": user_id,
        "access_level": payload.access_level,
        "expires_at": payload.expires_at or None,
        "is_active": True,
    }
    existing = _get_access(data_room_id, payload.user_id)
    if existing:
        service_supabase.table("data_room_access").update(
            {k: v for k, v in access_data.items() if k not in ("data_room_id", "user_id")}
        ).eq("id", existing["id"]).execute()
        return {"success": True, "access": existing["id"]}
    result = service_supabase.table("data_room_access").insert(access_data).execute()
    return {"success": True, "access": result.data[0]["id"]}


@router.delete("/access/{access_id}")
async def revoke_access(access_id: str, user_id: str = Depends(get_user_id)):
    try:
        access = (
            service_supabase.table("data_room_access")
            .select("*")
            .eq("id", access_id)
            .maybe_single()
            .execute()
        ).data
    except Exception:
        access = None
    if not access:
        raise HTTPException(status_code=404, detail="Access record not found")
    room = _get_data_room(access["data_room_id"])
    if not room or room.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can revoke access")
    service_supabase.table("data_room_access").update({"is_active": False}).eq("id", access_id).execute()
    return {"success": True}


@router.post("/{data_room_id}/sign-nda")
async def sign_nda(data_room_id: str, user_id: str = Depends(get_user_id)):
    room = _get_data_room(data_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if room.get("founder_id") == user_id:
        raise HTTPException(status_code=400, detail="Founders do not need to sign the NDA")
    access = _get_access(data_room_id, user_id)
    if not access or not access.get("is_active"):
        raise HTTPException(status_code=403, detail="You need an approved access request first")
    service_supabase.table("data_room_access").update(
        {"nda_signed": True, "nda_signed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", access["id"]).execute()
    return {"success": True}
