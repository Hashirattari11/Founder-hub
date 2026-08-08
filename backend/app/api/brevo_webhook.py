"""Brevo transactional webhook endpoint.

Receives delivery events (delivered / opened / clicked / bounced / blocked)
from Brevo and updates the matching `email_queue` and `email_logs` rows by
`message_id`, so the admin panel shows real delivery status instead of just
"accepted by provider".

Configure the endpoint in the Brevo dashboard (Transactional → Webhooks):
  URL:    <BACKEND_URL>/api/webhooks/brevo
  Events: delivered, opened, click, bounce, blocked, complaint, unsubscribed
The webhook secret is optional; when `BREVO_WEBHOOK_SECRET` is set, requests
are verified with HMAC-SHA256 against the `X-Mailin-Signature` /
`X-Brevo-Signature` header before any row is touched.
"""
import base64
import hashlib
import hmac
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.supabase import service_supabase

logger = logging.getLogger("founderhub.brevo_webhook")

router = APIRouter(tags=["webhooks"])

# Brevo webhook event -> FounderHub delivery status
_EVENT_STATUS = {
    "delivered": "delivered",
    "opened": "opened",
    "click": "clicked",
    "clicked": "clicked",
    "bounce": "bounced",
    "soft_bounce": "bounced",
    "hard_bounce": "bounced",
    "invalid_email": "bounced",
    "error": "bounced",
    "complaint": "bounced",
    "spam_report": "bounced",
    "unsubscribed": "bounced",
    "blocked": "blocked",
}

# Statuses that clear the stored error (delivery progressed past a problem).
_CLEARS_ERROR = {"delivered", "opened", "clicked"}


def _verify_signature(raw: bytes, signature: Optional[str]) -> bool:
    """Verify the Brevo HMAC-SHA256 signature (base64 or hex encoded)."""
    secret = settings.brevo_webhook_secret
    if not secret:
        return True
    if not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).digest()
    candidates = []
    try:
        candidates.append(base64.b64encode(digest).decode("ascii"))
    except Exception:  # pragma: no cover
        pass
    candidates.append(digest.hex())
    received = signature.strip()
    for candidate in candidates:
        if hmac.compare_digest(candidate, received):
            return True
    return False


def _event_payload(body: bytes):
    """Return a list of event dicts, handling both array and single-event payloads."""
    try:
        data = json.loads(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("events"), list):
            return data["events"]
        return [data]
    return []


def _update_by_message_id(table: str, message_id: str, status: str, error: Optional[str]) -> None:
    if not service_supabase.available:
        return
    try:
        patch: dict = {"status": status}
        if status in _CLEARS_ERROR:
            patch["error"] = None
        else:
            patch["error"] = (error or f"brevo:{status}")[:500]
        service_supabase.table(table).update(patch).eq("message_id", message_id).execute()
    except Exception as exc:  # pragma: no cover
        logger.warning("webhook update %s failed for %s: %s", table, message_id, exc)


@router.post("/api/webhooks/brevo")
async def brevo_webhook(request: Request):
    raw = await request.body()
    signature = request.headers.get("X-Mailin-Signature") or request.headers.get("X-Brevo-Signature")
    if not _verify_signature(raw, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    events = _event_payload(raw)
    processed = 0
    for event in events:
        if not isinstance(event, dict):
            continue
        event_name = str(event.get("event") or "").lower()
        message_id = event.get("message-id") or event.get("messageId") or event.get("message_id")
        status = _EVENT_STATUS.get(event_name)
        if not status or not message_id:
            continue
        reason = event.get("reason") or event.get("Error") or event.get("error")
        _update_by_message_id("email_queue", message_id, status, reason)
        _update_by_message_id("email_logs", message_id, status, reason)
        processed += 1

    logger.info("Brevo webhook processed %d events", processed)
    return {"success": True, "processed": processed}
