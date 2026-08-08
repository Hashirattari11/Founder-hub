"""Transactional email transport — Brevo only.

All FounderHub transactional email is delivered through Brevo
(`BREVO_API_KEY`). The Brevo `messageId` returned on acceptance is captured
so the webhook endpoint can map delivery events (delivered / opened /
clicked / bounced / blocked) back to queue + log rows.

Sending never raises: every attempt returns a structured result
{ok, error, message_id, http_status} so the queue worker can decide whether
to retry and the admin panel can surface real delivery status.
"""
import logging
from typing import Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("founderhub.email")

BREVO_API = "https://api.brevo.com/v3/smtp/email"


def resolve_email_provider() -> str | None:
    """Return "brevo" when a Brevo API key is configured, else None."""
    if settings.brevo_api_key:
        return "brevo"
    return None


def _headers() -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.brevo_api_key:
        headers["api-key"] = settings.brevo_api_key
    return headers


def send_brevo_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    *,
    from_name: str | None = None,
    from_email: str | None = None,
) -> dict:
    """Send one transactional email via Brevo and return a structured result.

    Returns:
      {"ok": bool, "error": str|None, "message_id": str|None,
       "http_status": int|None}
    """
    if not settings.brevo_api_key:
        return {"ok": False, "error": "BREVO_API_KEY not set", "message_id": None, "http_status": None}
    if not to:
        return {"ok": False, "error": "Missing recipient", "message_id": None, "http_status": None}
    payload = {
        "sender": {
            "name": from_name or settings.email_from_name,
            "email": from_email or settings.email_from_email,
        },
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
    }
    if text:
        payload["textContent"] = text
    try:
        resp = httpx.post(BREVO_API, json=payload, headers=_headers(), timeout=30.0)
    except httpx.HTTPError as exc:
        logger.warning("Brevo network error sending to %s: %s", to, exc)
        return {"ok": False, "error": f"Brevo network error: {exc}", "message_id": None, "http_status": None}
    if resp.status_code >= 400:
        logger.warning("Brevo HTTP %s sending to %s: %s", resp.status_code, to, resp.text[:300])
        return {
            "ok": False,
            "error": f"Brevo HTTP {resp.status_code}: {resp.text[:300]}",
            "message_id": None,
            "http_status": resp.status_code,
        }
    message_id = None
    try:
        message_id = resp.json().get("messageId")
    except Exception:
        message_id = None
    return {"ok": True, "error": None, "message_id": message_id, "http_status": resp.status_code}


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    provider: str | None = None,
) -> bool:
    """Send a transactional email via Brevo.

    Returns True when Brevo accepted the email. Never raises.
    """
    return send_brevo_email(to, subject, html, text)["ok"]


def send_email_ex(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    provider: str | None = None,
) -> Tuple[bool, Optional[str]]:
    """Like send_email but also returns the error message (for queue retry)."""
    result = send_brevo_email(to, subject, html, text)
    return result["ok"], result["error"]


def send_email_many(emails: List[dict]) -> int:
    """Send several emails; returns the count that succeeded. Best-effort."""
    sent = 0
    for item in emails:
        ok = send_email(
            item.get("to", ""),
            item.get("subject", ""),
            item.get("html", ""),
            item.get("text"),
        )
        if ok:
            sent += 1
    return sent


# ---------------------------------------------------------------------------
# Legacy convenience helpers (kept for existing callers)
# ---------------------------------------------------------------------------


def email_for_status_update(to: str, name: str, startup_name: str, role: str, status: str) -> bool:
    from app.services.email_templates import render_template

    rendered = render_template(
        "application_accepted" if status.lower() == "accepted" else "application_rejected",
        {"user_name": name, "startup_name": startup_name, "role": role},
    )
    return send_email(to, rendered["subject"], rendered["html"])


def email_for_match(to: str, name: str, startup_name: str, role: str, score: int) -> bool:
    from app.services.email_templates import render_template

    rendered = render_template(
        "investor_interested" if role.lower() == "investor" else "broadcast",
        {"user_name": name, "startup_name": startup_name, "role": role, "match_score": score},
    )
    return send_email(to, rendered["subject"], rendered["html"])


def email_for_application(to: str, founder_name: str, startup_name: str, applicant_name: str, role: str) -> bool:
    from app.services.email_templates import render_template

    rendered = render_template(
        "message_received",
        {"user_name": founder_name, "from_name": applicant_name, "startup_name": startup_name, "role": role},
    )
    return send_email(to, rendered["subject"], rendered["html"])
