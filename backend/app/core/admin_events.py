"""Helpers for admin notifications and the admin audit trail."""
from __future__ import annotations

from typing import Optional

from app.core.supabase import service_supabase


def insert_admin_notification(
    type_: str,
    title: str,
    body: str = "",
    data: Optional[dict] = None,
) -> None:
    """Fire-and-forget insert into admin_notifications (best effort)."""
    try:
        service_supabase.table("admin_notifications").insert(
            {"type": type_, "title": title, "body": body, "data": data}
        ).execute()
    except Exception as exc:
        print(f"[admin_events] notification insert failed: {exc}")


def log_audit(
    admin_id: str,
    admin_email: Optional[str],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Insert an audit_logs row (best effort)."""
    try:
        service_supabase.table("audit_logs").insert(
            {
                "admin_id": admin_id,
                "admin_email": admin_email,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old_value": old_value,
                "new_value": new_value,
                "ip": (ip or "")[:64] if ip else None,
                "user_agent": (user_agent or "")[:256] if user_agent else None,
            }
        ).execute()
    except Exception as exc:
        print(f"[admin_events] audit insert failed: {exc}")
