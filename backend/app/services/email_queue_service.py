"""Persistent email queue backed by the `email_queue` table (Brevo only).

Delivery strategy (production-ready):
  1. :func:`enqueue_email` inserts a row, then **sends immediately** on a
     background thread (real-time delivery on any host, including serverless).
  2. :func:`email_loop` is a background worker that drains anything left in
     `queued`/`sending` (crash recovery) and retries `failed` rows.
  3. :func:`drain_pending` runs at app startup so serverless instances flush
     anything queued by a previous invocation.

Statuses: queued → sending → sent, then the Brevo webhook moves rows to
delivered / opened / clicked, or to failed / bounced / blocked. The Brevo
messageId is stored so webhook events map back to the right row. Sends and
failures are logged to `email_logs` for the admin panel.
"""
import asyncio
import hashlib
import json
import logging
import threading
import time
from datetime import datetime, timezone

from app.core.email import send_brevo_email  # noqa: F401  (legacy admin test path)
from app.core.supabase import service_supabase
from app.services.email_templates import render_template

logger = logging.getLogger("founderhub.email_queue")

POLL_SECONDS = 2.0
MAX_BATCH = 25
DEDUPE_WINDOW_SECONDS = 600  # 10 minutes: block exact duplicates within this window

_PENDING = asyncio.Event()


def json_safe(value) -> str:
    try:
        return json.dumps(value, sort_keys=True, default=str)
    except Exception:
        return str(value)


def _dedupe_hash(to_email: str, template: str, data: dict | None) -> str | None:
    if not to_email or not template:
        return None
    raw = f"{to_email}|{template}|{json_safe(data or {})}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _recent_row_count(to_email: str, template: str, data: dict | None, dedupe_key: str | None) -> int:
    """Count active queue rows matching the dedupe key within the dedupe window.

    A row older than DEDUPE_WINDOW_SECONDS no longer blocks a new send, so the
    same event (e.g. a new message in a chat) still produces fresh emails.
    """
    if not service_supabase.available or not to_email:
        return 0
    key = dedupe_key or _dedupe_hash(to_email, template, data)
    if not key:
        return 0
    try:
        cutoff = datetime.now(timezone.utc).timestamp() - DEDUPE_WINDOW_SECONDS
        cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
        rows = (
            service_supabase.table("email_queue")
            .select("id")
            .eq("dedupe_key", key)
            .gte("created_at", cutoff_iso)
            .execute()
        )
        return len(rows.data or [])
    except Exception:  # pragma: no cover
        return 0


