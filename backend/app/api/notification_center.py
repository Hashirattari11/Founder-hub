"""Notification Center API.

User-facing endpoints (bell + notification page):
  GET    /api/notifications?limit=&offset=&type=
  GET    /api/notifications/unread-count
  POST   /api/notifications/{id}/read
  POST   /api/notifications/read-all
  DELETE /api/notifications/{id}
  GET    /api/notification-preferences
  PUT    /api/notification-preferences
  GET    /api/notification-types

Admin endpoints (email ops + broadcast + analytics):
  GET    /api/admin/email-logs            (moved from notifications.py)
  GET    /api/admin/email-queue?status=
  POST   /api/admin/email-queue/retry
  POST   /api/admin/broadcast
  GET    /api/admin/email-analytics
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.security import RequireAdmin
from app.core.supabase import service_supabase
from app.services.email_queue_service import retry_failed
from app.services.notification_service import broadcast, notify_admin

router = APIRouter(tags=["notifications"])

# ---------------------------------------------------------------------------
# User notification center
# ---------------------------------------------------------------------------

PREF_KEYS = [
    "email_enabled",
    "push_enabled",
    "marketing",
    "meeting_emails",
    "message_emails",
    "investor_emails",
    "application_emails",
    "admin_alerts",
]

DEFAULT_PREFS = {k: True for k in PREF_KEYS}


@router.get("/api/notifications")
async def list_notifications(
    limit: int = 50,
    offset: int = 0,
    notification_type: Optional[str] = None,
    unread_only: bool = False,
    user_id: str = Depends(get_user_id),
):
    limit = max(1, min(limit, 100))
    query = (
        service_supabase.table("notifications")
        .select("id, type, title, body, data, is_read, created_at, read_at")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if notification_type:
        query = query.eq("type", notification_type)
    if unread_only:
        query = query.eq("is_read", False)

    result = query.execute()
    rows = result.data or []

    try:
        count_res = (
            service_supabase.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .execute()
        )
        total = count_res.count or len(rows)
    except Exception:
        total = len(rows)

    return {"notifications": rows, "total": total, "limit": limit, "offset": offset}


@router.get("/api/notifications/unread-count")
async def unread_count(user_id: str = Depends(get_user_id)):
    try:
        res = (
            service_supabase.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_read", False)
            .is_("deleted_at", "null")
            .execute()
        )
        return {"unread": res.count or 0}
    except Exception:
        return {"unread": 0}


@router.post("/api/notifications/{notification_id}/read")
async def mark_read(notification_id: str, user_id: str = Depends(get_user_id)):
    service_supabase.table("notifications").update(
        {"is_read": True, "read_at": "now"}
    ).eq("id", notification_id).eq("user_id", user_id).execute()
    return {"success": True}


@router.post("/api/notifications/read-all")
async def mark_all_read(user_id: str = Depends(get_user_id)):
    service_supabase.table("notifications").update(
        {"is_read": True, "read_at": "now"}
    ).eq("user_id", user_id).eq("is_read", False).is_("deleted_at", "null").execute()
    return {"success": True}


@router.delete("/api/notifications/{notification_id}")
async def delete_notification(notification_id: str, user_id: str = Depends(get_user_id)):
    service_supabase.table("notifications").update(
        {"deleted_at": "now"}
    ).eq("id", notification_id).eq("user_id", user_id).execute()
    return {"success": True}


# ---------------------------------------------------------------------------
# Notification preferences
# ---------------------------------------------------------------------------


def _load_prefs(user_id: str) -> dict:
    try:
        rows = (
            service_supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = (rows.data or [{}])[0]
        merged = dict(DEFAULT_PREFS)
        merged.update({k: v for k, v in row.items() if k in DEFAULT_PREFS})
        return merged
    except Exception:
        return dict(DEFAULT_PREFS)


@router.get("/api/notification-preferences")
async def get_preferences(user_id: str = Depends(get_user_id)):
    return {"preferences": _load_prefs(user_id)}


class PreferencesUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    marketing: Optional[bool] = None
    meeting_emails: Optional[bool] = None
    message_emails: Optional[bool] = None
    investor_emails: Optional[bool] = None
    application_emails: Optional[bool] = None
    admin_alerts: Optional[bool] = None


@router.put("/api/notification-preferences")
async def update_preferences(payload: PreferencesUpdate, user_id: str = Depends(get_user_id)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return {"success": True, "preferences": _load_prefs(user_id)}

    current = _load_prefs(user_id)
    current.update(updates)

    try:
        service_supabase.table("notification_preferences").upsert(
            {"user_id": user_id, **current, "updated_at": "now"},
            on_conflict="user_id",
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save preferences: {exc}") from exc

    return {"success": True, "preferences": current}


@router.get("/api/notification-types")
async def list_types():
    try:
        rows = (
            service_supabase.table("notification_types")
            .select("name, label, description, category")
            .order("label")
            .execute()
        )
        return {"types": rows.data or []}
    except Exception:
        return {"types": []}


# ---------------------------------------------------------------------------
# Admin — email queue + logs + broadcast
# ---------------------------------------------------------------------------


@router.get("/api/admin/email-logs")
async def admin_email_logs(
    limit: int = 100,
    status: Optional[str] = None,
    admin_id: str = Depends(RequireAdmin()),
):
    limit = max(1, min(limit, 500))
    query = service_supabase.table("email_logs").select("*").order("created_at", desc=True).limit(limit)
    if status:
        query = query.eq("status", status)
    return {"logs": (query.execute().data) or []}


@router.get("/api/admin/email-queue")
async def admin_email_queue(
    status: Optional[str] = None,
    limit: int = 100,
    admin_id: str = Depends(RequireAdmin()),
):
    limit = max(1, min(limit, 500))
    query = (
        service_supabase.table("email_queue")
        .select("id, to_email, subject, template, status, attempts, max_attempts, error, created_at, updated_at, sent_at")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)

    rows = (query.execute().data) or []

    counts: dict[str, int] = {}
    try:
        for s in ("pending", "sending", "sent", "failed", "cancelled"):
            res = (
                service_supabase.table("email_queue")
                .select("id", count="exact")
                .eq("status", s)
                .execute()
            )
            counts[s] = res.count or 0
    except Exception:
        pass

    return {"queue": rows, "counts": counts}


@router.post("/api/admin/email-queue/retry")
async def admin_retry_failed(admin_id: str = Depends(RequireAdmin())):
    count = retry_failed()
    return {"success": True, "retried": count}


class BroadcastRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    send_email: bool = True
    audience: Optional[str] = None
    user_ids: Optional[list[str]] = None


@router.post("/api/admin/broadcast")
async def admin_broadcast(payload: BroadcastRequest, admin_id: str = Depends(RequireAdmin())):
    notified = broadcast(
        payload.title,
        payload.body,
        email=payload.send_email,
        template="broadcast",
        template_data={
            "title": payload.title,
            "body": payload.body,
            "action_url": settings.frontend_url_for("/"),
            "action_label": "View",
        },
        user_ids=payload.user_ids,
    )
    return {"success": True, "notified": notified}


@router.get("/api/admin/email-analytics")
async def admin_email_analytics(admin_id: str = Depends(RequireAdmin())):
    try:
        sent = (
            service_supabase.table("email_logs")
            .select("id", count="exact")
            .eq("status", "sent")
            .execute()
        )
        failed = (
            service_supabase.table("email_logs")
            .select("id", count="exact")
            .eq("status", "failed")
            .execute()
        )
        total = (sent.count or 0) + (failed.count or 0)
        return {
            "total": total,
            "sent": sent.count or 0,
            "failed": failed.count or 0,
            "delivery_rate": round((sent.count or 0) / total * 100, 1) if total else 0.0,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {exc}") from exc
