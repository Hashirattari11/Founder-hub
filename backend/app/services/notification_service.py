"""Core notification + email + push pipeline for FounderHub.

Every event funnels through :func:`notify` which:
  1. inserts a bell notification row (respecting user preferences),
  2. enqueues a transactional email (dedupe-aware, preference-aware),
  3. enqueues an Expo push (if the user has devices).

All delivery is async/queued so callers never block on SMTP.
"""
import json
import logging
import uuid

from app.core.supabase import service_supabase
from app.core.users import user_email, user_full_name
from app.services.email_queue_service import enqueue_email
from app.services.email_templates import render_template
from app.services.push_service import enqueue_push

logger = logging.getLogger("founderhub.notify")

# category -> preference column
_CATEGORY_TO_PREF = {
    "meeting": "meeting_emails",
    "message": "message_emails",
    "investor": "investor_emails",
    "application": "application_emails",
    "marketing": "marketing",
    "admin": "admin_alerts",
}

# System-critical notifications are ALWAYS emailed (respecting only the global
# email_enabled switch). These are transactional — e.g. role approvals/rejections
# — and must never be silenced by a per-category toggle.
_TRANSACTIONAL_TYPES = {
    "role_approved",
    "role_rejected",
    "role_changed",
    "admin_alert",
    "welcome",
    "verify_email",
    "password_reset",
    "account_suspended",
    "connection_request",
    "connection_accepted",
}

DEFAULT_PREFS = {
    "email_enabled": True,
    "push_enabled": True,
    "marketing": True,
    "meeting_emails": True,
    "message_emails": True,
    "investor_emails": True,
    "application_emails": True,
    "admin_alerts": True,
}


def _prefs(user_id: str) -> dict:
    if not service_supabase.available:
        return dict(DEFAULT_PREFS)
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
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to load prefs for %s: %s", user_id, exc)
        return dict(DEFAULT_PREFS)


def _category_for(notification_type: str) -> str:
    """Map a notification type to its preference category."""
    t = (notification_type or "").lower()
    if "meeting" in t or "reminder" in t:
        return "meeting"
    if "message" in t or "chat" in t or "connection" in t:
        return "message"
    if "investor" in t or "funding" in t:
        return "investor"
    if "application" in t or "accepted" in t or "rejected" in t:
        return "application"
    if "admin" in t or "report" in t:
        return "admin"
    return "marketing"


def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> str | None:
    """Insert a bell notification row (best-effort). Returns the row id or None."""
    if not user_id:
        return None
    try:
        if service_supabase.available:
            result = service_supabase.rpc(
                "create_notification",
                {
                    "p_user_id": user_id,
                    "p_type": notification_type,
                    "p_title": title,
                    "p_body": body,
                    "p_data": data or {},
                },
            ).execute()
            return (result.data or [None])[0] if isinstance(result.data, list) else (result.data or None)
        return None
    except Exception as exc:  # pragma: no cover
        logger.warning("create_notification failed for %s: %s", user_id, exc)
        return None


def notify(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: dict | None = None,
    *,
    email: bool = True,
    push: bool = True,
    template: str | None = None,
    template_data: dict | None = None,
    dedupe_key: str | None = None,
    to_email: str | None = None,
    to_name: str | None = None,
) -> dict:
    """Fan out a single event to bell + email + push.

    Returns a summary dict for logging/telemetry:
      {"notification_id": str|None, "email_enqueued": bool, "push_enqueued": bool}
    """
    nid = create_notification(user_id, notification_type, title, body, data)
    result: dict = {"notification_id": nid, "email_enqueued": False, "push_enqueued": False}

    if not service_supabase.available:
        return result

    prefs = _prefs(user_id)
    category = _category_for(notification_type)

    if email and prefs.get("email_enabled", True):
        pref_col = _CATEGORY_TO_PREF.get(category, "marketing")
        type_key = (notification_type or "").lower()
        allowed = type_key in _TRANSACTIONAL_TYPES or prefs.get(pref_col, True)
        if allowed:
            merged_data = dict(template_data or {})
            merged_data.setdefault("user_name", to_name or user_full_name(user_id))
            if not merged_data.get("user_name"):
                merged_data["user_name"] = "there"
            result["email_enqueued"] = enqueue_email(
                to_email=to_email or user_email(user_id),
                notification_type=notification_type,
                template=template,
                data=merged_data,
                dedupe_key=dedupe_key,
            )

    if push and prefs.get("push_enabled", True):
        queued = enqueue_push(user_id, title, body, data)
        result["push_enqueued"] = queued > 0

    return result


def notify_admin(
    title: str,
    body: str,
    data: dict | None = None,
    *,
    email: bool = True,
    template: str = "admin_alert",
    template_data: dict | None = None,
    dedupe_key: str | None = None,
) -> None:
    """Notify all admin users (is_admin on profiles)."""
    if not service_supabase.available:
        return
    try:
        rows = (
            service_supabase.table("profiles")
            .select("id")
            .or_("is_admin.eq.true")
            .execute()
        )
    except Exception:
        rows = (
            service_supabase.table("profiles")
            .select("id")
            .eq("is_admin", True)
            .execute()
        )
    for row in rows.data or []:
        notify(
            row["id"],
            "admin_alert",
            title,
            body,
            data,
            email=email,
            template=template,
            template_data=template_data,
            dedupe_key=dedupe_key,
        )


def broadcast(
    title: str,
    body: str,
    data: dict | None = None,
    *,
    email: bool = True,
    template: str = "broadcast",
    template_data: dict | None = None,
    dedupe_key: str | None = None,
    user_ids: list[str] | None = None,
) -> int:
    """Notify many users at once (admin broadcast). Returns the count notified."""
    if not service_supabase.available:
        return 0
    try:
        if user_ids is None:
            rows = service_supabase.table("profiles").select("id").execute()
            user_ids = [r["id"] for r in (rows.data or [])]
    except Exception as exc:  # pragma: no cover
        logger.warning("broadcast failed to list users: %s", exc)
        return 0

    count = 0
    for uid in user_ids:
        try:
            notify(
                uid,
                "broadcast",
                title,
                body,
                data,
                email=email,
                template=template,
                template_data=template_data,
                dedupe_key=dedupe_key,
            )
            count += 1
        except Exception as exc:  # pragma: no cover
            logger.warning("broadcast to %s failed: %s", uid, exc)
    return count