def enqueue_email(
    to_email: str | None,
    notification_type: str,
    template: str | None = None,
    data: dict | None = None,
    dedupe_key: str | None = None,
    *,
    send_now: bool = True,
) -> bool:
    """Queue an email and deliver it in real time.

    Returns True if a new row was inserted (even if the immediate send is
    still in flight). When `send_now` is False, the row is left for the
    background worker to drain.
    """
    if not to_email:
        return False
    if not template:
        template = _template_for(notification_type)
    if not template:
        return False

    key = dedupe_key or _dedupe_hash(to_email, template, data)
    if key and _recent_row_count(to_email, template, data, key) > 0:
        logger.info("Dedupe hit for %s/%s — skipping", to_email, template)
        return False

    try:
        rendered = render_template(template, data or {})
    except Exception as exc:  # pragma: no cover
        logger.warning("Template render failed for %s: %s", template, exc)
        rendered = {"subject": template, "html": ""}

    if not service_supabase.available:
        return False

    # Pin the resolved provider on the row so the admin panel can see where
    # each message was sent. Falls back to Resend when no Brevo key exists.
    from app.core.email import resolve_email_provider

    provider = resolve_email_provider() or ""

    try:
        payload = {
            "recipient_id": (data or {}).get("user_id"),
            "to_email": to_email,
            "subject": rendered.get("subject", ""),
            "html_body": rendered.get("html", ""),
            "text_body": rendered.get("text", ""),
            "template": template,
            "template_data": data or {},
            "dedupe_key": key,
            "status": "queued",
            "attempts": 0,
            "max_attempts": 3,
            "provider": provider,
        }
        service_supabase.table("email_queue").insert(payload).execute()
    except Exception as exc:  # pragma: no cover
        logger.warning("enqueue_email insert failed: %s", exc)
        return False

    if send_now:
        # Real-time delivery: hand the row to a background thread immediately.
        row = dict(payload)
        try:
            inserted = (
                service_supabase.table("email_queue")
                .select("id,created_at")
                .eq("dedupe_key", key)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if inserted.data:
                row["id"] = inserted.data[0]["id"]
        except Exception:  # pragma: no cover
            row["id"] = None
        threading.Thread(target=_send_one_safe, args=(row,), daemon=True).start()
    _wake_worker()
    return True


def _send_one_safe(row: dict) -> None:
    """Thread-safe wrapper so a crashed send never kills the worker/request."""
    try:
        _send_one(row)
    except Exception as exc:  # pragma: no cover
        logger.warning("send_one crashed for %s: %s", row.get("to_email"), exc)
        _retry_later(row, str(exc))


def _template_for(notification_type: str) -> str | None:
    t = (notification_type or "").lower()
    mapping = {
        "welcome": "welcome",
        "verify": "verify_email",
        "verify_email": "verify_email",
        "password_reset": "password_reset",
        "meeting_invite": "meeting_invite",
        "meeting_reminder": "meeting_reminder",
        "meeting_cancelled": "meeting_cancelled",
        "meeting_rescheduled": "meeting_rescheduled",
        "meeting_accepted": "meeting_accepted",
        "application_accepted": "application_accepted",
        "application_rejected": "application_rejected",
        "application_shortlisted": "application_shortlisted",
        "startup_match": "startup_match",
        "cofounder_request": "cofounder_request",
        "cofounder_accepted": "cofounder_accepted",
        "data_room_viewed": "data_room_viewed",
        "data_room_access_requested": "data_room_access_requested",
        "data_room_access_approved": "data_room_access_approved",
        "investor_interested": "investor_interested",
        "investor_match": "investor_match",
        "job_application": "job_application",
        "startup_approved": "startup_approved",
        "role_approved": "role_approved",
        "role_rejected": "role_rejected",
        "role_request": "role_request",
        "admin_alert": "admin_alert",
        "broadcast": "broadcast",
        "message_received": "message_received",
    }
    return mapping.get(t) or mapping.get(notification_type) or None


def _wake_worker() -> None:
    loop = asyncio.get_event_loop()
    if loop.is_running():
        try:
            loop.call_soon_threadsafe(_PENDING.set)
        except Exception:  # pragma: no cover
            pass
    else:
        _PENDING.set()


def _claim_batch() -> list[dict]:
    """Claim up to MAX_BATCH pending/sending emails (crash recovery)."""
    if not service_supabase.available:
        return []
    try:
        rows = (
            service_supabase.table("email_queue")
            .select("*")
            .in_("status", ["queued", "sending", "pending"])
            .order("created_at")
            .limit(MAX_BATCH)
            .execute()
        )
        claimed = []
        for row in rows.data or []:
            try:
                service_supabase.table("email_queue").update({"status": "sending"}).eq("id", row["id"]).execute()
                claimed.append(row)
            except Exception:  # pragma: no cover
                pass
        return claimed
    except Exception as exc:  # pragma: no cover
        logger.warning("claim_batch failed: %s", exc)
        return []


def _retry_later(row: dict, error: str, http_status: int | None = None) -> None:
    attempts = int(row.get("attempts") or 0) + 1
    if attempts >= int(row.get("max_attempts") or 3):
        try:
            service_supabase.table("email_queue").update(
                {
                    "status": "failed",
                    "attempts": attempts,
                    "error": error[:500],
                    "http_status": http_status,
                    "last_error_at": "now",
                }
            ).eq("id", row["id"]).execute()
        except Exception:  # pragma: no cover
            pass
        return
    try:
        service_supabase.table("email_queue").update(
            {
                "status": "queued",
                "attempts": attempts,
                "error": error[:500],
                "http_status": http_status,
                "last_error_at": "now",
            }
        ).eq("id", row["id"]).execute()
    except Exception:  # pragma: no cover
        pass


def _record_log(
    row: dict,
    ok: bool,
    error: str | None = None,
    message_id: str | None = None,
    http_status: int | None = None,
) -> None:
    """Write a row to email_logs (admin panel)."""
    if not service_supabase.available:
        return
    try:
        service_supabase.table("email_logs").insert(
            {
                "recipient_id": row.get("recipient_id"),
                "recipient_email": row.get("to_email"),
                "email_type": row.get("template") or "email",
                "status": "sent" if ok else "failed",
                "subject": row.get("subject"),
                "template": row.get("template"),
                "template_data": row.get("template_data"),
                "provider": row.get("provider") or "brevo",
                "error": (error or None)[:500] if error else None,
                "message_id": message_id,
                "http_status": http_status,
                "sent_at": "now" if ok else None,
            }
        ).execute()
    except Exception as exc:  # pragma: no cover
        logger.warning("email_logs write failed: %s", exc)


def _send_one(row: dict) -> None:
    from app.core.email import send_email_full

    result = send_email_full(
        row.get("to_email", ""),
        row.get("subject", ""),
        row.get("html_body", ""),
        row.get("text_body"),
        row.get("provider") or None,
    )
    ok, error = result["ok"], result["error"]
    message_id, http_status = result.get("message_id"), result.get("http_status")

    if ok:
        try:
            service_supabase.table("email_queue").update(
                {
                    "status": "sent",
                    "sent_at": "now",
                    "error": None,
                    "message_id": message_id,
                    "http_status": http_status,
                    "last_error_at": None,
                }
            ).eq("id", row["id"]).execute()
        except Exception:  # pragma: no cover
            pass
    else:
        _retry_later(row, error or "unknown error", http_status)
    _record_log(row, ok, error, message_id, http_status)


def _drain() -> int:
    batch = _claim_batch()
    for row in batch:
        try:
            _send_one(row)
        except Exception as exc:  # pragma: no cover
            logger.warning("send_one crashed: %s", exc)
            _retry_later(row, str(exc))
    return len(batch)


def drain_pending(max_rows: int = 100) -> int:
    """Synchronously flush any queued email rows (used at startup / cron)."""
    return _drain()


def retry_failed(max_rows: int = 50) -> int:
    """Move recently failed rows back to pending (admin action)."""
    if not service_supabase.available:
        return 0
    try:
        rows = (
            service_supabase.table("email_queue")
            .select("id")
            .eq("status", "failed")
            .order("updated_at", desc=True)
            .limit(max_rows)
            .execute()
        )
        ids = [r["id"] for r in (rows.data or [])]
        if not ids:
            return 0
        service_supabase.table("email_queue").update(
            {"status": "queued", "error": None, "http_status": None, "last_error_at": None}
        ).in_("id", ids).execute()
        _wake_worker()
        return len(ids)
    except Exception as exc:  # pragma: no cover
        logger.warning("retry_failed failed: %s", exc)
        return 0


async def email_loop(stop_event: asyncio.Event) -> None:
    """Background worker draining any leftover pending emails."""
    logger.info("Email queue worker started")
    while not stop_event.is_set():
        try:
            _drain()
        except Exception as exc:  # pragma: no cover
            logger.warning("email_loop tick failed: %s", exc)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=POLL_SECONDS)
        except asyncio.TimeoutError:
            continue
    logger.info("Email queue worker stopped")
